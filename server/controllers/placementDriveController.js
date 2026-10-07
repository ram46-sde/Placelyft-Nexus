const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const { checkEligibility } = require('../utils/eligibilityEngine');

// @desc    Get all active placement drives with eligibility status
// @route   GET /api/student/drives
// @access  Private (Student)
const getAvailableDrives = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ user: req.user._id });

    // Fetch active drives and populate company details
    const drives = await PlacementDrive.find({ isActive: true })
      .populate('company', 'name logoUrl industry')
      .sort({ driveDate: 1 });

    // Fetch student's existing applications
    const applications = await DriveApplication.find({ student: req.user._id });
    const appliedDriveIds = applications.map(app => app.placementDrive.toString());

    // Process drives to include eligibility logic and application status
    const drivesWithEligibility = drives.map((drive) => {
      const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
      const hasApplied = appliedDriveIds.includes(drive._id.toString());
      
      return {
        ...drive.toObject(),
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

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
    
    const existingApplication = await DriveApplication.findOne({ 
      student: req.user._id, 
      placementDrive: drive._id 
    });

    res.status(200).json({
      success: true,
      drive: {
        ...drive.toObject(),
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
