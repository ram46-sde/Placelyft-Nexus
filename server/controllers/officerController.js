const mongoose = require('mongoose');
const PlacementDrive = require('../models/PlacementDrive');
const Company = require('../models/Company');
const DriveApplication = require('../models/DriveApplication');
const DriveAttendance = require('../models/DriveAttendance');
const StudentProfile = require('../models/StudentProfile');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { resolveUgBasis } = require('../utils/eligibilityEngine');
const { getDriveLifecycleStatus } = require('../utils/driveLifecycle');

/**
 * Shared registry of placement drive dependent records.
 * Permanent delete requires zero dependent records across all registered collections.
 */
const DRIVE_DEPENDENTS = [
  {
    model: DriveApplication,
    name: 'student application',
    query: (driveId) => ({ placementDrive: driveId }),
  },
  {
    model: DriveAttendance,
    name: 'attendance record',
    query: (driveId) => ({ placementDrive: driveId }),
  },
];

/**
 * Validates that the authenticated officer has a valid assigned college context.
 * Rejects accounts with missing collegeId or unverified legacy assignment.
 * @param {Object} user 
 * @returns {{ valid: boolean, status?: number, message?: string }}
 */
const validateOfficerCollegeContext = (user) => {
  if (!user || !user.collegeId) {
    return {
      valid: false,
      status: 403,
      message: 'Unauthorized: Placement officer account is not associated with an institution.',
    };
  }

  if (user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
    return {
      valid: false,
      status: 403,
      message: 'Unauthorized: Placement officer account has unverified college status.',
    };
  }

  return { valid: true };
};

/**
 * Validates and sanitizes companyLocation according to CPMS rules:
 * - Trims whitespace and collapses repeated spaces
 * - Length between 2 and 100 characters
 * - Unicode letters, numbers, spaces, and punctuation (, . - ( ) & /)
 * - Rejects whitespace-only or punctuation-only values (requires alphanumeric character)
 * @param {*} location
 * @param {boolean} isRequired
 * @returns {{ valid: boolean, sanitized?: string, message?: string }}
 */
const validateCompanyLocation = (location, isRequired = true) => {
  if (location === undefined || location === null || (typeof location === 'string' && !location.trim())) {
    if (isRequired) {
      return {
        valid: false,
        message: 'companyLocation is required and must be between 2 and 100 characters.',
      };
    }
    return { valid: true, sanitized: undefined };
  }

  if (typeof location !== 'string') {
    return {
      valid: false,
      message: 'companyLocation must be a string.',
    };
  }

  // Collapse repeated spaces and trim
  const sanitized = location.trim().replace(/\s+/g, ' ');

  if (sanitized.length < 2 || sanitized.length > 100) {
    return {
      valid: false,
      message: 'companyLocation must be between 2 and 100 characters in length.',
    };
  }

  // Allow Unicode letters, digits, spaces, and , . - ( ) & /
  const allowedCharsRegex = /^[\p{L}\p{N}\s,.\-()&/]+$/u;
  if (!allowedCharsRegex.test(sanitized)) {
    return {
      valid: false,
      message: 'companyLocation contains invalid characters. Allowed characters are letters, numbers, spaces, and punctuation (, . - ( ) & /).',
    };
  }

  // Reject punctuation-only or whitespace-only values: must contain at least one letter or number
  const hasAlphanumeric = /[\p{L}\p{N}]/u.test(sanitized);
  if (!hasAlphanumeric) {
    return {
      valid: false,
      message: 'companyLocation cannot consist solely of punctuation or whitespace.',
    };
  }

  return { valid: true, sanitized };
};

// @desc    Create a new placement drive
// @route   POST /api/officer/drives
// @access  Private (Placement Officer)
const createDrive = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const {
      company,
      companyId,
      companyName,
      industry,
      website,
      companyDescription,
      logoUrl,
      companyLocation,
      jobRole,
      jobDescription,
      packageDetails,
      driveDate,
      registrationDeadline,
      isActive,
      eligibilityCriteria,
    } = req.body;

    // 1. Validate required fields
    if (!jobRole || typeof jobRole !== 'string' || !jobRole.trim()) {
      return res.status(400).json({
        success: false,
        message: 'jobRole is required and must be a non-empty string.',
      });
    }

    if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
      return res.status(400).json({
        success: false,
        message: 'jobDescription is required and must be a non-empty string.',
      });
    }

    if (jobDescription.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'jobDescription must be at least 10 characters long.',
      });
    }

    if (jobDescription.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'jobDescription must not exceed 5000 characters.',
      });
    }

    // Validate companyLocation
    const locationValidation = validateCompanyLocation(companyLocation, true);
    if (!locationValidation.valid) {
      return res.status(400).json({
        success: false,
        message: locationValidation.message,
      });
    }

    if (!driveDate) {
      return res.status(400).json({
        success: false,
        message: 'driveDate is required.',
      });
    }

    if (!registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'registrationDeadline is required.',
      });
    }

    const parsedDriveDate = new Date(driveDate);
    const parsedDeadline = new Date(registrationDeadline);

    if (isNaN(parsedDriveDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid driveDate format.',
      });
    }

    if (isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registrationDeadline format.',
      });
    }

    if (parsedDeadline > parsedDriveDate) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline cannot be after the drive date.',
      });
    }

    // 2. Validate eligibilityCriteria
    const cleanedEligibility = {
      maxBacklogs: 0,
      requiredCourses: [],
      requiredSkills: [],
      minTenthPercentage: 0,
      minTwelfthPercentage: 0,
      minCgpa: 0,
      minUgPercentage: 0,
    };

    if (eligibilityCriteria) {
      // 2a. Validate 10th Standard Percentage
      if (
        eligibilityCriteria.minTenthPercentage !== undefined &&
        eligibilityCriteria.minTenthPercentage !== null &&
        eligibilityCriteria.minTenthPercentage !== ''
      ) {
        const minTenthNum = Number(eligibilityCriteria.minTenthPercentage);
        if (isNaN(minTenthNum) || minTenthNum < 0 || minTenthNum > 100) {
          return res.status(400).json({
            success: false,
            message: 'minTenthPercentage must be a number between 0 and 100.',
          });
        }
        cleanedEligibility.minTenthPercentage = minTenthNum;
      }

      // 2b. Validate 12th Standard / Diploma Percentage
      if (
        eligibilityCriteria.minTwelfthPercentage !== undefined &&
        eligibilityCriteria.minTwelfthPercentage !== null &&
        eligibilityCriteria.minTwelfthPercentage !== ''
      ) {
        const minTwelfthNum = Number(eligibilityCriteria.minTwelfthPercentage);
        if (isNaN(minTwelfthNum) || minTwelfthNum < 0 || minTwelfthNum > 100) {
          return res.status(400).json({
            success: false,
            message: 'minTwelfthPercentage must be a number between 0 and 100.',
          });
        }
        cleanedEligibility.minTwelfthPercentage = minTwelfthNum;
      }

      // 2c. Validate UG Grading Basis & Applicable Threshold
      let ugBasis = eligibilityCriteria.ugCriteriaType;

      if (ugBasis !== undefined && ugBasis !== null) {
        if (typeof ugBasis !== 'string' || !['CGPA', 'PERCENTAGE', 'NONE'].includes(ugBasis.trim().toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: 'ugCriteriaType must be one of: CGPA, PERCENTAGE, NONE.',
          });
        }
        ugBasis = ugBasis.trim().toUpperCase();
      } else {
        // If ugCriteriaType was omitted, check if this is a legacy drive payload specifying minCgpa
        if (eligibilityCriteria.minCgpa !== undefined && Number(eligibilityCriteria.minCgpa) > 0) {
          // Legacy payload with positive minCgpa
          ugBasis = undefined; // Preserves undefined on legacy-created doc
        } else if (
          eligibilityCriteria.minCgpa === 0 &&
          !eligibilityCriteria.minUgPercentage &&
          !eligibilityCriteria.minTenthPercentage &&
          !eligibilityCriteria.minTwelfthPercentage
        ) {
          ugBasis = undefined;
        } else {
          return res.status(400).json({
            success: false,
            message: 'ugCriteriaType is required and must be one of: CGPA, PERCENTAGE, NONE.',
          });
        }
      }

      if (ugBasis === 'NONE') {
        // Reject contradictory criteria
        if (
          (eligibilityCriteria.minCgpa !== undefined && Number(eligibilityCriteria.minCgpa) > 0) ||
          (eligibilityCriteria.minUgPercentage !== undefined && Number(eligibilityCriteria.minUgPercentage) > 0)
        ) {
          return res.status(400).json({
            success: false,
            message: 'Contradictory criteria: Cannot specify minimum CGPA or UG percentage when UG criteria type is NONE.',
          });
        }
        cleanedEligibility.ugCriteriaType = 'NONE';
        cleanedEligibility.minCgpa = 0;
        cleanedEligibility.minUgPercentage = 0;
      } else if (ugBasis === 'CGPA') {
        // Reject contradictory criteria
        if (eligibilityCriteria.minUgPercentage !== undefined && Number(eligibilityCriteria.minUgPercentage) > 0) {
          return res.status(400).json({
            success: false,
            message: 'Contradictory criteria: Cannot specify minimum UG percentage when UG criteria type is CGPA.',
          });
        }

        if (
          eligibilityCriteria.minCgpa === undefined ||
          eligibilityCriteria.minCgpa === null ||
          eligibilityCriteria.minCgpa === ''
        ) {
          return res.status(400).json({
            success: false,
            message: 'Minimum CGPA threshold is required when UG criteria type is CGPA.',
          });
        }

        const minCgpaNum = Number(eligibilityCriteria.minCgpa);
        if (isNaN(minCgpaNum) || minCgpaNum <= 0 || minCgpaNum > 10) {
          return res.status(400).json({
            success: false,
            message: 'minCgpa must be a positive number between 0 and 10.',
          });
        }

        cleanedEligibility.ugCriteriaType = 'CGPA';
        cleanedEligibility.minCgpa = minCgpaNum;
        cleanedEligibility.minUgPercentage = 0;
      } else if (ugBasis === 'PERCENTAGE') {
        // Reject contradictory criteria
        if (eligibilityCriteria.minCgpa !== undefined && Number(eligibilityCriteria.minCgpa) > 0) {
          return res.status(400).json({
            success: false,
            message: 'Contradictory criteria: Cannot specify minimum CGPA when UG criteria type is PERCENTAGE.',
          });
        }

        if (
          eligibilityCriteria.minUgPercentage === undefined ||
          eligibilityCriteria.minUgPercentage === null ||
          eligibilityCriteria.minUgPercentage === ''
        ) {
          return res.status(400).json({
            success: false,
            message: 'Minimum UG percentage threshold is required when UG criteria type is PERCENTAGE.',
          });
        }

        const minUgNum = Number(eligibilityCriteria.minUgPercentage);
        if (isNaN(minUgNum) || minUgNum <= 0 || minUgNum > 100) {
          return res.status(400).json({
            success: false,
            message: 'minUgPercentage must be a positive number between 0 and 100.',
          });
        }

        cleanedEligibility.ugCriteriaType = 'PERCENTAGE';
        cleanedEligibility.minUgPercentage = minUgNum;
        cleanedEligibility.minCgpa = 0;
      } else if (ugBasis === undefined && eligibilityCriteria.minCgpa !== undefined) {
        // Legacy path
        const minCgpaNum = Number(eligibilityCriteria.minCgpa);
        if (isNaN(minCgpaNum) || minCgpaNum < 0 || minCgpaNum > 10) {
          return res.status(400).json({
            success: false,
            message: 'minCgpa must be a number between 0 and 10.',
          });
        }
        cleanedEligibility.minCgpa = minCgpaNum;
      }

      // 2d. Validate maxBacklogs
      if (eligibilityCriteria.maxBacklogs !== undefined) {
        const maxBacklogsNum = Number(eligibilityCriteria.maxBacklogs);
        if (isNaN(maxBacklogsNum) || maxBacklogsNum < 0 || !Number.isInteger(maxBacklogsNum)) {
          return res.status(400).json({
            success: false,
            message: 'maxBacklogs must be a non-negative integer.',
          });
        }
        cleanedEligibility.maxBacklogs = maxBacklogsNum;
      }

      // 2e. Validate requiredCourses
      if (eligibilityCriteria.requiredCourses !== undefined) {
        if (!Array.isArray(eligibilityCriteria.requiredCourses)) {
          return res.status(400).json({
            success: false,
            message: 'requiredCourses must be an array of strings.',
          });
        }
        cleanedEligibility.requiredCourses = eligibilityCriteria.requiredCourses
          .map((c) => String(c).trim())
          .filter(Boolean);
      }

      // 2f. Validate requiredSkills
      if (eligibilityCriteria.requiredSkills !== undefined) {
        if (!Array.isArray(eligibilityCriteria.requiredSkills)) {
          return res.status(400).json({
            success: false,
            message: 'requiredSkills must be an array of strings.',
          });
        }
        cleanedEligibility.requiredSkills = eligibilityCriteria.requiredSkills
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
    }

    // 3. Resolve or Create Company
    let resolvedCompanyId = null;

    // Check if direct ID was provided (company or companyId)
    const targetCompanyId =
      companyId ||
      (typeof company === 'string' && mongoose.Types.ObjectId.isValid(company) ? company : null) ||
      (company && company._id ? company._id : null);

    if (targetCompanyId) {
      if (!mongoose.Types.ObjectId.isValid(targetCompanyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid company ID format.',
        });
      }

      const existingCompany = await Company.findById(targetCompanyId);
      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          message: 'Referenced company not found.',
        });
      }
      resolvedCompanyId = existingCompany._id;
    } else {
      // Resolve by company name
      const name =
        companyName ||
        (typeof company === 'string' ? company : null) ||
        (company && typeof company === 'object' && company.name ? company.name : null);

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid company ID or company name.',
        });
      }

      const trimmedName = name.trim();
      const escapedNameRegex = new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      let foundCompany = await Company.findOne({
        name: { $regex: escapedNameRegex },
      });

      if (!foundCompany) {
        try {
          foundCompany = await Company.create({
            name: trimmedName,
            industry: industry || (company && company.industry ? company.industry : undefined),
            website: website || (company && company.website ? company.website : undefined),
            description:
              companyDescription || (company && company.description ? company.description : undefined),
            logoUrl: logoUrl || (company && company.logoUrl ? company.logoUrl : undefined),
          });
        } catch (createErr) {
          // Handle potential concurrent creation race condition (duplicate key error 11000)
          if (createErr.code === 11000) {
            foundCompany = await Company.findOne({
              name: { $regex: escapedNameRegex },
            });
            if (!foundCompany) {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      }

      resolvedCompanyId = foundCompany._id;
    }

    // 4. Create Placement Drive
    // STRICT ISOLATION: collegeId is always sourced from req.user.collegeId; req.body.collegeId is ignored
    const newDrive = await PlacementDrive.create({
      company: resolvedCompanyId,
      collegeId: req.user.collegeId,
      jobRole: jobRole.trim(),
      jobDescription: jobDescription.trim(),
      packageDetails: packageDetails ? packageDetails.trim() : undefined,
      companyLocation: locationValidation.sanitized,
      driveDate: parsedDriveDate,
      registrationDeadline: parsedDeadline,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      eligibilityCriteria: cleanedEligibility,
    });

    const populatedDrive = await PlacementDrive.findById(newDrive._id).populate('company');
    const driveObj = populatedDrive.toObject();
    const effectiveUgCriteriaType = resolveUgBasis(populatedDrive.eligibilityCriteria);

    // 5. Notify all active, verified students belonging to the officer's college (Failure-isolated)
    try {
      const verifiedStudents = await User.find({
        role: 'student',
        collegeId: req.user.collegeId,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      }).select('_id');

      if (verifiedStudents && verifiedStudents.length > 0) {
        const companyName =
          (populatedDrive && populatedDrive.company && populatedDrive.company.name) ||
          'A company';

        const notificationDocs = verifiedStudents.map((st) => ({
          recipient: st._id,
          collegeId: req.user.collegeId,
          title: `New Placement Drive: ${jobRole.trim()}`,
          message: `${companyName} has announced a new placement drive for ${jobRole.trim()}. Check eligibility and apply before the deadline.`,
          type: 'DRIVE_ANNOUNCEMENT',
          placementDrive: newDrive._id,
          isRead: false,
        }));

        await Notification.insertMany(notificationDocs, { ordered: false });
      }
    } catch (notifErr) {
      // Failure isolation: Drive creation must succeed even if notifications fail
      console.error('[Drive Creation Notification Error]:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Placement drive created successfully.',
      drive: {
        ...driveObj,
        status: getDriveLifecycleStatus(newDrive),
        effectiveUgCriteriaType,
        eligibilityCriteria: {
          ...driveObj.eligibilityCriteria,
          effectiveUgCriteriaType,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List placement drives for the authenticated officer's college
// @route   GET /api/officer/drives
// @access  Private (Placement Officer)
const getOfficerDrives = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    // Strict multi-tenant query: Only drives belonging to authenticated officer's college
    const drives = await PlacementDrive.find({ collegeId: req.user.collegeId })
      .populate('company')
      .sort({ driveDate: 1 });

    const now = new Date();
    let activeCount = 0;
    let closedCount = 0;
    let archivedCount = 0;

    const drivesWithBasis = drives.map((drive) => {
      const driveObj = drive.toObject();
      const effectiveUgCriteriaType = resolveUgBasis(drive.eligibilityCriteria);
      const status = getDriveLifecycleStatus(drive, now);

      if (status === 'active') activeCount += 1;
      else if (status === 'closed') closedCount += 1;
      else if (status === 'archived') archivedCount += 1;

      return {
        ...driveObj,
        status,
        effectiveUgCriteriaType,
        eligibilityCriteria: {
          ...driveObj.eligibilityCriteria,
          effectiveUgCriteriaType,
        },
      };
    });

    const totalCount = activeCount + closedCount;

    res.status(200).json({
      success: true,
      count: drivesWithBasis.length,
      counts: {
        total: totalCount,
        active: activeCount,
        closed: closedCount,
        archived: archivedCount,
      },
      drives: drivesWithBasis,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List applicants for a specific placement drive within officer's college
// @route   GET /api/officer/drives/:id/applications
// @access  Private (Placement Officer)
const getDriveApplicants = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid drive ID format.',
      });
    }

    const drive = await PlacementDrive.findById(id).populate('company');
    if (!drive) {
      return res.status(404).json({
        success: false,
        message: 'Placement drive not found.',
      });
    }

    // College isolation check: deny access to another college's drive
    if (
      !drive.collegeId ||
      drive.collegeId.toString() !== req.user.collegeId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Access to placement drives outside your college is forbidden.',
      });
    }

    // Retrieve applications for this drive
    const applications = await DriveApplication.find({ placementDrive: drive._id })
      .populate('student', 'name email')
      .sort({ createdAt: -1 });

    // Retrieve corresponding academic profiles without assuming fields are on User
    const studentUserIds = applications
      .map((app) => (app.student ? app.student._id : null))
      .filter(Boolean);

    const profiles = await StudentProfile.find({ user: { $in: studentUserIds } })
      .select('user rollNumber department course batch cgpa backlogs skills resumeUrl');

    const profileMap = new Map();
    profiles.forEach((p) => {
      profileMap.set(p.user.toString(), p);
    });

    const formattedApplications = applications.map((app) => {
      const studentObj = app.student
        ? {
            _id: app.student._id,
            name: app.student.name,
            email: app.student.email,
          }
        : null;

      const profile = app.student ? profileMap.get(app.student._id.toString()) : null;

      const academicProfile = profile
        ? {
            rollNumber: profile.rollNumber || null,
            department: profile.department || null,
            course: profile.course || null,
            batch: profile.batch || null,
            cgpa: profile.cgpa !== undefined ? profile.cgpa : null,
            backlogs: profile.backlogs !== undefined ? profile.backlogs : null,
            skills: profile.skills || [],
            resumeUrl: profile.resumeUrl || null,
          }
        : null;

      return {
        _id: app._id,
        placementDrive: app.placementDrive,
        status: app.status,
        appliedAt: app.createdAt,
        student: studentObj,
        academicProfile,
      };
    });

    res.status(200).json({
      success: true,
      drive: {
        _id: drive._id,
        jobRole: drive.jobRole,
        driveDate: drive.driveDate,
        company: drive.company,
      },
      count: formattedApplications.length,
      applications: formattedApplications,
      applicants: formattedApplications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status
// @route   PATCH /api/officer/applications/:id/status
// @access  Private (Placement Officer)
const updateApplicationStatus = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const { status } = req.body;
    const ALLOWED_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'];

    if (!status || typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing status. Supported values are: ${ALLOWED_STATUSES.join(', ')}.`,
      });
    }

    const application = await DriveApplication.findById(id)
      .populate({
        path: 'placementDrive',
        populate: { path: 'company', select: 'name' },
      })
      .populate('student', 'name email collegeId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    // Verify application belongs to a drive within the officer's college
    const applicationCollegeId =
      (application.placementDrive && application.placementDrive.collegeId) ||
      application.collegeId;

    if (
      !applicationCollegeId ||
      applicationCollegeId.toString() !== req.user.collegeId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot update application status for a drive outside your college.',
      });
    }

    // Duplicate prevention: if status has not changed, do not create duplicate notification
    if (application.status === status) {
      return res.status(200).json({
        success: true,
        message: `Application status is already ${status}.`,
        application,
      });
    }

    const previousStatus = application.status;
    application.status = status;
    await application.save();

    // Create persistent notification for the affected student
    try {
      const jobRole = (application.placementDrive && application.placementDrive.jobRole) || 'Placement Drive';
      const companyName =
        (application.placementDrive &&
          application.placementDrive.company &&
          application.placementDrive.company.name) ||
        'Company';
      const studentId = application.student ? (application.student._id || application.student) : null;

      if (studentId) {
        // Enforce tenant integrity: recipient must match officer's college
        const studentCollegeId = application.student.collegeId || applicationCollegeId;
        if (studentCollegeId && studentCollegeId.toString() === req.user.collegeId.toString()) {
          await Notification.create({
            recipient: studentId,
            collegeId: req.user.collegeId,
            title: `Application Status Updated: ${jobRole}`,
            message: `Your application for ${jobRole} at ${companyName} has been updated to "${status}".`,
            type: 'STATUS_UPDATE',
            placementDrive: application.placementDrive ? application.placementDrive._id : undefined,
            application: application._id,
            isRead: false,
          });
        }
      }
    } catch (notificationError) {
      console.error('[Notification Creation Error]:', notificationError.message);
      // Compensating rollback for database consistency if notification creation fails
      application.status = previousStatus;
      await application.save();
      return res.status(500).json({
        success: false,
        message: 'Failed to record notification for status update. Status change was rolled back.',
        error: notificationError.message,
      });
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}.`,
      application,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive a placement drive (officer only)
// @route   PATCH /api/officer/drives/:id/archive
// @access  Private (Placement Officer)
const archiveDrive = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid drive ID format.' });
    }

    const drive = await PlacementDrive.findById(id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement drive not found.' });
    }

    // Tenant isolation: must belong to officer's college
    if (!drive.collegeId || drive.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot archive a drive that belongs to another institution.',
      });
    }

    if (drive.isArchived) {
      return res.status(400).json({ success: false, message: 'Drive is already archived.' });
    }

    const currentStatus = getDriveLifecycleStatus(drive);
    if (currentStatus !== 'closed') {
      return res.status(400).json({
        success: false,
        code: 'DRIVE_NOT_CLOSED',
        message: 'Only closed drives can be archived. A drive must be closed (deadline passed or manually closed) before it can be archived.',
      });
    }

    drive.isArchived = true;
    drive.isActive = false;
    drive.archivedAt = new Date();
    drive.archivedBy = req.user._id;
    await drive.save();

    res.status(200).json({
      success: true,
      message: 'Placement drive archived successfully.',
      drive: {
        ...drive.toObject(),
        status: 'archived',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore an archived placement drive (officer only)
// @route   PATCH /api/officer/drives/:id/restore
// @access  Private (Placement Officer)
const restoreDrive = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid drive ID format.' });
    }

    const drive = await PlacementDrive.findById(id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement drive not found.' });
    }

    // Tenant isolation
    if (!drive.collegeId || drive.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot restore a drive that belongs to another institution.',
      });
    }

    if (!drive.isArchived) {
      return res.status(400).json({ success: false, message: 'Drive is not currently archived.' });
    }

    drive.isArchived = false;
    drive.archivedAt = undefined;
    drive.archivedBy = undefined;
    drive.isActive = true;
    await drive.save();

    const restoredStatus = getDriveLifecycleStatus(drive);

    res.status(200).json({
      success: true,
      message: 'Placement drive restored successfully.',
      drive: {
        ...drive.toObject(),
        status: restoredStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete an archived drive with zero dependent records (officer only)
// @route   DELETE /api/officer/drives/:id
// @access  Private (Placement Officer)
const deleteDrive = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid drive ID format.' });
    }

    // Verify drive exists and is accessible to this officer's college
    const drive = await PlacementDrive.findById(id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement drive not found.' });
    }

    // Tenant isolation check
    if (!drive.collegeId || drive.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Cannot delete a drive that belongs to another institution.',
      });
    }

    // Gate 1: Drive must be archived before permanent deletion
    if (!drive.isArchived) {
      return res.status(400).json({
        success: false,
        code: 'DRIVE_NOT_ARCHIVED',
        message: 'Drive must be archived before it can be permanently deleted. Archive the drive first.',
      });
    }

    // Gate 2: No dependent records (DriveApplication or DriveAttendance) (HTTP 409 Conflict)
    for (const dep of DRIVE_DEPENDENTS) {
      const depCount = await dep.model.countDocuments(dep.query(id));
      if (depCount > 0) {
        return res.status(409).json({
          success: false,
          code: 'DRIVE_DELETE_BLOCKED_DEPENDENT_RECORDS',
          message: `Cannot permanently delete this drive because ${depCount} ${dep.name}(s) exist. We recommend keeping the drive archived to preserve recruitment and applicant records.`,
        });
      }
    }

    // Atomic delete: re-checks tenant + isArchived in the query to guard against concurrent requests
    const deleted = await PlacementDrive.findOneAndDelete({
      _id: id,
      collegeId: req.user.collegeId,
      isArchived: true,
    });

    if (!deleted) {
      // Drive was concurrently deleted or conditions changed — idempotent response
      return res.status(404).json({
        success: false,
        code: 'DRIVE_NOT_FOUND',
        message: 'Placement drive not found or no longer meets deletion criteria.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Placement drive permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDrive,
  getOfficerDrives,
  getDriveApplicants,
  updateApplicationStatus,
  archiveDrive,
  restoreDrive,
  deleteDrive,
  validateCompanyLocation,
  validateOfficerCollegeContext,
};
