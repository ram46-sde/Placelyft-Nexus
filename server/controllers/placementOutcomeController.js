const { validateOfficerCollegeContext } = require('./officerController');
const {
  verifyOutcomeService,
  revokeOutcomeService,
  getOutcomeHistoryService,
} = require('../services/placementOutcomeService');
const {
  getOutcomesQueueService,
  getVerifiedOutcomesListService,
} = require('../services/placementOutcomeListService');

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

/**
 * @desc    Get paginated queue of Selected applications awaiting outcome verification
 * @route   GET /api/officer/outcomes/queue
 * @access  Private (Placement Officer)
 */
const getOutcomesQueue = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const data = await getOutcomesQueueService({
      collegeId: req.user.collegeId,
      query: req.query || {},
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated list of confirmed verified placement outcomes
 * @route   GET /api/officer/outcomes
 * @access  Private (Placement Officer)
 */
const getVerifiedOutcomes = async (req, res, next) => {
  try {
    const contextCheck = validateOfficerCollegeContext(req.user);
    if (!contextCheck.valid) {
      return res.status(contextCheck.status).json({
        success: false,
        message: contextCheck.message,
      });
    }

    const data = await getVerifiedOutcomesListService({
      collegeId: req.user.collegeId,
      query: req.query || {},
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyOutcome,
  revokeOutcome,
  getOutcomeHistory,
  getOutcomesQueue,
  getVerifiedOutcomes,
};
