const DriveApplication = require('../models/DriveApplication');
const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const Company = require('../models/Company');
const { checkEligibility } = require('../utils/eligibilityEngine');

// @desc    Apply for a placement drive
// @route   POST /api/student/applications/:driveId
// @access  Private (Student)
const applyForDrive = async (req, res, next) => {
  try {
    const driveId = req.params.driveId;

    // 1. Verify Drive exists and is active
    const drive = await PlacementDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement drive not found.' });
    }

    if (drive.collegeId && req.user.collegeId && drive.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this placement drive.' });
    }
    if (!drive.isActive) {
      return res.status(400).json({ success: false, message: 'This placement drive is no longer active.' });
    }
    if (new Date() > new Date(drive.registrationDeadline)) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed.' });
    }

    // 2. Check if student already applied
    const existingApplication = await DriveApplication.findOne({
      student: req.user._id,
      placementDrive: driveId,
    });

    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'You have already applied to this drive.' });
    }

    // 3. Verify Eligibility dynamically (Double check backend security)
    const profile = await StudentProfile.findOne({ user: req.user._id });
    const eligibility = checkEligibility(profile, drive.eligibilityCriteria);

    if (!eligibility.isEligible) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to apply for this drive.',
        reasons: eligibility.reasons,
      });
    }

    // 4. Create Application
    const application = await DriveApplication.create({
      student: req.user._id,
      placementDrive: driveId,
      status: 'Applied',
    });

    res.status(201).json({
      success: true,
      message: 'Successfully applied to the placement drive.',
      application,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications for the logged-in student
// @route   GET /api/student/applications
// @access  Private (Student)
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await DriveApplication.find({ student: req.user._id })
      .populate({
        path: 'placementDrive',
        select: 'jobRole driveDate registrationDeadline company',
        populate: {
          path: 'company',
          select: 'name logoUrl',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyForDrive,
  getMyApplications,
};
