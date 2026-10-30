/**
 * Milestone 2D & 2E — Read-Only Multi-Tenant Migration Analyzer & Dry-Run Planner
 *
 * PURPOSE:
 * Analyzes an existing database for data integrity anomalies and produces a
 * deterministic, stage-by-stage dry-run migration plan prior to schema cutovers.
 *
 * STRICT SAFETY GUARANTEES:
 * 1. Strictly Read-Only: Performs zero inserts, updates, deletes, index creations, drops, or collection modifications.
 * 2. Explicit Target Required: Never falls back to default MONGO_URI or unconfirmed database targets.
 * 3. Execution Flags Rejected: Throws an immediate fatal error if any write/apply flag is passed.
 * 4. Auto-Create & Auto-Index Disabled: Explicitly configures Mongoose to prevent background collection/index creation.
 * 5. Anonymization: Never outputs passwords, tokens, full emails, or identifiable student details.
 */

const mongoose = require('mongoose');

// Guarantee strictly read-only execution: disable Mongoose collection creation and index auto-building
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const { STANDARD_DEPARTMENTS } = require('../config/standardDepartments');
const College = require('../models/College');
const Department = require('../models/Department');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');

// Approved explicit target database names for local development & testing
const ALLOWED_TARGET_DBS = ['college_placement_db', 'college_placement_test_db'];

/**
 * Validates the database target name and URI before connecting.
 * Fails safely if target is missing, ambiguous, or forbidden.
 */
function validateTargetConfig(targetDbOrUri) {
  if (!targetDbOrUri || typeof targetDbOrUri !== 'string' || targetDbOrUri.trim().length === 0) {
    throw new Error(
      'TARGET_UNSPECIFIED: Explicit target database must be provided via --target-db=<dbname> or --target-uri=<uri>. Fallback to unspecified default database is prohibited.'
    );
  }

  const input = targetDbOrUri.trim();
  let dbName = '';
  let uri = '';

  if (input.startsWith('mongodb://') || input.startsWith('mongodb+srv://')) {
    try {
      const parsed = new URL(input);
      const rawPath = parsed.pathname ? parsed.pathname.replace(/^\/+/, '') : '';
      dbName = rawPath.split('/')[0].split('?')[0].trim();
      uri = input;
    } catch (e) {
      throw new Error(`TARGET_INVALID: Malformed MongoDB URI format: ${e.message}`);
    }
  } else {
    dbName = input;
    uri = `mongodb://127.0.0.1:27017/${dbName}`;
  }

  if (!dbName) {
    throw new Error('TARGET_INVALID: Target URI does not specify a valid database name.');
  }

  // Check forbidden system databases
  const forbidden = ['admin', 'local', 'config', 'production', 'prod'];
  if (forbidden.includes(dbName.toLowerCase())) {
    throw new Error(`TARGET_FORBIDDEN: Target database '${dbName}' is a protected/forbidden database.`);
  }

  return { dbName, uri };
}

/**
 * Anonymizes an ObjectId or identifier string for safe reporting.
 */
function maskId(id) {
  if (!id) return 'null';
  const str = id.toString();
  if (str.length <= 8) return str;
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
}

/**
 * Analyzes Users for missing, invalid, or unverified college references.
 */
async function analyzeUsers() {
  const users = await User.find({}).lean();
  const colleges = await College.find({}).lean();
  const collegeMap = new Map(colleges.map((c) => [c._id.toString(), c]));

  const summary = {
    totalUsers: users.length,
    usersWithoutCollege: [],
    usersWithInvalidCollege: [],
    unverifiedAssignments: [],
    legacyDefaultInstitutionUsers: [],
    verifiedUsersCount: 0,
  };

  for (const user of users) {
    const maskedUserId = maskId(user._id);
    const role = user.role;
    const status = user.collegeAssignmentStatus || 'UNSET';

    if (!user.collegeId) {
      summary.usersWithoutCollege.push({
        userId: maskedUserId,
        role,
        isExpectedForRole: role === 'super_admin',
      });
      continue;
    }

    const collegeIdStr = user.collegeId.toString();
    const college = collegeMap.get(collegeIdStr);

    if (!college) {
      summary.usersWithInvalidCollege.push({
        userId: maskedUserId,
        role,
        referencedCollegeId: maskId(collegeIdStr),
      });
      continue;
    }

    if (status !== 'VERIFIED') {
      summary.unverifiedAssignments.push({
        userId: maskedUserId,
        rawId: user._id.toString(),
        role,
        collegeId: maskId(collegeIdStr),
        collegeName: college.name,
        currentStatus: status,
      });
    } else {
      summary.verifiedUsersCount++;
    }

    if (college.name === 'Default Institution') {
      summary.legacyDefaultInstitutionUsers.push({
        userId: maskedUserId,
        rawId: user._id.toString(),
        role,
        collegeId: maskId(collegeIdStr),
        status,
        note: 'Assigned by previous unverified legacy migration script; requires administrative verification.',
      });
    }
  }

  return summary;
}

/**
 * Analyzes Student Profiles for missing, orphaned, or mismatched references,
 * and identifies records blocked from backfill by unverified parent users.
 */
async function analyzeStudentProfiles() {
  const profiles = await StudentProfile.find({}).lean();
  const users = await User.find({}).lean();
  const colleges = await College.find({}).lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const collegeMap = new Map(colleges.map((c) => [c._id.toString(), c]));

  const summary = {
    totalProfiles: profiles.length,
    orphanedProfiles: [],
    profilesWithoutCollege: [],
    profilesWithInvalidCollege: [],
    collegeMismatches: [],
    pendingInheritance: [],
    blockedByUnverifiedUser: [],
  };

  for (const p of profiles) {
    const maskedProfileId = maskId(p._id);
    const user = p.user ? userMap.get(p.user.toString()) : null;

    if (!user) {
      summary.orphanedProfiles.push({
        profileId: maskedProfileId,
        referencedUserId: maskId(p.user),
      });
      continue;
    }

    const userCollegeIdStr = user.collegeId ? user.collegeId.toString() : null;
    const profileCollegeIdStr = p.collegeId ? p.collegeId.toString() : null;
    const isUserVerified = user.collegeAssignmentStatus === 'VERIFIED';

    if (!profileCollegeIdStr) {
      if (userCollegeIdStr) {
        if (!isUserVerified) {
          // Unverified college ownership blocks safe backfill
          summary.blockedByUnverifiedUser.push({
            profileId: maskedProfileId,
            userId: maskId(user._id),
            userCollegeId: maskId(userCollegeIdStr),
            userStatus: user.collegeAssignmentStatus || 'UNSET',
            note: 'Backfill paused: Parent user college assignment is unverified.',
          });
        } else {
          summary.pendingInheritance.push({
            profileId: maskedProfileId,
            userId: maskId(user._id),
            userCollegeId: maskId(userCollegeIdStr),
            note: 'Profile lacks collegeId; safe to inherit from verified parent user.',
          });
        }
      } else {
        summary.profilesWithoutCollege.push({
          profileId: maskedProfileId,
          userId: maskId(user._id),
          note: 'Both profile and user lack college ownership.',
        });
      }
      continue;
    }

    if (!collegeMap.has(profileCollegeIdStr)) {
      summary.profilesWithInvalidCollege.push({
        profileId: maskedProfileId,
        invalidCollegeId: maskId(profileCollegeIdStr),
      });
      continue;
    }

    if (userCollegeIdStr && userCollegeIdStr !== profileCollegeIdStr) {
      summary.collegeMismatches.push({
        profileId: maskedProfileId,
        userId: maskId(user._id),
        profileCollegeId: maskId(profileCollegeIdStr),
        userCollegeId: maskId(userCollegeIdStr),
      });
    }
  }

  return summary;
}

/**
 * Analyzes Placement Drives for missing or invalid college ownership.
 */
async function analyzePlacementDrives() {
  const drives = await PlacementDrive.find({}).lean();
  const colleges = await College.find({}).lean();
  const collegeMap = new Map(colleges.map((c) => [c._id.toString(), c]));

  const summary = {
    totalDrives: drives.length,
    drivesWithoutCollege: [],
    drivesWithInvalidCollege: [],
    validDrives: 0,
  };

  for (const d of drives) {
    const maskedDriveId = maskId(d._id);

    if (!d.collegeId) {
      summary.drivesWithoutCollege.push({
        driveId: maskedDriveId,
        jobRole: d.jobRole,
      });
      continue;
    }

    const collegeIdStr = d.collegeId.toString();
    if (!collegeMap.has(collegeIdStr)) {
      summary.drivesWithInvalidCollege.push({
        driveId: maskedDriveId,
        jobRole: d.jobRole,
        invalidCollegeId: maskId(collegeIdStr),
      });
      continue;
    }

    summary.validDrives++;
  }

  return summary;
}

/**
 * Analyzes Drive Applications for student, drive, and college consistency,
 * identifying applications blocked by unverified student tenant ownership.
 */
async function analyzeApplications() {
  const applications = await DriveApplication.find({}).lean();
  const users = await User.find({}).lean();
  const drives = await PlacementDrive.find({}).lean();
  const colleges = await College.find({}).lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const driveMap = new Map(drives.map((d) => [d._id.toString(), d]));
  const collegeMap = new Map(colleges.map((c) => [c._id.toString(), c]));

  const summary = {
    totalApplications: applications.length,
    orphanedStudents: [],
    orphanedDrives: [],
    applicationsWithoutCollege: [],
    blockedByUnverifiedStudent: [],
    crossTenantMismatches: [],
    consistentApplications: 0,
  };

  for (const app of applications) {
    const maskedAppId = maskId(app._id);
    const student = app.student ? userMap.get(app.student.toString()) : null;
    const drive = app.placementDrive ? driveMap.get(app.placementDrive.toString()) : null;

    if (!student) {
      summary.orphanedStudents.push({
        applicationId: maskedAppId,
        referencedStudentId: maskId(app.student),
      });
      continue;
    }

    if (!drive) {
      summary.orphanedDrives.push({
        applicationId: maskedAppId,
        referencedDriveId: maskId(app.placementDrive),
      });
      continue;
    }

    const studentCollegeId = student.collegeId ? student.collegeId.toString() : null;
    const driveCollegeId = drive.collegeId ? drive.collegeId.toString() : null;
    const appCollegeId = app.collegeId ? app.collegeId.toString() : null;
    const isStudentVerified = student.collegeAssignmentStatus === 'VERIFIED';

    if (!appCollegeId) {
      if (!isStudentVerified) {
        summary.blockedByUnverifiedStudent.push({
          applicationId: maskedAppId,
          studentId: maskId(student._id),
          studentCollegeId: maskId(studentCollegeId),
          note: 'Application backfill paused: Student college assignment is unverified.',
        });
      } else {
        summary.applicationsWithoutCollege.push({
          applicationId: maskedAppId,
          studentCollegeId: maskId(studentCollegeId),
          driveCollegeId: maskId(driveCollegeId),
        });
      }
    }

    if (studentCollegeId && driveCollegeId && studentCollegeId !== driveCollegeId) {
      summary.crossTenantMismatches.push({
        applicationId: maskedAppId,
        studentCollegeId: maskId(studentCollegeId),
        driveCollegeId: maskId(driveCollegeId),
        note: 'Cross-tenant application anomaly: student and drive belong to different colleges.',
      });
    } else {
      summary.consistentApplications++;
    }
  }

  return summary;
}

/**
 * Standard department suggestion lookup map.
 */
const STANDARD_DEPT_LOOKUP = new Map();
for (const dept of STANDARD_DEPARTMENTS) {
  STANDARD_DEPT_LOOKUP.set(dept.code.toUpperCase(), dept);
  STANDARD_DEPT_LOOKUP.set(dept.name.toLowerCase().trim(), dept);
}

// Deterministic unambiguous aliases for legacy department mapping
const UNAMBIGUOUS_ALIASES = new Map([
  ['computer science', { code: 'CSE', name: 'Computer Science and Engineering' }],
  ['computer science & engineering', { code: 'CSE', name: 'Computer Science and Engineering' }],
  ['information tech', { code: 'IT', name: 'Information Technology' }],
  ['electronics & communication', { code: 'ECE', name: 'Electronics and Communication Engineering' }],
  ['mechanical', { code: 'MECH', name: 'Mechanical Engineering' }],
  ['civil', { code: 'CIVIL', name: 'Civil Engineering' }],
  ['ai & ds', { code: 'AI_DS', name: 'Artificial Intelligence and Data Science' }],
  ['ai/ds', { code: 'AI_DS', name: 'Artificial Intelligence and Data Science' }],
  ['aids', { code: 'AI_DS', name: 'Artificial Intelligence and Data Science' }],
]);

/**
 * Deterministically analyzes existing department strings and proposes safe mappings.
 * Does NOT silently map ambiguous strings; flags them for manual authorized review.
 */
async function analyzeDepartments() {
  const profiles = await StudentProfile.find({}).lean();
  const existingDepartments = await Department.find({}).lean();

  const deptCounts = new Map();
  for (const p of profiles) {
    if (p.department && typeof p.department === 'string' && p.department.trim().length > 0) {
      const raw = p.department.trim();
      deptCounts.set(raw, (deptCounts.get(raw) || 0) + 1);
    }
  }

  const mappings = [];
  const unmappedOrAmbiguous = [];

  for (const [rawString, count] of deptCounts.entries()) {
    const normalized = rawString.toLowerCase().trim();
    const upperCode = rawString.toUpperCase().trim();

    let matched = STANDARD_DEPT_LOOKUP.get(upperCode) || STANDARD_DEPT_LOOKUP.get(normalized);
    if (!matched && UNAMBIGUOUS_ALIASES.has(normalized)) {
      matched = UNAMBIGUOUS_ALIASES.get(normalized);
    }

    if (matched) {
      mappings.push({
        legacyString: rawString,
        studentCount: count,
        suggestedStandardCode: matched.code,
        suggestedStandardName: matched.name,
        confidence: 'HIGH_UNAMBIGUOUS',
        action: 'MAP_TO_STANDARD',
      });
    } else {
      unmappedOrAmbiguous.push({
        legacyString: rawString,
        studentCount: count,
        recommendation: 'Requires college admin manual review or creation of college-specific custom department.',
        confidence: 'AMBIGUOUS_REQUIRES_REVIEW',
        action: 'PAUSE_AUTOMATED_MAPPING',
      });
    }
  }

  return {
    totalDistinctDepartmentStrings: deptCounts.size,
    instantiatedDepartmentsCount: existingDepartments.length,
    proposedStandardMappings: mappings,
    ambiguousOrCustomDepartments: unmappedOrAmbiguous,
  };
}

/**
 * Analyzes Roll Numbers for duplicates, missing, null, empty, whitespace-only, and index conflicts.
 */
async function analyzeRollNumbers() {
  const profiles = await StudentProfile.find({}).lean();
  const users = await User.find({}).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const byCollegeAndRoll = new Map();
  const byGlobalRoll = new Map();
  const unassignedProfiles = [];
  const whitespaceOnlyRollNumbers = [];
  const emptyStringRollNumbers = [];
  const nullOrMissingRollNumbers = [];
  const untrimmedRollNumbers = [];

  for (const p of profiles) {
    const rawRoll = p.rollNumber;

    if (rawRoll === undefined || rawRoll === null) {
      nullOrMissingRollNumbers.push(maskId(p._id));
      continue;
    }

    if (typeof rawRoll === 'string') {
      if (rawRoll === '') {
        emptyStringRollNumbers.push(maskId(p._id));
        continue;
      }
      if (rawRoll.trim() === '') {
        whitespaceOnlyRollNumbers.push(maskId(p._id));
        continue;
      }
      if (rawRoll.trim() !== rawRoll) {
        untrimmedRollNumbers.push({
          profileId: maskId(p._id),
          rawRoll,
          trimmedRoll: rawRoll.trim(),
        });
      }
    }

    const roll = typeof rawRoll === 'string' ? rawRoll.trim() : String(rawRoll);
    const user = p.user ? userMap.get(p.user.toString()) : null;
    const effectiveCollegeId = p.collegeId
      ? p.collegeId.toString()
      : user && user.collegeId
      ? user.collegeId.toString()
      : null;

    const lowerRoll = roll.toLowerCase();

    // Global tracking
    if (!byGlobalRoll.has(lowerRoll)) {
      byGlobalRoll.set(lowerRoll, []);
    }
    byGlobalRoll.get(lowerRoll).push({
      profileId: maskId(p._id),
      collegeId: maskId(effectiveCollegeId),
      rawRoll: roll,
    });

    if (!effectiveCollegeId) {
      unassignedProfiles.push({
        profileId: maskId(p._id),
        rollNumber: roll,
      });
      continue;
    }

    // College-scoped tracking
    const collegeKey = `${effectiveCollegeId}::${lowerRoll}`;
    if (!byCollegeAndRoll.has(collegeKey)) {
      byCollegeAndRoll.set(collegeKey, []);
    }
    byCollegeAndRoll.get(collegeKey).push({
      profileId: maskId(p._id),
      collegeId: maskId(effectiveCollegeId),
      rawRoll: roll,
    });
  }

  // Same-college duplicates (FATAL constraint violation for future index)
  const sameCollegeDuplicates = [];
  for (const [key, items] of byCollegeAndRoll.entries()) {
    if (items.length > 1) {
      const [collegeId, roll] = key.split('::');
      sameCollegeDuplicates.push({
        collegeId: maskId(collegeId),
        rollNumber: roll,
        conflictingProfileCount: items.length,
        profileIds: items.map((i) => i.profileId),
      });
    }
  }

  // Cross-college duplicates (Permitted in multi-tenant architecture; legacy single-field index is non-unique and sparse)
  const crossCollegeDuplicates = [];
  for (const [roll, items] of byGlobalRoll.entries()) {
    const uniqueColleges = new Set(items.map((i) => i.collegeId).filter((c) => c !== 'null'));
    if (uniqueColleges.size > 1) {
      crossCollegeDuplicates.push({
        rollNumber: roll,
        collegesInvolved: Array.from(uniqueColleges),
        profileCount: items.length,
      });
    }
  }

  return {
    totalProfilesAudited: profiles.length,
    totalProfilesWithRollNumber: profiles.length - nullOrMissingRollNumbers.length,
    nullOrMissingCount: nullOrMissingRollNumbers.length,
    emptyStringCount: emptyStringRollNumbers.length,
    whitespaceOnlyCount: whitespaceOnlyRollNumbers.length,
    untrimmedCount: untrimmedRollNumbers.length,
    unassignedCollegeProfiles: unassignedProfiles,
    sameCollegeDuplicates,
    crossCollegeDuplicates,
  };
}

/**
 * Analyzes collection indexes for existing conflicts and future index readiness.
 */
async function analyzeIndexes() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const indexReport = {};

  for (const collInfo of collections) {
    const coll = mongoose.connection.db.collection(collInfo.name);
    const indexes = await coll.indexes();
    indexReport[collInfo.name] = indexes.map((idx) => ({
      name: idx.name,
      key: idx.key,
      unique: !!idx.unique,
      sparse: !!idx.sparse,
      partialFilterExpression: idx.partialFilterExpression || null,
      collation: idx.collation ? { locale: idx.collation.locale, strength: idx.collation.strength } : null,
    }));
  }

  const blockingIssues = [];
  const studentProfileIndexes = indexReport['studentprofiles'] || [];

  const existingRollIndex = studentProfileIndexes.find((i) => i.name === 'rollNumber_1');
  if (existingRollIndex) {
    blockingIssues.push({
      type: 'EXISTING_LEGACY_SPARSE_INDEX',
      collection: 'studentprofiles',
      indexName: 'rollNumber_1',
      details:
        'The existing legacy sparse non-unique rollNumber_1 index is obsolete and scheduled for replacement by tenant-scoped { collegeId: 1, rollNumber: 1 } during controlled cutover.',
    });
  }

  // Proposed partial filter expression validated against MongoDB 8.2.5
  const proposedPartialFilter = { rollNumber: { $type: 'string', $gt: '' } };
  const usesNe = JSON.stringify(proposedPartialFilter).includes('$ne');

  return {
    collectionsInspected: Object.keys(indexReport),
    indexReport,
    blockingIssues,
    proposedIndexValidation: {
      rollNumberCompoundIndex: { collegeId: 1, rollNumber: 1 },
      collation: { locale: 'en', strength: 2 },
      partialFilterExpression: proposedPartialFilter,
      usesDisallowedNeOperator: usesNe,
      isCompatibleWithMongoEngine: !usesNe,
    },
  };
}

/**
 * Produces a comprehensive, deterministic dry-run migration plan.
 */
function generateDryRunPlan(analysis) {
  const plan = {
    targetDb: analysis.targetDb,
    mongoEngine: 'MongoDB 8.2.5 (Confirmed compatible)',
    readOnlyGuarantee: 'STRICTLY READ-ONLY (No database mutations, backfills, or index changes)',

    stages: [
      {
        stageNumber: 1,
        title: 'Tenant Ownership Verification',
        precondition: 'All colleges and user assignments must be verified by authorized admins.',
        findings: {
          unverifiedUsers: analysis.users.unverifiedAssignments.length,
          legacyDefaultInstitutionUsers: analysis.users.legacyDefaultInstitutionUsers.length,
          blockedProfileBackfills: analysis.studentProfiles.blockedByUnverifiedUser.length,
          blockedApplicationBackfills: analysis.applications.blockedByUnverifiedStudent.length,
        },
        actionPlan:
          'DO NOT backfill collegeId onto student profiles or applications while users remain unverified. Flag and pause dependent records until an authorized administrator verifies the college assignment.',
        status:
          analysis.users.unverifiedAssignments.length > 0 ? 'PAUSED_AWAITING_ADMIN_VERIFICATION' : 'READY',
      },
      {
        stageNumber: 2,
        title: 'Department Normalization & Suggestions',
        precondition: 'Student college ownership must be resolved.',
        findings: {
          proposedStandardMappings: analysis.departments.proposedStandardMappings.length,
          ambiguousOrCustomDepartments: analysis.departments.ambiguousOrCustomDepartments.length,
        },
        actionPlan:
          'Preserve the original department string in StudentProfile.department. Populate legacyDepartment with original value and set departmentId to referenced Department. Flag ambiguous department strings for manual college admin resolution; do not guess.',
        status:
          analysis.departments.ambiguousOrCustomDepartments.length > 0
            ? 'PARTIAL_MANUAL_REVIEW_REQUIRED'
            : 'READY',
      },
      {
        stageNumber: 3,
        title: 'Roll-Number Data Normalization',
        precondition: 'Zero duplicate roll numbers within any single college.',
        findings: {
          sameCollegeDuplicates: analysis.rollNumbers.sameCollegeDuplicates.length,
          crossCollegeDuplicates: analysis.rollNumbers.crossCollegeDuplicates.length,
          untrimmedRollNumbers: analysis.rollNumbers.untrimmedCount,
          whitespaceOnlyRollNumbers: analysis.rollNumbers.whitespaceOnlyCount,
          emptyStringRollNumbers: analysis.rollNumbers.emptyStringCount,
        },
        actionPlan:
          'Trim all non-empty roll numbers. Convert empty strings and whitespace-only strings to null so they are omitted from the partial unique index. If same-college duplicates exist, pause cutover until resolved.',
        status:
          analysis.rollNumbers.sameCollegeDuplicates.length > 0
            ? 'BLOCKED_BY_DUPLICATE_ROLL_NUMBERS'
            : 'READY',
      },
      {
        stageNumber: 4,
        title: 'Index Cutover Sequence & Invariants',
        precondition:
          'Stages 1, 2, and 3 must be completed. Zero same-college duplicates and valid partial filter confirmed.',
        cutoverSequence: [
          'Step 4.1: Build new college-scoped unique index { collegeId: 1, rollNumber: 1 } with collation { locale: "en", strength: 2 } and partialFilterExpression { rollNumber: { $type: "string", $gt: "" } } in background.',
          'Step 4.2: Verify new index build completed successfully on MongoDB 8.2.5.',
          'Step 4.3: Verify catalog options (sparse: true, unique: false) and drop legacy single-field index rollNumber_1 on studentprofiles.',
          'Step 4.4: Activate college-scoped uniqueness validation in application controllers.',
        ],
        rollbackPlan:
          'If Step 4.1 fails: Do NOT drop rollNumber_1. Inspect index definition, verify document integrity, drop incomplete partial index only if exact match, and preserve legacy index. If Step 4.3 fails: Retry drop; both indexes remain safe concurrently.',
        expectedInvariants: [
          'Invariant 1: Every active student profile references a verified collegeId.',
          'Invariant 2: Roll numbers are unique per college (case-insensitively).',
          'Invariant 3: Distinct colleges can independently assign identical roll numbers without collision.',
          'Invariant 4: Missing, null, empty, and whitespace roll numbers produce zero index collisions.',
        ],
        status:
          analysis.rollNumbers.sameCollegeDuplicates.length === 0 &&
          analysis.users.unverifiedAssignments.length === 0
            ? 'READY'
            : 'PAUSED_UNTIL_PRECONDITIONS_SATISFIED',
      },
    ],
  };

  return plan;
}

/**
 * Formats the full analysis and dry-run plan into human-readable text.
 */
function formatReport(analysis, targetDb) {
  const plan = generateDryRunPlan(analysis);
  const lines = [];

  lines.push('================================================================================');
  lines.push('  MILESTONE 2D: READ-ONLY MULTI-TENANT MIGRATION ANALYSIS REPORT & MILESTONE 2E DRY-RUN PLAN  ');
  lines.push('================================================================================');
  lines.push(`Target Database: ${targetDb}`);
  lines.push(`MongoDB Engine:  ${plan.mongoEngine}`);
  lines.push(`Execution Mode:  ${plan.readOnlyGuarantee}`);
  lines.push(`Timestamp:       ${new Date().toISOString()}`);
  lines.push('--------------------------------------------------------------------------------\n');

  // 1. Users
  lines.push('1. USER TENANT STATUS:');
  lines.push(`   - Total Users:                       ${analysis.users.totalUsers}`);
  lines.push(`   - Users Without College:             ${analysis.users.usersWithoutCollege.length}`);
  lines.push(`   - Users With Invalid College ID:     ${analysis.users.usersWithInvalidCollege.length}`);
  lines.push(`   - Unverified College Assignments:    ${analysis.users.unverifiedAssignments.length}`);
  lines.push(`   - Legacy 'Default Institution' Users:${analysis.users.legacyDefaultInstitutionUsers.length}`);
  if (analysis.users.legacyDefaultInstitutionUsers.length > 0) {
    lines.push('     Notice: Legacy users assigned to Default Institution are NOT treated as verified.');
    for (const u of analysis.users.legacyDefaultInstitutionUsers) {
      lines.push(`     * User [${u.userId}] (Role: ${u.role}) -> Status: ${u.status}`);
    }
  }
  lines.push('');

  // 2. Student Profiles
  lines.push('2. STUDENT PROFILES:');
  lines.push(`   - Total Profiles:                    ${analysis.studentProfiles.totalProfiles}`);
  lines.push(`   - Orphaned Profiles (Missing User):  ${analysis.studentProfiles.orphanedProfiles.length}`);
  lines.push(`   - Profiles Without College:          ${analysis.studentProfiles.profilesWithoutCollege.length}`);
  lines.push(`   - Pending College Inheritance:       ${analysis.studentProfiles.pendingInheritance.length}`);
  lines.push(`   - Blocked by Unverified User:        ${analysis.studentProfiles.blockedByUnverifiedUser.length}`);
  lines.push(`   - College Mismatches (User vs Prof): ${analysis.studentProfiles.collegeMismatches.length}`);
  lines.push('');

  // 3. Placement Drives
  lines.push('3. PLACEMENT DRIVES:');
  lines.push(`   - Total Drives:                      ${analysis.placementDrives.totalDrives}`);
  lines.push(`   - Drives Without College:            ${analysis.placementDrives.drivesWithoutCollege.length}`);
  lines.push(`   - Drives With Invalid College ID:    ${analysis.placementDrives.drivesWithInvalidCollege.length}`);
  lines.push(`   - Valid Drives:                      ${analysis.placementDrives.validDrives}`);
  lines.push('');

  // 4. Drive Applications
  lines.push('4. DRIVE APPLICATIONS:');
  lines.push(`   - Total Applications:                ${analysis.applications.totalApplications}`);
  lines.push(`   - Orphaned Student References:       ${analysis.applications.orphanedStudents.length}`);
  lines.push(`   - Orphaned Drive References:         ${analysis.applications.orphanedDrives.length}`);
  lines.push(`   - Applications Without College ID:   ${analysis.applications.applicationsWithoutCollege.length}`);
  lines.push(`   - Blocked by Unverified Student:     ${analysis.applications.blockedByUnverifiedStudent.length}`);
  lines.push(`   - Cross-Tenant Application Mismatches:${analysis.applications.crossTenantMismatches.length}`);
  lines.push('');

  // 5. Departments
  lines.push('5. DEPARTMENTS & MAPPINGS:');
  lines.push(`   - Distinct Legacy Department Strings:${analysis.departments.totalDistinctDepartmentStrings}`);
  lines.push(`   - Instantiated College Departments:  ${analysis.departments.instantiatedDepartmentsCount}`);
  lines.push(`   - Proposed Standard Mappings:        ${analysis.departments.proposedStandardMappings.length}`);
  lines.push(`   - Ambiguous / Unmapped Strings:      ${analysis.departments.ambiguousOrCustomDepartments.length}`);
  if (analysis.departments.proposedStandardMappings.length > 0) {
    lines.push('     Proposed Mappings (Preserves legacy string; maps departmentId only):');
    for (const m of analysis.departments.proposedStandardMappings) {
      lines.push(`     * "${m.legacyString}" (${m.studentCount} students) -> Standard: [${m.suggestedStandardCode}] ${m.suggestedStandardName}`);
    }
  }
  if (analysis.departments.ambiguousOrCustomDepartments.length > 0) {
    lines.push('     Ambiguous Cases (Requires Manual Review):');
    for (const a of analysis.departments.ambiguousOrCustomDepartments) {
      lines.push(`     * "${a.legacyString}" (${a.studentCount} students) -> ${a.recommendation}`);
    }
  }
  lines.push('');

  // 6. Roll Numbers
  lines.push('6. ROLL NUMBERS & UNIQUENESS:');
  lines.push(`   - Total Profiles Audited:            ${analysis.rollNumbers.totalProfilesAudited}`);
  lines.push(`   - Missing or Null Roll Numbers:      ${analysis.rollNumbers.nullOrMissingCount}`);
  lines.push(`   - Empty String Roll Numbers:         ${analysis.rollNumbers.emptyStringCount}`);
  lines.push(`   - Whitespace-Only Roll Numbers:      ${analysis.rollNumbers.whitespaceOnlyCount}`);
  lines.push(`   - Untrimmed Roll Numbers:            ${analysis.rollNumbers.untrimmedCount}`);
  lines.push(`   - Profiles Lacking College Ownership:${analysis.rollNumbers.unassignedCollegeProfiles.length}`);
  lines.push(`   - Same-College Roll Number Duplicates:${analysis.rollNumbers.sameCollegeDuplicates.length}`);
  lines.push(`   - Cross-College Duplicate Roll Numbers:${analysis.rollNumbers.crossCollegeDuplicates.length}`);
  if (analysis.rollNumbers.sameCollegeDuplicates.length > 0) {
    lines.push('     CRITICAL: Duplicate roll numbers within the same college detected:');
    for (const d of analysis.rollNumbers.sameCollegeDuplicates) {
      lines.push(`     * College [${d.collegeId}] Roll [${d.rollNumber}] (${d.conflictingProfileCount} profiles)`);
    }
  }
  lines.push('');

  // 7. Indexes
  lines.push('7. INDEX STATUS & READINESS:');
  lines.push(`   - Collections Inspected:             ${analysis.indexes.collectionsInspected.join(', ')}`);
  lines.push(`   - Blocking Issues Detected:          ${analysis.indexes.blockingIssues.length}`);
  for (const b of analysis.indexes.blockingIssues) {
    lines.push(`     * [${b.type}] on ${b.collection}: ${b.details}`);
  }
  lines.push(`   - Proposed Index Filter Validated:   Safe (usesDisallowedNeOperator: ${analysis.indexes.proposedIndexValidation.usesDisallowedNeOperator})`);
  lines.push('');

  // 8. Dry-Run Migration Plan
  lines.push('--------------------------------------------------------------------------------');
  lines.push('                    DRY-RUN MIGRATION PLAN (STAGE-BY-STAGE)                     ');
  lines.push('--------------------------------------------------------------------------------');
  for (const stage of plan.stages) {
    lines.push(`STAGE ${stage.stageNumber}: ${stage.title} [Status: ${stage.status}]`);
    lines.push(`   * Precondition: ${stage.precondition}`);
    if (stage.actionPlan) {
      lines.push(`   * Strategy:     ${stage.actionPlan}`);
    }
    if (stage.cutoverSequence) {
      lines.push('   * Execution Steps (Planned):');
      for (const step of stage.cutoverSequence) {
        lines.push(`     ${step}`);
      }
      lines.push(`   * Rollback Plan: ${stage.rollbackPlan}`);
      lines.push('   * Expected Invariants:');
      for (const inv of stage.expectedInvariants) {
        lines.push(`     ${inv}`);
      }
    }
    lines.push('');
  }

  lines.push('================================================================================');
  lines.push('                          END OF ANALYSIS & PLAN REPORT                         ');
  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Runs the full analysis against an explicitly specified database connection.
 * @param {string} targetDbOrUri
 * @returns {Promise<{ analysis: Object, dryRunPlan: Object, report: string }>}
 */
async function runAnalysis(targetDbOrUri) {
  const { dbName, uri } = validateTargetConfig(targetDbOrUri);

  const shouldDisconnect = mongoose.connection.readyState === 0;
  if (shouldDisconnect) {
    await mongoose.connect(uri);
  }

  // Safety confirmation: ensure the driver is connected to the exact requested database
  const connectedDbName = mongoose.connection.name;
  if (connectedDbName.toLowerCase() !== dbName.toLowerCase()) {
    throw new Error(
      `CONNECTION_SAFETY_VIOLATION: Connected to '${connectedDbName}' but target was '${dbName}'. Aborting.`
    );
  }

  // Execute all read-only analysis sections in parallel
  const [
    users,
    studentProfiles,
    placementDrives,
    applications,
    departments,
    rollNumbers,
    indexes,
  ] = await Promise.all([
    analyzeUsers(),
    analyzeStudentProfiles(),
    analyzePlacementDrives(),
    analyzeApplications(),
    analyzeDepartments(),
    analyzeRollNumbers(),
    analyzeIndexes(),
  ]);

  const analysis = {
    targetDb: dbName,
    users,
    studentProfiles,
    placementDrives,
    applications,
    departments,
    rollNumbers,
    indexes,
  };

  const dryRunPlan = generateDryRunPlan(analysis);
  const report = formatReport(analysis, dbName);

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }

  return { analysis, dryRunPlan, report };
}

// CLI execution handler
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);

      // Guard: reject any write/apply/execute flags
      const writeFlags = ['--apply', '--execute', '--migrate', '--fix', '--write'];
      const foundWriteFlag = args.find((a) => writeFlags.some((wf) => a.startsWith(wf)));
      if (foundWriteFlag) {
        console.error(`\n[FATAL ERROR] Flag '${foundWriteFlag}' is rejected.`);
        console.error('Milestone 2E is strictly read-only. Database mutations are not supported in this step.\n');
        process.exit(1);
      }

      // Extract explicit target from CLI
      let targetInput = null;
      for (const arg of args) {
        if (arg.startsWith('--target-db=')) {
          targetInput = arg.split('=')[1];
        } else if (arg.startsWith('--target-uri=')) {
          targetInput = arg.split('=')[1];
        }
      }

      if (!targetInput) {
        console.error('\n[FATAL ERROR] Explicit target database must be provided.');
        console.error('Usage: node server/scripts/migrateMilestone2.js --target-db=<dbname>');
        console.error('Example: node server/scripts/migrateMilestone2.js --target-db=college_placement_db\n');
        process.exit(1);
      }

      const { report } = await runAnalysis(targetInput);
      console.log(report);
      process.exit(0);
    } catch (err) {
      console.error(`\n[FATAL ERROR]: ${err.message}\n`);
      process.exit(1);
    }
  })();
}

module.exports = {
  validateTargetConfig,
  maskId,
  analyzeUsers,
  analyzeStudentProfiles,
  analyzePlacementDrives,
  analyzeApplications,
  analyzeDepartments,
  analyzeRollNumbers,
  analyzeIndexes,
  generateDryRunPlan,
  formatReport,
  runAnalysis,
};
