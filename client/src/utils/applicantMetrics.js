/**
 * Placelyft Nexus - Applicant Metrics & Identification Utilities
 *
 * Provides single source of truth functions for:
 * 1. Extracting stable student identifiers from application records.
 * 2. Calculating unique applicants vs total applications across drives.
 * 3. Formatting serial numbers for applicant rosters.
 */

/**
 * Extracts a stable, unique student identifier from an application record.
 * Prioritizes the database User identifier to ensure different students with the
 * same name are treated as distinct individuals, while multiple applications from
 * the same student across different drives collapse to one unique applicant.
 *
 * Hierarchy of extraction:
 * 1. app.student._id (populated User ObjectId)
 * 2. app.student (unpopulated User ObjectId string)
 * 3. app.academicProfile.rollNumber (unique institutional identifier fallback)
 * 4. app._id (application fallback so unidentifiable records are safely counted
 *    rather than dropped or incorrectly merged with other unknown students)
 *
 * @param {Object} app Application record
 * @returns {string|null} Stable unique student identifier
 */
export const extractStudentIdentifier = (app) => {
  if (!app || typeof app !== 'object') return null;

  // 1. Populated student object with _id
  if (app.student && typeof app.student === 'object' && app.student._id) {
    return String(app.student._id).trim();
  }

  // 2. Direct string or ObjectId identifier
  if (typeof app.student === 'string' && app.student.trim()) {
    return app.student.trim();
  }

  // 3. Roll number from academicProfile
  if (app.academicProfile && typeof app.academicProfile.rollNumber === 'string' && app.academicProfile.rollNumber.trim()) {
    return `roll:${app.academicProfile.rollNumber.trim()}`;
  }

  // 4. Safe fallback to application ID (prevents collisions between unknown records)
  if (app._id) {
    return `app:${String(app._id).trim()}`;
  }

  return null;
};

/**
 * Computes unique applicants vs total applications across drives from drive stats.
 *
 * Semantics:
 * - uniqueApplicants: Distinct students who applied across all placement drives.
 * - totalApplications: Total count of all applications submitted across all drives.
 * - totalOffers: Total count of applications with status 'Selected'.
 * - totalApplicants: Alias for uniqueApplicants (single source of truth).
 *
 * @param {Object|Array} driveStats Map of driveId -> stats or array of stats
 * @returns {{ uniqueApplicants: number, totalApplicants: number, totalApplications: number, totalOffers: number }}
 */
export const calculateApplicantMetrics = (driveStats) => {
  if (!driveStats || typeof driveStats !== 'object') {
    return {
      uniqueApplicants: 0,
      totalApplicants: 0,
      totalApplications: 0,
      totalOffers: 0,
    };
  }

  const statsList = Array.isArray(driveStats) ? driveStats : Object.values(driveStats);
  const uniqueStudentIds = new Set();
  let totalApplications = 0;
  let totalOffers = 0;

  statsList.forEach((stat) => {
    if (!stat || typeof stat !== 'object') return;

    totalApplications += Number(stat.count) || 0;
    totalOffers += Number(stat.offersCount) || 0;

    const apps = Array.isArray(stat.applications) ? stat.applications : [];
    apps.forEach((app) => {
      const studentId = extractStudentIdentifier(app);
      if (studentId) {
        uniqueStudentIds.add(studentId);
      }
    });
  });

  const uniqueApplicants = uniqueStudentIds.size;

  return {
    uniqueApplicants,
    totalApplicants: uniqueApplicants, // SSoT: Total Applicants represents distinct students
    totalApplications,
    totalOffers,
  };
};

/**
 * Formats a 1-based serial number with leading zero padding (e.g. "01", "02", "10").
 * Supports optional pagination offsets.
 *
 * @param {number} index Zero-based item index
 * @param {number} [page=1] Current 1-based page number
 * @param {number|null} [pageSize=null] Page size if paginated
 * @returns {string} Formatted serial number string (e.g. "01")
 */
export const formatSerialNumber = (index, page = 1, pageSize = null) => {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 0;

  const baseNumber = safePageSize > 0 ? (safePage - 1) * safePageSize + safeIndex + 1 : safeIndex + 1;
  return String(baseNumber).padStart(2, '0');
};

