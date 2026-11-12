const mongoose = require('mongoose');
const PlacementOutcome = require('../models/PlacementOutcome');
const DriveApplication = require('../models/DriveApplication');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const Notification = require('../models/Notification');
const { resolveDepartment, fetchCollegeDepartments } = require('../utils/departmentResolver');
const departmentCoordination = require('../utils/departmentCoordination');

/**
 * Validates candidate CTC input according to Phase 4A specification:
 * - JSON number, finite, greater than 0, at most 200, at most 2 decimals
 * - Strings, NaN, Infinity, 0, and negatives rejected
 * - undefined or null returns null (meaning "not specified")
 * 
 * @param {*} ctc 
 * @returns {{ valid: boolean, parsedCtc?: number|null, error?: string }}
 */
function validateOfferPackageCtc(ctc) {
  if (ctc === undefined || ctc === null) {
    return { valid: true, parsedCtc: null };
  }

  if (typeof ctc !== 'number' || !Number.isFinite(ctc) || Number.isNaN(ctc)) {
    return { valid: false, error: 'CTC must be a valid finite JSON number.' };
  }

  if (ctc < 0) {
    return { valid: false, error: 'CTC cannot be negative.' };
  }

  if (ctc > 200) {
    return { valid: false, error: 'CTC must be at most 200 LPA.' };
  }

  const ctcStr = ctc.toString();
  if (ctcStr.includes('.')) {
    const decimalPart = ctcStr.split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      return { valid: false, error: 'CTC can have at most 2 decimal places.' };
    }
  }

  return { valid: true, parsedCtc: ctc };
}

/**
 * Validates revocation reason according to Phase 4A specification:
 * - Plain text string, trimmed, 10 to 500 characters
 * 
 * @param {*} reason 
 * @returns {{ valid: boolean, trimmedReason?: string, error?: string }}
 */
function validateRevokeReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return { valid: false, error: 'Revocation reason must be a plain text string.' };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { valid: false, error: 'Revocation reason must be at least 10 characters.' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Revocation reason cannot exceed 500 characters.' };
  }

  return { valid: true, trimmedReason: trimmed };
}

/**
 * Strict whitelist presentation formatter for placement outcome responses.
 * Guarantees that no student email, phone, CGPA, resume, or sensitive personal data is leaked.
 * 
 * Whitelist shape:
 * { outcomeId, applicationId, status, verifiedAt, verifiedBy: { name }, offerPackage, departmentSnapshot, result }
 * 
 * @param {Object} doc Mongoose document or populated object
 * @param {string} result Transition result
 * @returns {Object} Whitelisted presentation object
 */
function formatOutcomeResponse(doc, result, notificationCreated) {
  if (!doc) return null;

  let officerName = 'Placement Officer';
  if (doc.verifiedBy) {
    if (typeof doc.verifiedBy === 'object' && doc.verifiedBy.name) {
      officerName = doc.verifiedBy.name;
    } else if (doc.verifiedByName) {
      officerName = doc.verifiedByName;
    }
  }

  const response = {
    outcomeId: doc._id ? doc._id.toString() : null,
    applicationId: doc.application
      ? (doc.application._id ? doc.application._id.toString() : doc.application.toString())
      : null,
    status: doc.status,
    verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt).toISOString() : null,
    verifiedBy: doc.verifiedBy ? { name: officerName } : null,
    offerPackage: {
      ctc: doc.offerPackage && doc.offerPackage.ctc !== undefined ? doc.offerPackage.ctc : null,
      unit: (doc.offerPackage && doc.offerPackage.unit) || 'LPA',
      currency: (doc.offerPackage && doc.offerPackage.currency) || 'INR',
    },
    departmentSnapshot: {
      departmentId: doc.departmentSnapshot && doc.departmentSnapshot.departmentId
        ? doc.departmentSnapshot.departmentId.toString()
        : null,
      departmentName: (doc.departmentSnapshot && doc.departmentSnapshot.departmentName) || 'Unassigned / Other',
      departmentCode: (doc.departmentSnapshot && doc.departmentSnapshot.departmentCode) || null,
      resolutionStatus: (doc.departmentSnapshot && doc.departmentSnapshot.resolutionStatus) || 'unassigned',
    },
    result,
  };

  if (notificationCreated !== undefined) {
    response.notificationCreated = notificationCreated;
  }

  return response;
}

/**
 * Dispatches point-in-time OUTCOME_VERIFIED notification with strict idempotent eventKey.
 * Post-commit guarded block: never throws or disrupts verified outcome mutation.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.outcomeId
 * @param {mongoose.Types.ObjectId|string} params.eventId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @param {mongoose.Types.ObjectId|string} params.collegeId
 * @param {mongoose.Types.ObjectId|string} [params.placementDriveId]
 * @param {mongoose.Types.ObjectId|string} [params.applicationId]
 * @param {Date|string} [params.verifiedAt]
 * @returns {Promise<{ success: boolean, notificationCreated: boolean, duplicate?: boolean }>}
 */
async function dispatchOutcomeVerifiedNotification({
  outcomeId,
  eventId,
  studentId,
  collegeId,
  placementDriveId,
  applicationId,
  verifiedAt,
}) {
  if (!outcomeId || !eventId || !studentId || !collegeId) {
    return { success: false, notificationCreated: false };
  }

  const eventKey = `outcome_verified:${outcomeId}:${eventId}`;

  try {
    let companyName = 'Company';
    let jobRole = 'Role';

    if (placementDriveId) {
      const drive = await PlacementDrive.findById(placementDriveId)
        .populate('company', 'name')
        .select('jobRole company');
      if (drive) {
        jobRole = drive.jobRole || 'Role';
        if (drive.company && drive.company.name) {
          companyName = drive.company.name;
        }
      }
    }

    const dateStr = new Date(verifiedAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const title = 'Placement Outcome Verified';
    const message = `Your placement outcome for ${companyName} (${jobRole}) was verified on ${dateStr}.`;

    await Notification.create({
      recipient: studentId,
      collegeId,
      title,
      message,
      type: 'OUTCOME_VERIFIED',
      placementDrive: placementDriveId || undefined,
      application: applicationId || undefined,
      eventKey,
      isRead: false,
    });

    return { success: true, notificationCreated: true };
  } catch (notifErr) {
    // Duplicate-key error on eventKey: already created, treat as success, do not log as failure
    if (
      notifErr.code === 11000 &&
      (notifErr.keyPattern?.eventKey ||
        (notifErr.message && notifErr.message.includes('eventKey')))
    ) {
      return { success: true, notificationCreated: true, duplicate: true };
    }

    console.error('[Notification Dispatch Failure]:', {
      outcomeId: outcomeId ? outcomeId.toString() : null,
      collegeId: collegeId ? collegeId.toString() : null,
      type: 'OUTCOME_VERIFIED',
      errorName: notifErr.name || 'Error',
      errorCode: notifErr.code || null,
      errorMessage: (notifErr.message || '').substring(0, 200),
    });

    return { success: false, notificationCreated: false };
  }
}

/**
 * Centralized mutation service function for placement outcomes.
 * Single entry point for all outcome state transitions: verify, already_verified, reverify, revoke, already_revoked.
 * Strictly guarantees that no code path may replace, truncate, or edit history.
 * 
 * @param {Object} params
 * @param {'verify'|'revoke'} params.action Action to perform
 * @param {string|mongoose.Types.ObjectId} params.applicationId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {Object} params.officerUser Authenticated officer user
 * @param {number} [params.ctc] Offer package CTC in LPA (for verify)
 * @param {string} [params.reason] Revocation reason (for revoke)
 * @returns {Promise<{ status: number, data?: Object, error?: Object }>}
 */
async function mutateOutcomeService({
  action,
  applicationId,
  collegeId,
  officerUser,
  ctc,
  reason,
}) {
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return {
      status: 400,
      error: { code: 'INVALID_APPLICATION_ID', message: 'Invalid application ID format.' },
    };
  }

  let claimedLock = false;

  if (action === 'verify') {
    // 1. Validate CTC parameter
    const ctcCheck = validateOfferPackageCtc(ctc);
    if (!ctcCheck.valid) {
      return {
        status: 400,
        error: { code: 'INVALID_CTC', message: ctcCheck.error },
      };
    }
    const parsedCtc = ctcCheck.parsedCtc;

    // 2. Atomic claim on DriveApplication: claim lock only if Selected and not already verified
    const claimResult = await DriveApplication.updateOne(
      {
        _id: applicationId,
        collegeId,
        status: 'Selected',
        outcomeVerified: { $ne: true },
      },
      {
        $set: { outcomeVerified: true },
      }
    );

    claimedLock = claimResult.matchedCount === 1;

    let application;
    if (claimedLock) {
      application = await DriveApplication.findOne({ _id: applicationId, collegeId });
    } else {
      // Did not match: re-read and classify
      application = await DriveApplication.findOne({ _id: applicationId, collegeId });
      if (!application) {
        return {
          status: 404,
          error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
        };
      }
      if (application.status !== 'Selected') {
        return {
          status: 400,
          error: {
            code: 'APPLICATION_NOT_SELECTED',
            message: 'Only applications with status "Selected" can be verified as placement outcomes.',
          },
        };
      }
      // If status is 'Selected', already locked (outcomeVerified === true) -> continue into idempotent path
    }

    try {
      // 3. Compute Department Snapshot via pure function
      const departments = await fetchCollegeDepartments(collegeId);
      const profile = await StudentProfile.findOne({
        user: application.student,
        collegeId,
      }).lean();

      const resolved = resolveDepartment(profile, departments);
      const departmentSnapshot = {
        departmentId: resolved.departmentId || null,
        departmentName: resolved.departmentName,
        departmentCode: resolved.departmentCode || null,
        resolutionStatus: resolved.status,
      };

      // 4. Look up existing outcome
      let existing = await PlacementOutcome.findOne({
        application: applicationId,
        collegeId,
      });

      // 4a. If already verified: idempotent no-op or mismatch conflict
      // Does not write or replace departmentSnapshot -> DO NOT acquire writer token
      if (existing && existing.status === 'verified') {
        const currentCtc = existing.offerPackage ? existing.offerPackage.ctc : null;

        // Same CTC or CTC omitted: idempotent no-op (no change, no history)
        if (parsedCtc === null || parsedCtc === currentCtc) {
          // Self-heal: ensure flag is set if missing on legacy outcome
          await DriveApplication.updateOne(
            { _id: applicationId, collegeId },
            { $set: { outcomeVerified: true } }
          );

          const populated = await PlacementOutcome.findById(existing._id).populate(
            'verifiedBy',
            'name'
          );
          return {
            status: 200,
            data: formatOutcomeResponse(populated, 'already_verified', false),
          };
        }

        // Different CTC supplied: 409 OUTCOME_PACKAGE_MISMATCH (outcome stays verified, flag stays set)
        return {
          status: 409,
          error: {
            code: 'OUTCOME_PACKAGE_MISMATCH',
            message:
              'The outcome package CTC does not match the existing verified package. To change package details, revoke the outcome first and then re-verify.',
          },
        };
      }

      // 4b. Acquire writer token before writing department snapshot
      let outcomeWriterToken = null;
      if (departmentSnapshot.departmentId) {
        const tokenRes = await departmentCoordination.acquireWriterToken({
          departmentId: departmentSnapshot.departmentId,
          collegeId,
        });

        if (!tokenRes.success) {
          if (claimedLock) {
            try {
              await DriveApplication.updateOne(
                { _id: applicationId, collegeId },
                { $set: { outcomeVerified: false } }
              );
            } catch (compErr) {
              console.error('[Lock Compensation Failure]:', compErr.message);
            }
          }

          return {
            status: 409,
            error: {
              code: tokenRes.code || 'DEPARTMENT_DELETION_CONFLICT',
              message:
                tokenRes.message ||
                'Cannot verify outcome: Department is closing for deletion or inactive.',
            },
          };
        }

        outcomeWriterToken = tokenRes.writerId;
      }

      const serverTime = new Date();
      let inserted = null;
      let insertedEventId = null;
      let reverifiedDoc = null;
      let reverifyEventId = null;
      let reverifyVerifiedAt = null;

      try {
        if (!existing) {
          // Case A: No existing record -> First verification via upsert with $setOnInsert
          const eventId = new mongoose.Types.ObjectId();
          const firstHistoryEntry = {
            eventId,
            action: 'verified',
            oldStatus: null,
            newStatus: 'verified',
            changedBy: officerUser._id,
            changedAt: serverTime,
            reason: null,
            ctc: parsedCtc,
          };

          const createdRecord = await PlacementOutcome.findOneAndUpdate(
            { application: applicationId },
            {
              $setOnInsert: {
                collegeId,
                placementDrive: application.placementDrive,
                application: applicationId,
                student: application.student,
                status: 'verified',
                verifiedBy: officerUser._id,
                verifiedAt: serverTime,
                departmentSnapshot,
                offerPackage: {
                  ctc: parsedCtc,
                  unit: 'LPA',
                  currency: 'INR',
                },
                history: [firstHistoryEntry],
              },
            },
            { upsert: true, new: false } // returns null if inserted
          );

          if (!createdRecord) {
            // Successfully created first verification
            inserted = await PlacementOutcome.findOne({ application: applicationId }).populate(
              'verifiedBy',
              'name'
            );
            insertedEventId = eventId;
          } else {
            // Existed concurrently; reload and check
            existing = createdRecord;
          }
        }

        if (existing) {
          if (existing.status === 'verified') {
            // Concurrently verified by another worker
            const populated = await PlacementOutcome.findById(existing._id).populate(
              'verifiedBy',
              'name'
            );
            return {
              status: 200,
              data: formatOutcomeResponse(populated, 'already_verified', false),
            };
          }

          if (existing.status === 'revoked') {
            // Case B: Re-verification of revoked outcome using Compare-and-Set
            const eventId = new mongoose.Types.ObjectId();
            const reverifyHistoryEntry = {
              eventId,
              action: 'reverified',
              oldStatus: 'revoked',
              newStatus: 'verified',
              changedBy: officerUser._id,
              changedAt: serverTime,
              reason: null,
              ctc: parsedCtc,
            };

            const updated = await PlacementOutcome.findOneAndUpdate(
              {
                _id: existing._id,
                application: applicationId,
                collegeId,
                status: 'revoked', // CAS condition
              },
              {
                $set: {
                  status: 'verified',
                  departmentSnapshot, // fresh snapshot on reverification
                  verifiedBy: officerUser._id,
                  verifiedAt: serverTime,
                  offerPackage: {
                    ctc: parsedCtc,
                    unit: 'LPA',
                    currency: 'INR',
                  },
                },
                $push: {
                  history: reverifyHistoryEntry,
                },
              },
              { new: true }
            ).populate('verifiedBy', 'name');

            if (updated) {
              reverifiedDoc = updated;
              reverifyEventId = eventId;
              reverifyVerifiedAt = serverTime;
            } else {
              // CAS condition failed due to concurrent modification; re-read and retry once
              const reRead = await PlacementOutcome.findOne({
                application: applicationId,
                collegeId,
              });

              if (!reRead) {
                return {
                  status: 404,
                  error: { code: 'OUTCOME_NOT_FOUND', message: 'Placement outcome not found.' },
                };
              }

              if (reRead.status === 'verified') {
                const currentCtc = reRead.offerPackage ? reRead.offerPackage.ctc : null;
                if (parsedCtc === null || parsedCtc === currentCtc) {
                  await DriveApplication.updateOne(
                    { _id: applicationId, collegeId },
                    { $set: { outcomeVerified: true } }
                  );
                  const populated = await PlacementOutcome.findById(reRead._id).populate(
                    'verifiedBy',
                    'name'
                  );
                  return {
                    status: 200,
                    data: formatOutcomeResponse(populated, 'already_verified', false),
                  };
                } else {
                  return {
                    status: 409,
                    error: {
                      code: 'OUTCOME_PACKAGE_MISMATCH',
                      message:
                        'The outcome package CTC does not match the existing verified package. To change package details, revoke the outcome first and then re-verify.',
                    },
                  };
                }
              }

              // Re-attempt CAS once against revoked status
              const retryTime = new Date();
              reverifyHistoryEntry.changedAt = retryTime;

              const retryUpdated = await PlacementOutcome.findOneAndUpdate(
                {
                  _id: reRead._id,
                  application: applicationId,
                  collegeId,
                  status: 'revoked',
                },
                {
                  $set: {
                    status: 'verified',
                    departmentSnapshot,
                    verifiedBy: officerUser._id,
                    verifiedAt: retryTime,
                    offerPackage: {
                      ctc: parsedCtc,
                      unit: 'LPA',
                      currency: 'INR',
                    },
                  },
                  $push: {
                    history: reverifyHistoryEntry,
                  },
                },
                { new: true }
              ).populate('verifiedBy', 'name');

              if (retryUpdated) {
                reverifiedDoc = retryUpdated;
                reverifyEventId = eventId;
                reverifyVerifiedAt = retryTime;
              } else {
                // If retry CAS fails, compensate if this request claimed the lock
                if (claimedLock) {
                  try {
                    await DriveApplication.updateOne(
                      { _id: applicationId, collegeId },
                      { $set: { outcomeVerified: false } }
                    );
                  } catch (compErr) {
                    console.error('[Lock Compensation Failure]:', compErr.message);
                  }
                }

                return {
                  status: 409,
                  error: {
                    code: 'CONCURRENT_MODIFICATION',
                    message: 'Concurrent update conflict during reverification. Please try again.',
                  },
                };
              }
            }
          }
        }
      } finally {
        if (outcomeWriterToken && departmentSnapshot.departmentId) {
          const relRes = await departmentCoordination.releaseWriterToken({
            departmentId: departmentSnapshot.departmentId,
            collegeId,
            writerId: outcomeWriterToken,
          });
          if (!relRes.success) {
            console.error('[Outcome Token Release Failure]:', {
              departmentId: departmentSnapshot.departmentId,
              writerId: outcomeWriterToken,
              error: relRes,
            });
          }
        }
      }

      // 5. Post-commit notification dispatch (OUTSIDE token-held section)
      if (inserted) {
        let notificationCreated = false;
        try {
          const notifRes = await dispatchOutcomeVerifiedNotification({
            outcomeId: inserted._id,
            eventId: insertedEventId,
            studentId: inserted.student,
            collegeId: inserted.collegeId,
            placementDriveId: inserted.placementDrive,
            applicationId,
            verifiedAt: serverTime,
          });
          notificationCreated = !!notifRes.notificationCreated;
        } catch (postCommitErr) {
          console.error('[Notification Dispatch Failure]:', {
            outcomeId: inserted._id ? inserted._id.toString() : null,
            collegeId: collegeId ? collegeId.toString() : null,
            type: 'OUTCOME_VERIFIED',
            errorName: postCommitErr.name || 'Error',
            errorCode: postCommitErr.code || null,
            errorMessage: (postCommitErr.message || '').substring(0, 200),
          });
        }

        return {
          status: 200,
          data: formatOutcomeResponse(inserted, 'created', notificationCreated),
        };
      }

      if (reverifiedDoc) {
        let notificationCreated = false;
        try {
          const notifRes = await dispatchOutcomeVerifiedNotification({
            outcomeId: reverifiedDoc._id,
            eventId: reverifyEventId,
            studentId: reverifiedDoc.student,
            collegeId: reverifiedDoc.collegeId,
            placementDriveId: reverifiedDoc.placementDrive,
            applicationId,
            verifiedAt: reverifyVerifiedAt,
          });
          notificationCreated = !!notifRes.notificationCreated;
        } catch (postCommitErr) {
          console.error('[Notification Dispatch Failure]:', {
            outcomeId: reverifiedDoc._id ? reverifiedDoc._id.toString() : null,
            collegeId: collegeId ? collegeId.toString() : null,
            type: 'OUTCOME_VERIFIED',
            errorName: postCommitErr.name || 'Error',
            errorCode: postCommitErr.code || null,
            errorMessage: (postCommitErr.message || '').substring(0, 200),
          });
        }

        return {
          status: 200,
          data: formatOutcomeResponse(reverifiedDoc, 'reverified', notificationCreated),
        };
      }
    } catch (outcomeErr) {
      // If this request claimed the lock and outcome step failed, compensate by clearing flag
      if (claimedLock) {
        try {
          await DriveApplication.updateOne(
            { _id: applicationId, collegeId },
            { $set: { outcomeVerified: false } }
          );
        } catch (compensationErr) {
          console.error('[Lock Compensation Failure]: Failed to release lock after outcome error:', compensationErr.message);
          // Leave it locked (fail-safe)
        }
      }
      return {
        status: 500,
        error: { code: 'OUTCOME_STEP_FAILED', message: outcomeErr.message },
      };
    }
  }

  if (action === 'revoke') {
    // 1. Validate revocation reason
    const reasonCheck = validateRevokeReason(reason);
    if (!reasonCheck.valid) {
      return {
        status: 400,
        error: { code: 'INVALID_REVOKE_REASON', message: reasonCheck.error },
      };
    }
    const trimmedReason = reasonCheck.trimmedReason;

    // 2. Scoped lookup: { application, collegeId }
    let existing = await PlacementOutcome.findOne({
      application: applicationId,
      collegeId,
    });

    if (!existing) {
      return {
        status: 404,
        error: { code: 'OUTCOME_NOT_FOUND', message: 'Placement outcome not found.' },
      };
    }

    // 3. Already revoked: idempotent response, still ensure flag is cleared (idempotent repair)
    if (existing.status === 'revoked') {
      await DriveApplication.updateOne(
        { _id: applicationId, collegeId },
        { $set: { outcomeVerified: false } }
      );

      const populated = await PlacementOutcome.findById(existing._id).populate('verifiedBy', 'name');
      return {
        status: 200,
        data: formatOutcomeResponse(populated, 'already_revoked'),
      };
    }

    // 4. Currently verified: execute CAS update to revoked FIRST
    const serverTime = new Date();
    const revokeHistoryEntry = {
      action: 'revoked',
      oldStatus: 'verified',
      newStatus: 'revoked',
      changedBy: officerUser._id,
      changedAt: serverTime,
      reason: trimmedReason,
      ctc: null,
    };

    const updated = await PlacementOutcome.findOneAndUpdate(
      {
        _id: existing._id,
        application: applicationId,
        collegeId,
        status: 'verified', // CAS condition
      },
      {
        $set: {
          status: 'revoked',
        },
        $push: {
          history: revokeHistoryEntry,
        },
      },
      { new: true }
    ).populate('verifiedBy', 'name');

    if (updated) {
      // THEN clear the flag
      await DriveApplication.updateOne(
        { _id: applicationId, collegeId },
        { $set: { outcomeVerified: false } }
      );

      return {
        status: 200,
        data: formatOutcomeResponse(updated, 'revoked'),
      };
    }

    // CAS failed due to concurrent modification; re-read and retry once
    const reRead = await PlacementOutcome.findOne({
      application: applicationId,
      collegeId,
    });

    if (!reRead) {
      return {
        status: 404,
        error: { code: 'OUTCOME_NOT_FOUND', message: 'Placement outcome not found.' },
      };
    }

    if (reRead.status === 'revoked') {
      // Concurrently revoked: ensure flag is cleared and return idempotent already_revoked
      await DriveApplication.updateOne(
        { _id: applicationId, collegeId },
        { $set: { outcomeVerified: false } }
      );

      const populated = await PlacementOutcome.findById(reRead._id).populate('verifiedBy', 'name');
      return {
        status: 200,
        data: formatOutcomeResponse(populated, 'already_revoked'),
      };
    }

    // Retry CAS once against verified
    const retryTime = new Date();
    revokeHistoryEntry.changedAt = retryTime;

    const retryUpdated = await PlacementOutcome.findOneAndUpdate(
      {
        _id: reRead._id,
        application: applicationId,
        collegeId,
        status: 'verified',
      },
      {
        $set: {
          status: 'revoked',
        },
        $push: {
          history: revokeHistoryEntry,
        },
      },
      { new: true }
    ).populate('verifiedBy', 'name');

    if (retryUpdated) {
      // Clear flag after successful CAS update
      await DriveApplication.updateOne(
        { _id: applicationId, collegeId },
        { $set: { outcomeVerified: false } }
      );

      return {
        status: 200,
        data: formatOutcomeResponse(retryUpdated, 'revoked'),
      };
    }

    return {
      status: 409,
      error: {
        code: 'CONCURRENT_MODIFICATION',
        message: 'Concurrent update conflict during revocation. Please try again.',
      },
    };
  }

  return {
    status: 400,
    error: { code: 'INVALID_ACTION', message: `Action '${action}' is not supported.` },
  };
}

/**
 * Service function to retrieve chronological audit history for a placement outcome.
 * Returns chronological history with the officer's name only for changedBy.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.applicationId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @returns {Promise<{ status: number, data?: Object, error?: Object }>}
 */
async function getOutcomeHistoryService({ applicationId, collegeId }) {
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    return {
      status: 400,
      error: { code: 'INVALID_APPLICATION_ID', message: 'Invalid application ID format.' },
    };
  }

  const outcome = await PlacementOutcome.findOne({
    application: applicationId,
    collegeId,
  }).populate({
    path: 'history.changedBy',
    select: 'name',
  });

  if (!outcome) {
    return {
      status: 404,
      error: { code: 'OUTCOME_NOT_FOUND', message: 'Placement outcome not found.' },
    };
  }

  const history = Array.isArray(outcome.history)
    ? outcome.history.map((h) => {
        const officerName =
          h.changedBy && typeof h.changedBy === 'object' && h.changedBy.name
            ? h.changedBy.name
            : 'Placement Officer';

        return {
          action: h.action,
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          changedBy: { name: officerName },
          changedAt: h.changedAt ? new Date(h.changedAt).toISOString() : null,
          reason: h.reason,
          ctc: h.ctc,
        };
      })
    : [];

  return {
    status: 200,
    data: {
      outcomeId: outcome._id.toString(),
      applicationId: outcome.application.toString(),
      history,
    },
  };
}

module.exports = {
  mutateOutcomeService,
  verifyOutcomeService: (params) => mutateOutcomeService({ ...params, action: 'verify' }),
  revokeOutcomeService: (params) => mutateOutcomeService({ ...params, action: 'revoke' }),
  getOutcomeHistoryService,
  formatOutcomeResponse,
  dispatchOutcomeVerifiedNotification,
  validateOfferPackageCtc,
  validateRevokeReason,
};
