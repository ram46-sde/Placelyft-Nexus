const mongoose = require('mongoose');
const {
  validateTargetConfig,
  maskId,
  analyzeUsers,
  analyzeStudentProfiles,
  analyzePlacementDrives,
  analyzeApplications,
  analyzeDepartments,
  analyzeRollNumbers,
  analyzeIndexes,
  runAnalysis,
} = require('../scripts/migrateMilestone2');
const College = require('../models/College');
const Department = require('../models/Department');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const Company = require('../models/Company');
const { connectTestDb, clearTestDb, disconnectTestDb, DEFAULT_TEST_MONGO_URI } = require('./testDb');

describe('Milestone 2D - Read-Only Migration Analyzer Tests', () => {
  let collegeA;
  let collegeB;
  let defaultCollege;

  beforeAll(async () => {
    await connectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create test college fixtures
    collegeA = await College.create({
      name: 'Alpha Engineering College',
      address: '100 Alpha Road',
      contactEmail: 'admin@alpha.edu',
    });

    collegeB = await College.create({
      name: 'Beta Institute of Technology',
      address: '200 Beta Road',
      contactEmail: 'admin@beta.edu',
    });

    defaultCollege = await College.create({
      name: 'Default Institution',
      address: '123 University Drive',
      contactEmail: 'admin@institution.edu',
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Database Target Safety and Refusal Guards', () => {
    it('should safely refuse empty or undefined target database', () => {
      expect(() => validateTargetConfig('')).toThrow(/TARGET_UNSPECIFIED/);
      expect(() => validateTargetConfig(null)).toThrow(/TARGET_UNSPECIFIED/);
      expect(() => validateTargetConfig('   ')).toThrow(/TARGET_UNSPECIFIED/);
    });

    it('should safely refuse protected and system databases', () => {
      expect(() => validateTargetConfig('admin')).toThrow(/TARGET_FORBIDDEN/);
      expect(() => validateTargetConfig('production')).toThrow(/TARGET_FORBIDDEN/);
      expect(() => validateTargetConfig('local')).toThrow(/TARGET_FORBIDDEN/);
      expect(() => validateTargetConfig('config')).toThrow(/TARGET_FORBIDDEN/);
    });

    it('should parse valid test database name and URI correctly', () => {
      const res1 = validateTargetConfig('college_placement_test_db');
      expect(res1.dbName).toBe('college_placement_test_db');
      expect(res1.uri).toBe('mongodb://127.0.0.1:27017/college_placement_test_db');

      const res2 = validateTargetConfig(DEFAULT_TEST_MONGO_URI);
      expect(res2.dbName).toBe('college_placement_test_db');
      expect(res2.uri).toBe(DEFAULT_TEST_MONGO_URI);
    });
  });

  describe('User Analysis & Legacy Unverified Assignment Detection', () => {
    it('should detect missing collegeId, invalid collegeId, and unverified Default Institution users', async () => {
      // 1. Super admin without collegeId (expected)
      await User.create({
        name: 'Super Admin',
        email: 'superadmin@platform.com',
        password: 'password123',
        role: 'super_admin',
      });

      // 2. Student without collegeId (missing)
      await User.create({
        name: 'Unassigned Student',
        email: 'unassigned@student.com',
        password: 'password123',
        role: 'student',
      });

      // 3. Student with invalid/non-existent collegeId
      const fakeCollegeId = new mongoose.Types.ObjectId();
      await User.create({
        name: 'Invalid College Student',
        email: 'invalid@student.com',
        password: 'password123',
        role: 'student',
        collegeId: fakeCollegeId,
      });

      // 4. Legacy student assigned to Default Institution with unverified status
      await User.create({
        name: 'Legacy Student',
        email: 'legacy@student.com',
        password: 'password123',
        role: 'student',
        collegeId: defaultCollege._id,
        collegeAssignmentStatus: 'PENDING_APPROVAL',
      });

      const userSummary = await analyzeUsers();

      expect(userSummary.totalUsers).toBe(4);
      expect(userSummary.usersWithoutCollege.length).toBe(2);
      expect(userSummary.usersWithInvalidCollege.length).toBe(1);
      expect(userSummary.unverifiedAssignments.length).toBe(1);
      expect(userSummary.legacyDefaultInstitutionUsers.length).toBe(1);

      const legacyEntry = userSummary.legacyDefaultInstitutionUsers[0];
      expect(legacyEntry.status).toBe('PENDING_APPROVAL');
      expect(legacyEntry.note).toContain('requires administrative verification');
    });
  });

  describe('Student Profile Ownership & Consistency Analysis', () => {
    it('should detect orphaned profiles, pending inheritance, and college mismatches', async () => {
      const userA = await User.create({
        name: 'Student A',
        email: 'student_a@alpha.edu',
        password: 'password123',
        role: 'student',
        collegeId: collegeA._id,
        collegeAssignmentStatus: 'VERIFIED',
      });

      const userB = await User.create({
        name: 'Student B',
        email: 'student_b@beta.edu',
        password: 'password123',
        role: 'student',
        collegeId: collegeB._id,
        collegeAssignmentStatus: 'VERIFIED',
      });

      // Profile pending college inheritance (has user, lacks collegeId)
      await StudentProfile.create({
        user: userA._id,
        department: 'Computer Science',
        course: 'B.Tech',
        batch: '2025',
      });

      // Profile with college mismatch (user belongs to collegeB, profile set to collegeA)
      await StudentProfile.create({
        user: userB._id,
        collegeId: collegeA._id,
        department: 'Information Technology',
        course: 'B.Tech',
        batch: '2025',
      });

      // Orphaned profile (references non-existent user)
      const ghostUserId = new mongoose.Types.ObjectId();
      await StudentProfile.create({
        user: ghostUserId,
        department: 'Mechanical',
        course: 'B.Tech',
        batch: '2025',
      });

      const profileSummary = await analyzeStudentProfiles();

      expect(profileSummary.totalProfiles).toBe(3);
      expect(profileSummary.pendingInheritance.length).toBe(1);
      expect(profileSummary.collegeMismatches.length).toBe(1);
      expect(profileSummary.orphanedProfiles.length).toBe(1);
    });
  });

  describe('Placement Drives & Applications Cross-Tenant Analysis', () => {
    it('should detect invalid drive college and cross-tenant application mismatches', async () => {
      const company = await Company.create({
        name: 'Tech Solutions Corp',
        industry: 'Software',
      });

      // Drive belonging to College A
      const driveCollegeA = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeA._id,
        jobRole: 'Software Engineer',
        jobDescription: 'Full stack development',
        packageDetails: '12 LPA',
        driveDate: new Date(),
        registrationDeadline: new Date(Date.now() + 86400000),
      });

      // Student belonging to College B
      const studentCollegeB = await User.create({
        name: 'Student Beta',
        email: 'student@beta.edu',
        password: 'password123',
        role: 'student',
        collegeId: collegeB._id,
      });

      // Cross-tenant application: student from College B applied to College A's drive
      await DriveApplication.create({
        student: studentCollegeB._id,
        placementDrive: driveCollegeA._id,
        status: 'Applied',
      });

      const driveSummary = await analyzePlacementDrives();
      expect(driveSummary.validDrives).toBe(1);
      expect(driveSummary.drivesWithoutCollege.length).toBe(0);

      const appSummary = await analyzeApplications();
      expect(appSummary.totalApplications).toBe(1);
      expect(appSummary.crossTenantMismatches.length).toBe(1);
      expect(appSummary.crossTenantMismatches[0].note).toContain('Cross-tenant application anomaly');
    });
  });

  describe('Department String Analysis & Mapping Suggestions', () => {
    it('should propose standard mappings for standard strings and flag ambiguous strings for review', async () => {
      const u1 = await User.create({ name: 'U1', email: 'u1@test.com', password: 'password123' });
      const u2 = await User.create({ name: 'U2', email: 'u2@test.com', password: 'password123' });
      const u3 = await User.create({ name: 'U3', email: 'u3@test.com', password: 'password123' });

      // Unambiguous standard strings
      await StudentProfile.create({ user: u1._id, department: 'Computer Science and Engineering' });
      await StudentProfile.create({ user: u2._id, department: 'IT' });

      // Ambiguous / custom non-standard string
      await StudentProfile.create({ user: u3._id, department: 'Robotics & Mechatronics' });

      const deptSummary = await analyzeDepartments();

      expect(deptSummary.totalDistinctDepartmentStrings).toBe(3);
      expect(deptSummary.proposedStandardMappings.length).toBe(2);
      expect(deptSummary.ambiguousOrCustomDepartments.length).toBe(1);

      const ambiguous = deptSummary.ambiguousOrCustomDepartments[0];
      expect(ambiguous.legacyString).toBe('Robotics & Mechatronics');
      expect(ambiguous.recommendation).toContain('manual review');

      // Verify that underlying student profile strings were NOT modified
      const p1 = await StudentProfile.findOne({ user: u1._id });
      expect(p1.department).toBe('Computer Science and Engineering');
      expect(p1.departmentId).toBeUndefined();
    });
  });

  describe('Roll Number Duplicate and Cross-College Analysis', () => {
    it('should identify same-college duplicates and distinguish cross-college identical roll numbers', async () => {
      const u1 = await User.create({ name: 'U1', email: 'u1@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u2 = await User.create({ name: 'U2', email: 'u2@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u3 = await User.create({ name: 'U3', email: 'u3@beta.edu', password: 'password123', collegeId: collegeB._id });

      // u1 and u2 in College A have duplicate roll number (case-insensitive duplicate)
      await StudentProfile.create({ user: u1._id, collegeId: collegeA._id, rollNumber: 'CS2025-001' });
      await StudentProfile.create({ user: u2._id, collegeId: collegeA._id, rollNumber: 'cs2025-001' });

      // u3 in College B has the same roll number (valid across colleges in multi-tenant, but conflicts with old global index)
      await StudentProfile.create({ user: u3._id, collegeId: collegeB._id, rollNumber: 'CS2025-001' });

      const rollSummary = await analyzeRollNumbers();

      expect(rollSummary.totalProfilesWithRollNumber).toBe(3);
      expect(rollSummary.sameCollegeDuplicates.length).toBe(1);
      expect(rollSummary.sameCollegeDuplicates[0].rollNumber).toBe('cs2025-001');
      expect(rollSummary.sameCollegeDuplicates[0].conflictingProfileCount).toBe(2);

      expect(rollSummary.crossCollegeDuplicates.length).toBe(1);
      expect(rollSummary.crossCollegeDuplicates[0].collegesInvolved.length).toBe(2);
    });
  });

  describe('Read-Only Invariant & Idempotence Enforcement', () => {
    it('should not modify any documents or indexes and should produce identical repeated analysis', async () => {
      const user = await User.create({
        name: 'Sample User',
        email: 'sample@alpha.edu',
        password: 'password123',
        collegeId: collegeA._id,
      });

      await StudentProfile.create({
        user: user._id,
        collegeId: collegeA._id,
        rollNumber: 'ROLL-100',
        department: 'Computer Science',
      });

      // Capture collection document counts before analysis
      const collections = await mongoose.connection.db.listCollections().toArray();
      const countsBefore = {};
      const indexesBefore = {};

      for (const coll of collections) {
        countsBefore[coll.name] = await mongoose.connection.db.collection(coll.name).countDocuments();
        indexesBefore[coll.name] = (await mongoose.connection.db.collection(coll.name).indexes()).map((i) => i.name);
      }

      // Run analysis 1
      const result1 = await runAnalysis('college_placement_test_db');

      // Run analysis 2 (repeatability check)
      const result2 = await runAnalysis('college_placement_test_db');

      expect(result1.analysis.users.totalUsers).toBe(result2.analysis.users.totalUsers);
      expect(result1.analysis.studentProfiles.totalProfiles).toBe(result2.analysis.studentProfiles.totalProfiles);
      expect(result1.analysis.rollNumbers.totalProfilesWithRollNumber).toBe(
        result2.analysis.rollNumbers.totalProfilesWithRollNumber
      );

      // Verify collection document counts and indexes after both runs
      for (const coll of collections) {
        const countAfter = await mongoose.connection.db.collection(coll.name).countDocuments();
        const indexesAfter = (await mongoose.connection.db.collection(coll.name).indexes()).map((i) => i.name);
        expect(countAfter).toBe(countsBefore[coll.name]);
        expect(indexesAfter).toEqual(indexesBefore[coll.name]);
      }
    });

    it('should ensure masked IDs are used and no sensitive student emails or passwords appear in the report', async () => {
      await User.create({
        name: 'Private Student',
        email: 'supersecret_student_email@alpha.edu',
        password: 'private_password_hash',
        role: 'student',
        collegeId: collegeA._id,
      });

      const { report } = await runAnalysis('college_placement_test_db');

      expect(report).not.toContain('supersecret_student_email@alpha.edu');
      expect(report).not.toContain('private_password_hash');
      expect(report).toContain('MILESTONE 2D: READ-ONLY MULTI-TENANT MIGRATION ANALYSIS REPORT');
      expect(report).toContain('STRICTLY READ-ONLY');
    });
  });
});
