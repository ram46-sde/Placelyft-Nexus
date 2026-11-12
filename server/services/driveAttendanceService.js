const mongoose = require('mongoose');
const DriveAttendance = require('../models/DriveAttendance');
const DriveApplication = require('../models/DriveApplication');
const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const { resolveDepartment, fetchCollegeDepartments, UNASSIGNED_LABEL } = require('../utils/departmentResolver');
const { getDriveLifecycleStatus } = require('../utils/driveLifecycle');
const departmentCoordination = require('../utils/departmentCoordination');

const ALLOWED_STATUSES = ['Pending', 'Present', 'Absent'];
const MAX_BATCH_ENTRIES = 200;

/**
 * Explicit applicant whitelist mapping function.
 * Strictly guarantees that no personal/sensitive information (email, phone, cgpa, resume, password)
 * is leaked in API responses.
 * 
 * @param {Object} params
 * @returns {Object} Whitelisted applicant presentation object
 */
function mapApplicantWhitelist({
  applicationId,
  studentName,
  rollNumber,
  departmentName,
  status,
  markedByName,
  markedAt,
  latestChange,
  history,
  includeHistory,
}) {
  const item = {
    applicationId: applicationId ? applicationId.toString() : null,
    studentName: studentName || 'Unknown Student',
    rollNumber: rollNumber || null,
    departmentName: departmentName || UNASSIGNED_LABEL,
    status: status || 'Pending',
    markedByName: markedByName || null,
    markedAt: markedAt ? new Date(markedAt).toISOString() : null,
    latestChange: latestChange || null,
  };

  if (includeHistory) {
    item.history = Array.isArray(history)
      ? history.map((h) => ({
          action: h.action,
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          changedByName: h.changedByName || 'Placement Officer',
          changedAt: h.changedAt ? new Date(h.changedAt).toISOString() : null,
          onBehalfOf: h.onBehalfOf || 'HOD',
          note: h.note || null,
        }))
      : [];
  }

  return item;
}

/**
 * Service function to retrieve department-wise attendance for a placement drive.
 * Uses batched queries, lean() documents, explicit field projections, and pure function department resolution.
 * GET never writes to the database.
 * 
 * @param {Object} params
 * @param {string} params.driveId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {boolean} params.includeHistory
 * @returns {Promise<{ status: number, data?: Object, error?: Object }>}
 */
async function getDriveAttendanceService({ driveId, collegeId, includeHistory = false }) {
  if (!mongoose.Types.ObjectId.isValid(driveId)) {
    return { status: 400, error: { message: 'Invalid drive ID format.' } };
  }

  // 1. Verify drive exists and belongs to officer's college (tenant scoped)
  const drive = await PlacementDrive.findOne({
    _id: driveId,
    collegeId,
  }).populate('company', 'name').lean();

  if (!drive) {
    return { status: 404, error: { message: 'Placement drive not found.' } };
  }

  // 2. Load the college's departments once
  const departments = await fetchCollegeDepartments(collegeId);

  // 3. Batched query for non-withdrawn applications for this drive
  // (Excludes 'Withdrawn' or 'Cancelled' applications if any exist)
  const applications = await DriveApplication.find(
    {
      placementDrive: driveId,
      collegeId,
      status: { $nin: ['Withdrawn', 'Cancelled'] },
    },
    { _id: 1, student: 1, status: 1 }
  ).lean();

  const studentUserIds = [...new Set(applications.map((app) => app.student.toString()))];

  // 4. Batched query for student Users (explicit name projection)
  const studentUsers = await User.find(
    { _id: { $in: studentUserIds } },
    { _id: 1, name: 1 }
  ).lean();
  const studentNameMap = new Map();
  studentUsers.forEach((u) => studentNameMap.set(u._id.toString(), u.name));

  // 5. Batched query for StudentProfiles (explicit rollNumber & department projection)
  const studentProfiles = await StudentProfile.find(
    { user: { $in: studentUserIds }, collegeId },
    { user: 1, rollNumber: 1, department: 1, departmentId: 1 }
  ).lean();
  const profileMap = new Map();
  studentProfiles.forEach((p) => {
    if (p.user) {
      profileMap.set(p.user.toString(), p);
    }
  });

  // 6. Batched query for existing attendance records for this drive
  const attendanceRecords = await DriveAttendance.find(
    { placementDrive: driveId, collegeId },
    {
      _id: 1,
      application: 1,
      student: 1,
      departmentId: 1,
      departmentName: 1,
      departmentResolutionStatus: 1,
      status: 1,
      markedBy: 1,
      markedAt: 1,
      markedOnBehalfOf: 1,
      history: 1,
    }
  ).lean();
  const attendanceMap = new Map();
  attendanceRecords.forEach((rec) => {
    if (rec.application) {
      attendanceMap.set(rec.application.toString(), rec);
    }
  });

  // 7. Batched query for officer user names who marked attendance or changes
  const officerUserIds = new Set();
  attendanceRecords.forEach((rec) => {
    if (rec.markedBy) officerUserIds.add(rec.markedBy.toString());
    if (includeHistory && Array.isArray(rec.history)) {
      rec.history.forEach((h) => {
        if (h.changedBy) officerUserIds.add(h.changedBy.toString());
      });
    }
  });

  const officerUsers = await User.find(
    { _id: { $in: [...officerUserIds] } },
    { _id: 1, name: 1 }
  ).lean();
  const officerNameMap = new Map();
  officerUsers.forEach((o) => officerNameMap.set(o._id.toString(), o.name));

  // 8. Department grouping & applicant processing
  // Structure: Map<deptName, { departmentId, departmentName, departmentCode, totals: { total, present, absent, pending }, applicants: [] }>
  const deptGroups = new Map();

  let overallTotal = 0;
  let overallPresent = 0;
  let overallAbsent = 0;
  let overallPending = 0;

  applications.forEach((app) => {
    const appIdStr = app._id.toString();
    const studentIdStr = app.student ? app.student.toString() : '';
    const studentName = studentNameMap.get(studentIdStr) || 'Unknown Student';
    const profile = profileMap.get(studentIdStr);
    const attendance = attendanceMap.get(appIdStr);

    let resolvedDeptName = UNASSIGNED_LABEL;
    let resolvedDeptId = null;
    let resolvedDeptCode = null;
    let applicantStatus = 'Pending';
    let markedByName = null;
    let markedAt = null;
    let latestChange = null;
    let historyList = [];

    if (attendance) {
      // Grouping rule: Use stored snapshot from attendance record
      resolvedDeptName = attendance.departmentName || UNASSIGNED_LABEL;
      resolvedDeptId = attendance.departmentId || null;
      applicantStatus = attendance.status || 'Pending';
      markedAt = attendance.markedAt;
      markedByName = attendance.markedBy ? officerNameMap.get(attendance.markedBy.toString()) || 'Officer' : null;

      // Find code from loaded departments if matched by id/name
      if (resolvedDeptId) {
        const found = departments.find((d) => d._id.toString() === resolvedDeptId.toString());
        if (found) resolvedDeptCode = found.code;
      }

      if (Array.isArray(attendance.history) && attendance.history.length > 0) {
        const lastEntry = attendance.history[attendance.history.length - 1];
        const lastOfficerName = lastEntry.changedBy
          ? officerNameMap.get(lastEntry.changedBy.toString()) || 'Officer'
          : 'Officer';
        latestChange = `${lastEntry.action}: ${lastEntry.oldStatus} -> ${lastEntry.newStatus} by ${lastOfficerName}`;

        if (includeHistory) {
          historyList = attendance.history.map((h) => ({
            ...h,
            changedByName: h.changedBy ? officerNameMap.get(h.changedBy.toString()) || 'Officer' : 'Officer',
          }));
        }
      }
    } else {
      // Live resolution via pure function (no attendance record yet)
      const res = resolveDepartment(profile, departments);
      resolvedDeptName = res.departmentName;
      resolvedDeptId = res.departmentId;
      resolvedDeptCode = res.departmentCode;
      applicantStatus = 'Pending'; // Unmarked applicants count as Pending
    }

    // Update overall totals
    overallTotal += 1;
    if (applicantStatus === 'Present') overallPresent += 1;
    else if (applicantStatus === 'Absent') overallAbsent += 1;
    else overallPending += 1;

    // Get or create department group
    if (!deptGroups.has(resolvedDeptName)) {
      deptGroups.set(resolvedDeptName, {
        departmentId: resolvedDeptId,
        departmentName: resolvedDeptName,
        departmentCode: resolvedDeptCode,
        totals: { total: 0, present: 0, absent: 0, pending: 0 },
        applicants: [],
      });
    }

    const group = deptGroups.get(resolvedDeptName);
    group.totals.total += 1;
    if (applicantStatus === 'Present') group.totals.present += 1;
    else if (applicantStatus === 'Absent') group.totals.absent += 1;
    else group.totals.pending += 1;

    group.applicants.push(
      mapApplicantWhitelist({
        applicationId: app._id,
        studentName,
        rollNumber: profile?.rollNumber,
        departmentName: resolvedDeptName,
        status: applicantStatus,
        markedByName,
        markedAt,
        latestChange,
        history: historyList,
        includeHistory,
      })
    );
  });

  // Sort department groups: assigned departments first alphabetically, 'Unassigned / Other' last
  const sortedDepartments = [...deptGroups.values()].sort((a, b) => {
    if (a.departmentName === UNASSIGNED_LABEL) return 1;
    if (b.departmentName === UNASSIGNED_LABEL) return -1;
    return a.departmentName.localeCompare(b.departmentName);
  });

  const driveStatus = getDriveLifecycleStatus(drive);

  return {
    status: 200,
    data: {
      success: true,
      drive: {
        id: drive._id.toString(),
        company: drive.company?.name || drive.companyName || 'Company',
        jobRole: drive.jobRole,
        status: driveStatus,
        isArchived: !!drive.isArchived,
      },
      summary: {
        totalApplicants: overallTotal,
        present: overallPresent,
        absent: overallAbsent,
        pending: overallPending,
      },
      departments: sortedDepartments,
    },
  };
}

/**
 * Exactly ONE service function that mutates DriveAttendance.
 * Follows the strict Phase 2 concurrency & audit rules:
 * - Validate all entries before write (all-or-nothing rejection)
 * - Block marking on archived drives (409 DRIVE_ARCHIVED)
 * - No record + Pending -> no-op (create nothing, write no history)
 * - No record + Present/Absent -> upsert with $setOnInsert (resolver snapshot, first history entry with oldStatus: Pending)
 * - Existing record -> Compare-and-set update (filter on _id AND old status, $set status/markedBy/markedAt, $push history)
 * - Existing record + same status -> unchanged (no history entry, no markedAt change)
 * - Never truncates, replaces, or overrides history
 * 
 * @param {Object} params
 * @param {string} params.driveId
 * @param {string|mongoose.Types.ObjectId} params.collegeId
 * @param {Object} params.officerUser Authenticated officer user
 * @param {Array<Object>} params.entries [{ applicationId, status }]
 * @returns {Promise<{ status: number, data?: Object, error?: Object }>}
 */
async function markDriveAttendanceService({ driveId, collegeId, officerUser, entries }) {
  // 1. Validate drive ID format
  if (!mongoose.Types.ObjectId.isValid(driveId)) {
    return { status: 400, error: { message: 'Invalid drive ID format.' } };
  }

  // 2. Validate entries array
  if (!Array.isArray(entries) || entries.length === 0) {
    return { status: 400, error: { message: 'Entries array must be non-empty.' } };
  }

  if (entries.length > MAX_BATCH_ENTRIES) {
    return {
      status: 400,
      error: { message: `Batch size exceeds maximum limit of ${MAX_BATCH_ENTRIES} entries.` },
    };
  }

  // 3. Validate entry items and prevent duplicate applicationIds in the batch
  const seenApplicationIds = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      return { status: 400, error: { message: `Entry at index ${i} is invalid.` } };
    }

    const { applicationId, status } = entry;
    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return {
        status: 400,
        error: { message: `Entry at index ${i} has an invalid or missing applicationId.` },
      };
    }

    const appIdStr = applicationId.toString();
    if (seenApplicationIds.has(appIdStr)) {
      return {
        status: 400,
        error: { message: `Duplicate applicationId '${appIdStr}' detected in batch request.` },
      };
    }
    seenApplicationIds.add(appIdStr);

    if (!ALLOWED_STATUSES.includes(status)) {
      return {
        status: 400,
        error: {
          message: `Invalid status '${status}' at index ${i}. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
        },
      };
    }
  }

  // 4. Verify drive exists and belongs to officer's college (tenant scoped)
  const drive = await PlacementDrive.findOne({
    _id: driveId,
    collegeId,
  });

  if (!drive) {
    return { status: 404, error: { message: 'Placement drive not found.' } };
  }

  // 5. Check drive lifecycle state: marking is strictly blocked on archived drives
  if (drive.isArchived) {
    return {
      status: 409,
      error: {
        code: 'DRIVE_ARCHIVED',
        message: 'Attendance marking is disabled on archived placement drives.',
      },
    };
  }

  // 6. Verify every application belongs to this drive and this college
  // If an application does not exist, belongs to another drive, or belongs to another college,
  // return an IDENTICAL error message to prevent existence leakage.
  const appIds = [...seenApplicationIds];
  const matchedApplications = await DriveApplication.find({
    _id: { $in: appIds },
  }).lean();

  const genericAppError = {
    code: 'INVALID_APPLICATION_IN_BATCH',
    message: 'One or more applications are invalid, do not belong to this drive, or could not be found.',
  };

  if (matchedApplications.length !== appIds.length) {
    return { status: 400, error: genericAppError };
  }

  const appMap = new Map();
  for (const app of matchedApplications) {
    if (
      !app.placementDrive ||
      app.placementDrive.toString() !== driveId.toString() ||
      !app.collegeId ||
      app.collegeId.toString() !== collegeId.toString()
    ) {
      return { status: 400, error: genericAppError };
    }
    appMap.set(app._id.toString(), app);
  }

  // Pre-load college departments once for any needed first-mark resolution snapshots
  const departments = await fetchCollegeDepartments(collegeId);

  // Pre-load student profiles for all applications in this batch
  const studentUserIds = matchedApplications.map((a) => a.student.toString());
  const profiles = await StudentProfile.find({
    user: { $in: studentUserIds },
    collegeId,
  }).lean();
  const profileMap = new Map();
  profiles.forEach((p) => {
    if (p.user) profileMap.set(p.user.toString(), p);
  });

  // 6b. Determine all unique department IDs required by this attendance operation
  const requiredDeptIds = new Set();
  for (const entry of entries) {
    const app = appMap.get(entry.applicationId.toString());
    if (app && app.student) {
      const profile = profileMap.get(app.student.toString());
      const resolved = resolveDepartment(profile, departments);
      if (resolved && resolved.departmentId) {
        requiredDeptIds.add(resolved.departmentId.toString());
      }
    }
  }

  // Also include any departmentId from existing attendance records for applications in this batch
  const existingAttendanceRecords = await DriveAttendance.find(
    { application: { $in: appIds }, collegeId },
    { application: 1, departmentId: 1 }
  ).lean();
  for (const rec of existingAttendanceRecords) {
    if (rec.departmentId) {
      requiredDeptIds.add(rec.departmentId.toString());
    }
  }

  const deptIdsToAcquire = Array.from(requiredDeptIds);

  // 6c. Acquire writer tokens for all required departments BEFORE any attendance write
  let acquiredTokens = [];
  if (deptIdsToAcquire.length > 0) {
    const batchTokenRes = await departmentCoordination.acquireBatchWriterTokens({
      departmentIds: deptIdsToAcquire,
      collegeId,
    });

    if (!batchTokenRes.success) {
      return {
        status: 409,
        error: {
          code: batchTokenRes.code || 'DEPARTMENT_DELETION_CONFLICT',
          message:
            batchTokenRes.message ||
            'Cannot mark attendance: A required department is closing for deletion or inactive.',
          failedDepartmentId: batchTokenRes.failedDepartmentId || null,
        },
      };
    }

    acquiredTokens = batchTokenRes.tokens || [];
  }

  // 7. Apply mutations per entry (using upsert + CAS without transactions)
  // Hold acquired tokens until write operation finishes; release in finally block
  let serviceResponse = null;

  try {
    const results = [];
    const serverTime = new Date();

    for (const entry of entries) {
      const { applicationId, status: requestedStatus } = entry;
      const appIdStr = applicationId.toString();
      const app = appMap.get(appIdStr);

      // Read existing record
      let existing = await DriveAttendance.findOne({ application: applicationId });

      if (!existing) {
        // Case A: No existing record
        if (requestedStatus === 'Pending') {
          // Pending on an unmarked applicant is a no-op: creates nothing, writes no history
          results.push({
            applicationId: appIdStr,
            result: 'noop',
            status: 'Pending',
          });
          continue;
        }

        // First mark (Present or Absent): resolve snapshot
        const profile = profileMap.get(app.student.toString());
        const resolved = resolveDepartment(profile, departments);

        const firstHistoryEntry = {
          action: 'MARK_ATTENDANCE',
          oldStatus: 'Pending',
          newStatus: requestedStatus,
          changedBy: officerUser._id,
          changedAt: serverTime,
          onBehalfOf: 'HOD',
          note: null,
        };

        try {
          const createdRecord = await DriveAttendance.findOneAndUpdate(
            { application: applicationId },
            {
              $setOnInsert: {
                collegeId,
                placementDrive: drive._id,
                student: app.student,
                application: applicationId,
                departmentId: resolved.departmentId || null,
                departmentName: resolved.departmentName,
                departmentResolutionStatus: resolved.status,
                status: requestedStatus,
                markedBy: officerUser._id,
                markedAt: serverTime,
                markedOnBehalfOf: 'HOD',
                history: [firstHistoryEntry],
              },
            },
            { upsert: true, new: false } // returns null if inserted
          );

          if (!createdRecord) {
            // Successfully inserted!
            results.push({
              applicationId: appIdStr,
              result: 'created',
              status: requestedStatus,
            });
            continue;
          } else {
            // Already existed when upsert ran; fall through to CAS update
            existing = createdRecord;
          }
        } catch (upsertErr) {
          if (upsertErr.code === 11000) {
            // Duplicate key collision due to concurrent insert; reload and handle as update
            existing = await DriveAttendance.findOne({ application: applicationId });
          } else {
            throw upsertErr;
          }
        }
      }

      // Case B: Existing record (or fallen through from concurrent upsert)
      if (existing) {
        if (existing.status === requestedStatus) {
          // Same status as current: unchanged (no history entry, no markedAt change)
          results.push({
            applicationId: appIdStr,
            result: 'unchanged',
            status: requestedStatus,
          });
          continue;
        }

        // Status differs: execute atomic Compare-and-Set (CAS) update
        const casHistoryEntry = {
          action: 'MARK_ATTENDANCE',
          oldStatus: existing.status,
          newStatus: requestedStatus,
          changedBy: officerUser._id,
          changedAt: serverTime,
          onBehalfOf: 'HOD',
          note: null,
        };

        const casUpdated = await DriveAttendance.findOneAndUpdate(
          {
            _id: existing._id,
            status: existing.status, // CAS condition: must match read status
          },
          {
            $set: {
              status: requestedStatus,
              markedBy: officerUser._id,
              markedAt: serverTime,
              markedOnBehalfOf: 'HOD',
            },
            $push: {
              history: casHistoryEntry,
            },
          },
          { new: true }
        );

        if (casUpdated) {
          results.push({
            applicationId: appIdStr,
            result: 'changed',
            status: requestedStatus,
          });
        } else {
          // CAS failed due to concurrent modification! Re-read and retry once
          const reRead = await DriveAttendance.findById(existing._id);
          if (!reRead) {
            results.push({
              applicationId: appIdStr,
              result: 'conflict',
              status: existing.status,
            });
          } else if (reRead.status === requestedStatus) {
            // Concurrent update already set it to requested status
            results.push({
              applicationId: appIdStr,
              result: 'unchanged',
              status: requestedStatus,
            });
          } else {
            // Try CAS update one more time against new status
            const retryTime = new Date();
            const retryHistoryEntry = {
              action: 'MARK_ATTENDANCE',
              oldStatus: reRead.status,
              newStatus: requestedStatus,
              changedBy: officerUser._id,
              changedAt: retryTime,
              onBehalfOf: 'HOD',
              note: null,
            };

            const retryUpdated = await DriveAttendance.findOneAndUpdate(
              {
                _id: reRead._id,
                status: reRead.status,
              },
              {
                $set: {
                  status: requestedStatus,
                  markedBy: officerUser._id,
                  markedAt: retryTime,
                  markedOnBehalfOf: 'HOD',
                },
                $push: {
                  history: retryHistoryEntry,
                },
              },
              { new: true }
            );

            if (retryUpdated) {
              results.push({
                applicationId: appIdStr,
                result: 'changed',
                status: requestedStatus,
              });
            } else {
              // Consecutive race condition failure; report conflict
              results.push({
                applicationId: appIdStr,
                result: 'conflict',
                status: reRead.status,
              });
            }
          }
        }
      }
    }

    serviceResponse = {
      status: 200,
      data: {
        success: true,
        message: 'Attendance processed successfully.',
        results,
      },
    };
  } finally {
    if (acquiredTokens.length > 0) {
      const releaseRes = await departmentCoordination.releaseBatchWriterTokens({
        tokens: acquiredTokens,
        collegeId,
      });

      if (!releaseRes.success) {
        console.error('[Attendance Cleanup Failure]: Failed to release some department writer tokens:', releaseRes);
      }

      if (serviceResponse && serviceResponse.data) {
        serviceResponse.data.cleanup = releaseRes;
        if (!releaseRes.success) {
          serviceResponse.data.warning =
            'One or more department writer tokens could not be released during cleanup.';
        }
      }
    }
  }

  return serviceResponse;
}

module.exports = {
  ALLOWED_STATUSES,
  MAX_BATCH_ENTRIES,
  mapApplicantWhitelist,
  getDriveAttendanceService,
  markDriveAttendanceService,
};
