const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const { checkEligibility, resolveUgBasis } = require('../utils/eligibilityEngine');

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

    // Fetch active drives scoped to the student's college and populate company details
    const drives = await PlacementDrive.find({ 
      isActive: true,
      collegeId: req.user.collegeId 
    })
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

    res.status(200).json({
      success: true,
      count: drivesWithEligibility.length,
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

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
    
    const existingApplication = await DriveApplication.findOne({ 
      student: req.user._id, 
      placementDrive: drive._id 
    });

    const effectiveUgCriteriaType = resolveUgBasis(drive.eligibilityCriteria);
    const driveObj = drive.toObject();

    res.status(200).json({
      success: true,
      drive: {
        ...driveObj,
        effectiveUgCriteriaType,
        eligibilityCriteria: {
          ...driveObj.eligibilityCriteria,
          effectiveUgCriteriaType,
        },
        eligibility,
        hasApplied: !!existingApplication,
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
