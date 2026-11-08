const mongoose = require('mongoose');
const DriveApplication = require('../models/DriveApplication');
const PlacementOutcome = require('../models/PlacementOutcome');
const Notification = require('../models/Notification');

const ALLOWED_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'];

/**
 * Single choke point for all DriveApplication status modifications.
 * Guarantees that no application with a verified PlacementOutcome can have its status changed.
 * Scope checks strictly precede lock checks (cross-tenant requests return 404, never 409).
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.applicationId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {string} params.status Target application status
 * @param {Object} params.officerUser Authenticated officer user
 * @returns {Promise<{ status: number, data?: Object, error?: Object }>}
 */
async function changeApplicationStatus({ applicationId, collegeId, status, officerUser }) {
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return {
      status: 400,
      error: { code: 'INVALID_APPLICATION_ID', message: 'Invalid application ID format.' },
    };
  }

  if (!status || typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
    return {
      status: 400,
      error: {
        code: 'INVALID_STATUS',
        message: `Invalid or missing status. Supported values are: ${ALLOWED_STATUSES.join(', ')}.`,
      },
    };
  }

  // 1. Scoped lookup by _id + collegeId (tenant scope check strictly runs before lock check)
  const application = await DriveApplication.findOne({
    _id: applicationId,
    collegeId,
  })
    .populate({
      path: 'placementDrive',
      populate: { path: 'company', select: 'name' },
    })
    .populate('student', 'name email collegeId');

  if (!application) {
    return {
      status: 404,
      error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
    };
  }

  // 2. Lock check: Guard flag OR legacy check for verified PlacementOutcome without backfill
  let isLocked = application.outcomeVerified === true;
  if (!isLocked) {
    const existingVerifiedOutcome = await PlacementOutcome.findOne({
      application: applicationId,
      collegeId,
      status: 'verified',
    });
    if (existingVerifiedOutcome) {
      isLocked = true;
    }
  }

  // Any attempt to change status of a locked application (including setting the same status) returns 409
  if (isLocked) {
    return {
      status: 409,
      error: {
        code: 'VERIFIED_OUTCOME_EXISTS',
        message:
          'This application has a verified placement outcome. An officer must revoke the outcome before modifying application status.',
      },
    };
  }

  // 3. Duplicate check (only after lock check passes): if same status, return idempotent success
  if (application.status === status) {
    return {
      status: 200,
      data: {
        success: true,
        message: `Application status is already ${status}.`,
        application,
      },
    };
  }

  // 4. Atomic conditional write: write only if outcomeVerified is not true (the commit point)
  const updatedApplication = await DriveApplication.findOneAndUpdate(
    {
      _id: applicationId,
      collegeId,
      outcomeVerified: { $ne: true },
    },
    {
      $set: { status },
    },
    { new: true }
  )
    .populate({
      path: 'placementDrive',
      populate: { path: 'company', select: 'name' },
    })
    .populate('student', 'name email collegeId');

  if (!updatedApplication) {
    // Condition failed due to concurrent modification: re-read and classify
    const reRead = await DriveApplication.findOne({ _id: applicationId, collegeId });
    if (!reRead) {
      return {
        status: 404,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      };
    }
    return {
      status: 409,
      error: {
        code: 'VERIFIED_OUTCOME_EXISTS',
        message:
          'This application has a verified placement outcome. An officer must revoke the outcome before modifying application status.',
      },
    };
  }

  // 5. Best-effort side-effects: status write has committed and must never roll back
  let notificationCreated = false;
  try {
    const persistedStatus = updatedApplication.status;
    const jobRole =
      (updatedApplication.placementDrive && updatedApplication.placementDrive.jobRole) ||
      'Placement Drive';
    const companyName =
      (updatedApplication.placementDrive &&
        updatedApplication.placementDrive.company &&
        updatedApplication.placementDrive.company.name) ||
      'Company';
    const studentId = updatedApplication.student
      ? updatedApplication.student._id || updatedApplication.student
      : null;

    if (studentId) {
      const studentCollegeId = updatedApplication.student.collegeId || collegeId;
      if (studentCollegeId && studentCollegeId.toString() === collegeId.toString()) {
        await Notification.create({
          recipient: studentId,
          collegeId,
          title: `Application Status Updated: ${jobRole}`,
          message: `Your application for ${jobRole} at ${companyName} has been updated to "${persistedStatus}".`,
          type: 'STATUS_UPDATE',
          placementDrive: updatedApplication.placementDrive
            ? updatedApplication.placementDrive._id
            : undefined,
          application: updatedApplication._id,
          isRead: false,
        });
        notificationCreated = true;
      }
    }
  } catch (notificationError) {
    // Log failure with sanitized metadata; never log student details, tokens, or full error objects
    console.error('[Notification Dispatch Failure]:', {
      applicationId: applicationId.toString(),
      collegeId: collegeId.toString(),
      type: 'STATUS_UPDATE',
      errorName: notificationError.name || 'Error',
      errorCode: notificationError.code || null,
      errorMessage: (notificationError.message || '').substring(0, 200),
    });
  }

  return {
    status: 200,
    data: {
      success: true,
      message: `Application status updated to ${status}.`,
      application: updatedApplication,
      notificationCreated,
    },
  };
}

/**
 * Validates whether an application can be safely deleted or removed.
 * Refuses deletion with 409 if application is locked or has a verified outcome.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.applicationId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @returns {Promise<{ allowed: boolean, status?: number, error?: Object }>}
 */
async function validateApplicationDeletion({ applicationId, collegeId }) {
  const application = await DriveApplication.findOne({ _id: applicationId, collegeId });
  if (!application) {
    return { allowed: false, status: 404, error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' } };
  }

  if (application.outcomeVerified === true) {
    return {
      allowed: false,
      status: 409,
      error: {
        code: 'VERIFIED_OUTCOME_EXISTS',
        message: 'This application has a verified placement outcome. An officer must revoke the outcome before deleting the application.',
      },
    };
  }

  const existingVerifiedOutcome = await PlacementOutcome.findOne({
    application: applicationId,
    collegeId,
    status: 'verified',
  });

  if (existingVerifiedOutcome) {
    return {
      allowed: false,
      status: 409,
      error: {
        code: 'VERIFIED_OUTCOME_EXISTS',
        message: 'This application has a verified placement outcome. An officer must revoke the outcome before deleting the application.',
      },
    };
  }

  return { allowed: true };
}

/**
 * Bulk status update routing helper.
 * Filters locked applications out and reports them as 409 per item.
 * 
 * @param {Object} params
 * @param {Array<{ applicationId: string, status: string }>} params.items
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {Object} params.officerUser
 * @returns {Promise<Array<Object>>}
 */
async function bulkChangeApplicationStatus({ items, collegeId, officerUser }) {
  if (!Array.isArray(items)) return [];
  const results = [];
  for (const item of items) {
    const res = await changeApplicationStatus({
      applicationId: item.applicationId,
      collegeId,
      status: item.status,
      officerUser,
    });
    results.push({
      applicationId: item.applicationId,
      status: res.status,
      ...(res.error ? { error: res.error } : { data: res.data }),
    });
  }
  return results;
}

module.exports = {
  changeApplicationStatus,
  validateApplicationDeletion,
  bulkChangeApplicationStatus,
  ALLOWED_STATUSES,
};
