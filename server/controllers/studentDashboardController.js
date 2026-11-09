const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const StudentProfile = require('../models/StudentProfile');
const { checkEligibility } = require('../utils/eligibilityEngine');
const { getDriveLifecycleStatus, getDriveStatusQuery } = require('../utils/driveLifecycle');
const { getStudentOutcomesService } = require('../services/studentOutcomesService');

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

    // 4. Query active and open placement drives strictly for this student's college (excluding archived/closed)
    const now = new Date();
    const activeQuery = getDriveStatusQuery('active', collegeId, now);
    const activeDrives = await PlacementDrive.find(activeQuery).select('eligibilityCriteria');

    // Calculate eligible drives using the existing eligibility engine
    let totalEligibleDrives = 0;
    for (const drive of activeDrives) {
      const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
      if (eligibility && eligibility.isEligible) {
        totalEligibleDrives += 1;
      }
    }

    // 5. Fetch latest 3 active, non-archived drives strictly for this student's college, sorted by createdAt descending
    const latestDrivesRaw = await PlacementDrive.find({
      collegeId: collegeId,
      isActive: true,
      isArchived: false,
    })
      .populate('company', 'name logoUrl industry')
      .sort({ createdAt: -1 })
      .limit(3);

    const latestDriveCreatedAt = latestDrivesRaw.length > 0 ? latestDrivesRaw[0].createdAt : null;

    // Check application status for these latest drives
    const latestDriveIds = latestDrivesRaw.map((d) => d._id);
    const existingApps = await DriveApplication.find({
      student: studentId,
      placementDrive: { $in: latestDriveIds },
    }).select('placementDrive');
    const appliedDriveSet = new Set(existingApps.map((a) => a.placementDrive.toString()));

    const latestDrives = latestDrivesRaw.map((drive) => {
      const eligibility = checkEligibility(studentProfile, drive.eligibilityCriteria);
      const hasApplied = appliedDriveSet.has(drive._id.toString());
      return {
        ...drive.toObject(),
        status: getDriveLifecycleStatus(drive, now),
        eligibility,
        hasApplied,
      };
    });

    // 6. Query applications submitted by this student within their college
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

    // 7. Fetch verified outcomes and pending selections for the student
    const outcomesData = await getStudentOutcomesService({
      studentId,
      collegeId,
    });

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
      latestDrives,
      latestDriveCreatedAt,
      verifiedOutcomes: outcomesData.verifiedOutcomes,
      pendingSelections: outcomesData.pendingSelections,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student verified placement outcomes and pending selections
// @route   GET /api/student/dashboard/outcomes
// @access  Private (Student)
const getStudentOutcomes = async (req, res, next) => {
  try {
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    if (req.user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    const data = await getStudentOutcomesService({
      studentId: req.user._id,
      collegeId: req.user.collegeId,
    });

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentDashboardSummary,
  getStudentOutcomes,
};
