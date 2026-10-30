const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const StudentProfile = require('../models/StudentProfile');
const { checkEligibility } = require('../utils/eligibilityEngine');

// @desc    Get aggregated metrics summary for the authenticated student's dashboard
// @route   GET /api/student/dashboard/summary
// @access  Private (Student)
const getStudentDashboardSummary = async (req, res, next) => {
  try {
    // 1. Verify student account is associated with a college
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    // 2. Reject unverified legacy assignments
    if (req.user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    const studentId = req.user._id;
    const collegeId = req.user.collegeId;

    // 3. Fetch student's academic profile for eligibility evaluation
    const studentProfile = await StudentProfile.findOne({ user: studentId });

    // 4. Query active and open placement drives strictly for this student's college
    const now = new Date();
    const activeDrives = await PlacementDrive.find({
      isActive: true,
      collegeId: collegeId,
      $or: [
        { registrationDeadline: { $gte: now } },
        { registrationDeadline: { $exists: false } },
        { registrationDeadline: null },
      ],
    }).select('eligibilityCriteria');

    // Calculate eligible drives using the existing eligibility engine
    let totalEligibleDrives = 0;
    for (const drive of activeDrives) {
      const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
      if (eligibility && eligibility.isEligible) {
        totalEligibleDrives += 1;
      }
    }

    // 5. Query applications submitted by this student within their college
    const applications = await DriveApplication.find({
      student: studentId,
    }).populate('placementDrive', 'collegeId');

    let registeredApplications = 0;
    let inProgressApplications = 0;
    let selectedApplications = 0;

    for (const app of applications) {
      const appCollegeId = app.collegeId || (app.placementDrive && app.placementDrive.collegeId);
      // Multi-tenant check: ignore applications outside this student's college
      if (appCollegeId && appCollegeId.toString() !== collegeId.toString()) {
        continue;
      }

      registeredApplications += 1;

      if (app.status === 'Shortlisted' || app.status === 'Interviewing') {
        inProgressApplications += 1;
      } else if (app.status === 'Selected') {
        selectedApplications += 1;
      }
    }

    res.status(200).json({
      success: true,
      totalEligibleDrives,
      registeredApplications,
      inProgressApplications,
      selectedApplications,
      summary: {
        totalEligibleDrives,
        registeredApplications,
        inProgressApplications,
        selectedApplications,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentDashboardSummary,
};
