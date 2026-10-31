const { validateOfficerCollegeContext } = require('./officerController');
const {
  getDriveAttendanceService,
  markDriveAttendanceService,
} = require('../services/driveAttendanceService');

/**
 * @desc    Get department-wise attendance for a placement drive
 * @route   GET /api/officer/drives/:id/attendance
 * @access  Private (Placement Officer)
 */
const getDriveAttendance = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    const includeHistory = req.query.includeHistory === 'true';

    const result = await getDriveAttendanceService({
      driveId: id,
      collegeId: req.user.collegeId,
      includeHistory,
    });

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        ...result.error,
      });
    }

    return res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark attendance for applicants of a placement drive
 * @route   POST /api/officer/drives/:id/attendance/mark
 * @access  Private (Placement Officer)
 */
const markDriveAttendance = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { id } = req.params;
    // Strict whitelist: only take entries from body; ignore client collegeId, markedBy, history, student, onBehalfOf
    const entries = req.body?.entries;

    const result = await markDriveAttendanceService({
      driveId: id,
      collegeId: req.user.collegeId,
      officerUser: req.user,
      entries,
    });

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        ...result.error,
      });
    }

    return res.status(result.status).json(result.data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDriveAttendance,
  markDriveAttendance,
};
