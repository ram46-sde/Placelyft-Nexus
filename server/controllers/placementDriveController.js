const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const { checkEligibility, resolveUgBasis } = require('../utils/eligibilityEngine');
const { getDriveLifecycleStatus, getDriveStatusQuery } = require('../utils/driveLifecycle');

// @desc    Get all active placement drives with eligibility status
// @route   GET /api/student/drives
// @access  Private (Student)
const getAvailableDrives = async (req, res, next) => {
  try {
    if (!req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    const now = new Date();

    // Fetch active, non-archived, open drives scoped to the student's college
    const activeQuery = getDriveStatusQuery('active', req.user.collegeId, now);
    const drives = await PlacementDrive.find(activeQuery)
      .populate('company', 'name logoUrl industry')
      .sort({ driveDate: 1 });

    // Fetch student's existing applications
    const applications = await DriveApplication.find({ student: req.user._id });
    const appliedDriveIds = applications.map(app => app.placementDrive.toString());

    // Process drives to include eligibility logic and application status
    const drivesWithEligibility = drives.map((drive) => {
      const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
      const hasApplied = appliedDriveIds.includes(drive._id.toString());
      const driveObj = drive.toObject();
      const effectiveUgCriteriaType = resolveUgBasis(drive.eligibilityCriteria);
      
      return {
        ...driveObj,
        effectiveUgCriteriaType,
        eligibilityCriteria: {
          ...driveObj.eligibilityCriteria,
          effectiveUgCriteriaType,
        },
        eligibility,
        hasApplied,
      };
    });

    // Retrieve latest published non-archived drive timestamp for navigation badge watermark
    const latestDrive = await PlacementDrive.findOne({
      isActive: true,
      isArchived: false,
      collegeId: req.user.collegeId,
    })
      .sort({ createdAt: -1 })
      .select('createdAt');

    res.status(200).json({
      success: true,
      count: drivesWithEligibility.length,
      latestDriveCreatedAt: latestDrive ? latestDrive.createdAt : null,
      drives: drivesWithEligibility,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single drive details by ID
// @route   GET /api/student/drives/:id
// @access  Private (Student)
const getDriveById = async (req, res, next) => {
  try {
    const drive = await PlacementDrive.findById(req.params.id).populate('company');

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: 'Placement drive not found.',
      });
    }

    // Verify multi-tenant data isolation:
    // Both the drive and the user MUST have a valid collegeId, and they must match.
    if (
      !drive.collegeId ||
      !req.user.collegeId ||
      drive.collegeId.toString() !== req.user.collegeId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this placement drive.',
      });
    }

    const existingApplication = await DriveApplication.findOne({ 
      student: req.user._id, 
      placementDrive: drive._id 
    });

    // Option 1: Archived drives are accessible in read-only mode strictly if the student has applied.
    // Students without an existing application remain blocked.
    if (drive.isArchived && !existingApplication) {
      return res.status(403).json({
        success: false,
        code: 'DRIVE_ARCHIVED',
        message: 'Unauthorized access to this placement drive.',
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
    
    const effectiveUgCriteriaType = resolveUgBasis(drive.eligibilityCriteria);
    const driveObj = drive.toObject();
    const status = getDriveLifecycleStatus(drive, new Date());

    res.status(200).json({
      success: true,
      drive: {
        ...driveObj,
        status,
        effectiveUgCriteriaType,
        eligibilityCriteria: {
          ...driveObj.eligibilityCriteria,
          effectiveUgCriteriaType,
        },
        eligibility,
        hasApplied: !!existingApplication,
        isReadOnly: !!drive.isArchived || status === 'closed',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableDrives,
  getDriveById,
};
