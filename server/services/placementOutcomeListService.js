const mongoose = require('mongoose');
const DriveApplication = require('../models/DriveApplication');
const PlacementOutcome = require('../models/PlacementOutcome');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const PlacementDrive = require('../models/PlacementDrive');
const { getDriveLifecycleStatus } = require('../utils/driveLifecycle');
const { resolveDepartment, fetchCollegeDepartments } = require('../utils/departmentResolver');

/**
 * Normalizes pagination parameters.
 * Default page: 1, default limit: 20, max limit: 50.
 * 
 * @param {Object} query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePaginationParams(query = {}) {
  const pageNum = parseInt(query.page, 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1;

  const limitNum = parseInt(query.limit, 10);
  const limit = Number.isFinite(limitNum) && limitNum >= 1 ? Math.min(50, limitNum) : 20;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Retrieves paginated list of Selected applications awaiting outcome verification.
 * Source of truth is PlacementOutcome:
 * - Status must be 'Selected'
 * - Must NOT have any outcome with status 'verified'
 * - Legacy Selected applications (no outcome document) appear
 * - Revoked outcomes whose applications remain Selected appear
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.collegeId Authenticated officer's college ID
 * @param {Object} [params.query] Query parameters (page, limit, driveId)
 * @returns {Promise<{ queue: Array<Object>, pagination: Object }>}
 */
async function getOutcomesQueueService({ collegeId, query = {} }) {
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw new Error('Invalid college ID.');
  }

  const collegeObjId = new mongoose.Types.ObjectId(collegeId);
  const { page, limit, skip } = parsePaginationParams(query);

  const matchCondition = {
    collegeId: collegeObjId,
    status: 'Selected',
  };

  if (query.driveId && mongoose.Types.ObjectId.isValid(query.driveId)) {
    matchCondition.placementDrive = new mongoose.Types.ObjectId(query.driveId);
  }

  // Reuse the Stage B predicate: lookup placement outcomes and exclude verified
  const pipeline = [
    { $match: matchCondition },
    {
      $lookup: {
        from: 'placementoutcomes',
        localField: '_id',
        foreignField: 'application',
        as: 'outcomes',
      },
    },
    {
      $addFields: {
        hasVerifiedOutcome: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: '$outcomes',
                  as: 'o',
                  cond: { $eq: ['$$o.status', 'verified'] },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $match: {
        hasVerifiedOutcome: false,
      },
    },
    {
      $facet: {
        totalCount: [{ $count: 'count' }],
        paginatedRows: [
          { $sort: { updatedAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ],
      },
    },
  ];

  const [aggregationResult] = await DriveApplication.aggregate(pipeline);

  const total =
    aggregationResult &&
    aggregationResult.totalCount &&
    aggregationResult.totalCount[0] &&
    aggregationResult.totalCount[0].count
      ? aggregationResult.totalCount[0].count
      : 0;

  const rawRows = (aggregationResult && aggregationResult.paginatedRows) || [];

  if (rawRows.length === 0) {
    return {
      queue: [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Collect IDs for batch hydration
  const studentIds = rawRows.map((r) => r.student).filter(Boolean);
  const driveIds = rawRows.map((r) => r.placementDrive).filter(Boolean);

  // Batch query students, profiles, drives, and college departments
  const [students, profiles, drives, departments] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select('name').lean(),
    StudentProfile.find({ user: { $in: studentIds }, collegeId: collegeObjId })
      .select('user rollNumber departmentId department')
      .lean(),
    PlacementDrive.find({ _id: { $in: driveIds } })
      .populate('company', 'name')
      .select('jobRole company isActive isArchived registrationDeadline driveDate')
      .lean(),
    fetchCollegeDepartments(collegeObjId),
  ]);

  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
  const driveMap = new Map(drives.map((d) => [d._id.toString(), d]));

  const now = new Date();

  // Whitelist projection: strictly no email, phone, CGPA, or resume
  const queue = rawRows.map((row) => {
    const student = studentMap.get(row.student ? row.student.toString() : '');
    const profile = profileMap.get(row.student ? row.student.toString() : '');
    const drive = driveMap.get(row.placementDrive ? row.placementDrive.toString() : '');

    const resolvedDept = resolveDepartment(profile, departments);
    const company = (drive && drive.company && drive.company.name) || 'Company';
    const role = (drive && drive.jobRole) || 'Role';
    const driveLifecycleState = drive ? getDriveLifecycleStatus(drive, now) : 'closed';

    const selectedAt = row.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : row.createdAt
      ? new Date(row.createdAt).toISOString()
      : null;

    return {
      applicationId: row._id.toString(),
      studentName: (student && student.name) || 'Student',
      rollNumber: (profile && profile.rollNumber) || null,
      departmentName: resolvedDept.departmentName,
      company,
      role,
      driveId: drive ? drive._id.toString() : '',
      driveTitle: `${company} - ${role}`,
      driveLifecycleState,
      selectedAt,
    };
  });

  return {
    queue,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves paginated list of confirmed verified placement outcomes.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.collegeId Authenticated officer's college ID
 * @param {Object} [params.query] Query parameters (page, limit, driveId, department)
 * @returns {Promise<{ outcomes: Array<Object>, pagination: Object }>}
 */
async function getVerifiedOutcomesListService({ collegeId, query = {} }) {
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw new Error('Invalid college ID.');
  }

  const collegeObjId = new mongoose.Types.ObjectId(collegeId);
  const { page, limit, skip } = parsePaginationParams(query);

  const filter = {
    collegeId: collegeObjId,
    status: 'verified',
  };

  if (query.driveId && mongoose.Types.ObjectId.isValid(query.driveId)) {
    filter.placementDrive = new mongoose.Types.ObjectId(query.driveId);
  }

  if (query.department && typeof query.department === 'string' && query.department.trim()) {
    filter['departmentSnapshot.departmentName'] = query.department.trim();
  }

  const total = await PlacementOutcome.countDocuments(filter);

  if (total === 0) {
    return {
      outcomes: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const rawOutcomes = await PlacementOutcome.find(filter)
    .sort({ verifiedAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate('student', 'name')
    .populate('verifiedBy', 'name')
    .populate({
      path: 'placementDrive',
      populate: { path: 'company', select: 'name' },
      select: 'jobRole company isActive isArchived registrationDeadline driveDate',
    })
    .lean();

  const studentUserIds = rawOutcomes
    .map((o) => (o.student ? o.student._id : null))
    .filter(Boolean);

  const profiles = await StudentProfile.find({
    user: { $in: studentUserIds },
    collegeId: collegeObjId,
  })
    .select('user rollNumber')
    .lean();

  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
  const now = new Date();

  // Whitelist projection: strictly officer name only, no email, phone, CGPA, resume, or revocation data
  const outcomes = rawOutcomes.map((doc) => {
    const student = doc.student || {};
    const profile = profileMap.get(student._id ? student._id.toString() : '');
    const drive = doc.placementDrive || {};
    const company = (drive.company && drive.company.name) || 'Company';
    const role = drive.jobRole || 'Role';
    const driveLifecycleState = drive._id ? getDriveLifecycleStatus(drive, now) : 'closed';

    const officerName =
      doc.verifiedBy && typeof doc.verifiedBy === 'object' && doc.verifiedBy.name
        ? doc.verifiedBy.name
        : doc.verifiedByName || 'Placement Officer';

    let ctc = null;
    if (
      doc.offerPackage &&
      typeof doc.offerPackage.ctc === 'number' &&
      Number.isFinite(doc.offerPackage.ctc) &&
      doc.offerPackage.ctc > 0
    ) {
      ctc = doc.offerPackage.ctc;
    }

    return {
      outcomeId: doc._id.toString(),
      applicationId: doc.application ? doc.application.toString() : '',
      studentName: student.name || 'Student',
      rollNumber: (profile && profile.rollNumber) || null,
      departmentName: (doc.departmentSnapshot && doc.departmentSnapshot.departmentName) || 'Unassigned / Other',
      company,
      role,
      driveId: drive._id ? drive._id.toString() : '',
      driveTitle: `${company} - ${role}`,
      driveLifecycleState,
      verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt).toISOString() : null,
      ctc,
      verifiedBy: {
        name: officerName,
      },
    };
  });

  return {
    outcomes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = {
  getOutcomesQueueService,
  getVerifiedOutcomesListService,
};

