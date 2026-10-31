const mongoose = require('mongoose');

/**
 * Checks whether a registration deadline has passed relative to the given reference time.
 * 
 * Rules:
 * - If registrationDeadline is date-only (stored as midnight UTC or local, or length 10 string 'YYYY-MM-DD'),
 *   the drive stays open until the end of that day (23:59:59.999).
 * - If registrationDeadline is a datetime (has hours/minutes/seconds/ms), compare the exact instant.
 * - Exactly at or after the deadline instant = passed (closed).
 * - 1 second before = not passed (active).
 * 
 * @param {Date|string|number} registrationDeadline 
 * @param {Date} [now=new Date()] Reference server clock
 * @returns {boolean} True if deadline has passed, false otherwise
 */
function isRegistrationDeadlinePassed(registrationDeadline, now = new Date()) {
  if (!registrationDeadline) return false;
  const deadlineDate = new Date(registrationDeadline);
  if (isNaN(deadlineDate.getTime())) return false;

  const refTime = new Date(now).getTime();

  // Detect date-only format:
  // 1. Raw string was 'YYYY-MM-DD'
  // 2. Or Date object has 00:00:00.000 in UTC or local time
  const isDateOnly =
    (typeof registrationDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(registrationDeadline.trim())) ||
    (deadlineDate.getUTCHours() === 0 &&
      deadlineDate.getUTCMinutes() === 0 &&
      deadlineDate.getUTCSeconds() === 0 &&
      deadlineDate.getUTCMilliseconds() === 0) ||
    (deadlineDate.getHours() === 0 &&
      deadlineDate.getMinutes() === 0 &&
      deadlineDate.getSeconds() === 0 &&
      deadlineDate.getMilliseconds() === 0);

  let effectiveDeadlineTimestamp;
  if (isDateOnly) {
    const endOfDay = new Date(deadlineDate);
    if (
      deadlineDate.getUTCHours() === 0 &&
      deadlineDate.getUTCMinutes() === 0 &&
      deadlineDate.getUTCSeconds() === 0 &&
      deadlineDate.getUTCMilliseconds() === 0
    ) {
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      endOfDay.setHours(23, 59, 59, 999);
    }
    effectiveDeadlineTimestamp = endOfDay.getTime();
  } else {
    effectiveDeadlineTimestamp = deadlineDate.getTime();
  }

  // Exactly at or after the deadline = passed
  return refTime >= effectiveDeadlineTimestamp;
}

/**
 * Computes the single source of truth lifecycle status for a placement drive.
 * Priority hierarchy:
 *   1. 'archived': drive is archived (takes priority over everything)
 *   2. 'closed': not archived AND (manually closed [isActive === false] OR registration deadline has passed)
 *   3. 'active': neither
 * 
 * @param {Object} drive PlacementDrive document or plain object
 * @param {Date} [now=new Date()] Reference server clock
 * @returns {'archived'|'closed'|'active'} Derived lifecycle status
 */
function getDriveLifecycleStatus(drive, now = new Date()) {
  if (!drive) return null;

  if (drive.isArchived) {
    return 'archived';
  }

  const isManuallyClosed = drive.isActive === false;
  const isDeadlinePassed = isRegistrationDeadlinePassed(drive.registrationDeadline, now);

  if (isManuallyClosed || isDeadlinePassed) {
    return 'closed';
  }

  return 'active';
}

/**
 * Generates MongoDB query conditions for a given lifecycle state.
 * 
 * @param {'all'|'active'|'closed'|'archived'} statusFilter 
 * @param {mongoose.Types.ObjectId|string} collegeId 
 * @param {Date} [now=new Date()] Reference server clock
 * @returns {Object} MongoDB filter object
 */
function getDriveStatusQuery(statusFilter, collegeId, now = new Date()) {
  const baseQuery = { collegeId };
  const refDate = new Date(now);

  // Midnight UTC boundary for date-only queries
  const startOfTodayUTC = new Date(refDate);
  startOfTodayUTC.setUTCHours(0, 0, 0, 0);

  const endOfTodayUTC = new Date(refDate);
  endOfTodayUTC.setUTCHours(23, 59, 59, 999);

  switch (statusFilter) {
    case 'archived':
      return {
        ...baseQuery,
        isArchived: true,
      };

    case 'active':
      return {
        ...baseQuery,
        isArchived: { $ne: true },
        isActive: { $ne: false },
        $or: [
          // Registration deadline in future
          { registrationDeadline: { $gt: refDate } },
          // Or date-only set to today (open until 23:59:59.999 UTC)
          {
            registrationDeadline: {
              $gte: startOfTodayUTC,
              $lte: endOfTodayUTC,
            },
          },
          // Or no deadline specified
          { registrationDeadline: { $exists: false } },
          { registrationDeadline: null },
        ],
      };

    case 'closed':
      return {
        ...baseQuery,
        isArchived: { $ne: true },
        $or: [
          { isActive: false },
          {
            $and: [
              { registrationDeadline: { $exists: true, $ne: null } },
              { registrationDeadline: { $lt: refDate } },
              // Exclude today's midnight if still within today
              { registrationDeadline: { $lt: startOfTodayUTC } },
            ],
          },
        ],
      };

    case 'all':
    default:
      // All Non-Archived drives (Active + Closed)
      return {
        ...baseQuery,
        isArchived: { $ne: true },
      };
  }
}

module.exports = {
  isRegistrationDeadlinePassed,
  getDriveLifecycleStatus,
  getDriveStatusQuery,
};
