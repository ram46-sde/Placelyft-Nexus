const { validateOfficerCollegeContext } = require('./officerController');
const {
  verifyOutcomeService,
  revokeOutcomeService,
  getOutcomeHistoryService,
} = require('../services/placementOutcomeService');

/**
 * @desc    Verify placement outcome for a selected applicant
 * @route   POST /api/officer/outcomes/:applicationId/verify
 * @access  Private (Placement Officer)
 */
const verifyOutcome = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { applicationId } = req.params;
    // Strict whitelist: take only ctc from body; ignore client collegeId, student, drive, verifiedBy, etc.
    const { ctc } = req.body || {};

    const result = await verifyOutcomeService({
      applicationId,
      collegeId: req.user.collegeId,
      officerUser: req.user,
      ctc,
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
 * @desc    Revoke placement outcome for an applicant
 * @route   POST /api/officer/outcomes/:applicationId/revoke
 * @access  Private (Placement Officer)
 */
const revokeOutcome = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { applicationId } = req.params;
    // Strict whitelist: take only reason from body; ignore client collegeId, officer, etc.
    const { reason } = req.body || {};

    const result = await revokeOutcomeService({
      applicationId,
      collegeId: req.user.collegeId,
      officerUser: req.user,
      reason,
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
 * @desc    Get chronological audit history for a placement outcome
 * @route   GET /api/officer/outcomes/:applicationId/history
 * @access  Private (Placement Officer)
 */
const getOutcomeHistory = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const { applicationId } = req.params;

    const result = await getOutcomeHistoryService({
      applicationId,
      collegeId: req.user.collegeId,
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
  verifyOutcome,
  revokeOutcome,
  getOutcomeHistory,
};
