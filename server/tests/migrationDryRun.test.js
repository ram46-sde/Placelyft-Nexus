const mongoose = require('mongoose');
const {
  validateTargetConfig,
  analyzeRollNumbers,
  analyzeStudentProfiles,
  analyzeApplications,
  analyzeDepartments,
  generateDryRunPlan,
  runAnalysis,
} = require('../scripts/migrateMilestone2');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const Company = require('../models/Company');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Milestone 2E - Migration Preparation and Dry-Run Validation Tests', () => {
  let collegeA;
  let collegeB;
  let defaultCollege;

  beforeAll(async () => {
    await connectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    collegeA = await College.create({
      name: 'College Alpha',
      contactEmail: 'admin@alpha.edu',
    });

    collegeB = await College.create({
      name: 'College Beta',
      contactEmail: 'admin@beta.edu',
    });

    defaultCollege = await College.create({
      name: 'Default Institution',
      contactEmail: 'admin@default.edu',
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('1. Roll-Number Formats, Missing, Null, Empty, and Whitespace Handling', () => {
    it('should correctly classify missing, null, empty string, and whitespace-only roll numbers', async () => {
      const u1 = await User.create({ name: 'U1', email: 'u1@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u2 = await User.create({ name: 'U2', email: 'u2@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u3 = await User.create({ name: 'U3', email: 'u3@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u4 = await User.create({ name: 'U4', email: 'u4@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u5 = await User.create({ name: 'U5', email: 'u5@alpha.edu', password: 'password123', collegeId: collegeA._id });

      // Insert directly into MongoDB collection to preserve raw untrimmed/whitespace values
      // (bypassing Mongoose trim:true casting) to test analyzer detection of raw database anomalies
      await mongoose.connection.db.collection('studentprofiles').insertMany([
        { user: u1._id, collegeId: collegeA._id },
        { user: u2._id, collegeId: collegeA._id, rollNumber: null },
        { user: u3._id, collegeId: collegeA._id, rollNumber: '' },
        { user: u4._id, collegeId: collegeA._id, rollNumber: '   ' },
        { user: u5._id, collegeId: collegeA._id, rollNumber: '  CS-2025  ' },
      ]);

      const analysis = await analyzeRollNumbers();

      expect(analysis.totalProfilesAudited).toBe(5);
      expect(analysis.nullOrMissingCount).toBe(2); // u1 (missing) + u2 (null)
      expect(analysis.emptyStringCount).toBe(1); // u3
      expect(analysis.whitespaceOnlyCount).toBe(1); // u4
      expect(analysis.untrimmedCount).toBe(1); // u5
    });
  });

  describe('2. Same-College vs Cross-College Duplicate Roll Numbers', () => {
    it('should flag same-college duplicates and distinguish cross-college identical numbers', async () => {
      const u1 = await User.create({ name: 'U1', email: 'u1@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u2 = await User.create({ name: 'U2', email: 'u2@alpha.edu', password: 'password123', collegeId: collegeA._id });
      const u3 = await User.create({ name: 'U3', email: 'u3@beta.edu', password: 'password123', collegeId: collegeB._id });

      // Same-college duplicate (case-insensitive)
      await StudentProfile.create({ user: u1._id, collegeId: collegeA._id, rollNumber: 'CSE-101' });
      await StudentProfile.create({ user: u2._id, collegeId: collegeA._id, rollNumber: 'cse-101' });

      // Cross-college identical roll number
      await StudentProfile.create({ user: u3._id, collegeId: collegeB._id, rollNumber: 'CSE-101' });

      const analysis = await analyzeRollNumbers();

      expect(analysis.sameCollegeDuplicates.length).toBe(1);
      expect(analysis.sameCollegeDuplicates[0].rollNumber).toBe('cse-101');
      expect(analysis.sameCollegeDuplicates[0].conflictingProfileCount).toBe(2);

      expect(analysis.crossCollegeDuplicates.length).toBe(1);
      expect(analysis.crossCollegeDuplicates[0].collegesInvolved.length).toBe(2);
    });
  });

  describe('3. Partial-Index Filter Compatibility with MongoDB Engine', () => {
    it('should confirm $type: string, $gt: "" partial index builds and enforces uniqueness correctly', async () => {
      const db = mongoose.connection.db;
      const testColl = db.collection('test_m2e_partial_idx');
      try { await testColl.drop(); } catch (e) {}

      // Build the exact proposed partial unique index
      await testColl.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'college_roll_partial_unique',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      const cidA = collegeA._id;
      const cidB = collegeB._id;

      // Missing, null, and empty string do NOT collide
      await testColl.insertOne({ collegeId: cidA, name: 'S1' });
      await testColl.insertOne({ collegeId: cidA, name: 'S2' });
      await testColl.insertOne({ collegeId: cidA, rollNumber: null });
      await testColl.insertOne({ collegeId: cidA, rollNumber: null });
      await testColl.insertOne({ collegeId: cidA, rollNumber: '' });
      await testColl.insertOne({ collegeId: cidA, rollNumber: '' });

      // Valid roll number in College A
      await testColl.insertOne({ collegeId: cidA, rollNumber: 'ROLL-101' });

      // Duplicate in same college -> REJECTED (error 11000)
      await expect(
        testColl.insertOne({ collegeId: cidA, rollNumber: 'roll-101' })
      ).rejects.toThrow(/E11000/);

      // Identical roll number in College B -> SUCCEEDS
      const crossCollegeDoc = await testColl.insertOne({ collegeId: cidB, rollNumber: 'ROLL-101' });
      expect(crossCollegeDoc.acknowledged).toBe(true);

      // Verify that $ne in partialFilterExpression is rejected by MongoDB engine
      await expect(
        testColl.createIndex(
          { collegeId: 1, altRoll: 1 },
          { unique: true, partialFilterExpression: { altRoll: { $ne: null } } }
        )
      ).rejects.toThrow();

      try { await testColl.drop(); } catch (e) {}
    });
  });

  describe('4. Unverified College Ownership Blocks Unsafe Backfills', () => {
    it('should pause backfill when user ownership is unverified', async () => {
      // Legacy user with unverified ownership tied to Default Institution
      const unverifiedUser = await User.create({
        name: 'Legacy Student',
        email: 'legacy_student@default.edu',
        password: 'password123',
        role: 'student',
        collegeId: defaultCollege._id,
        collegeAssignmentStatus: 'PENDING_APPROVAL',
      });

      // Student profile lacking collegeId, belonging to unverified user
      await StudentProfile.create({
        user: unverifiedUser._id,
        department: 'Computer Science',
      });

      // Drive application lacking collegeId
      const company = await Company.create({ name: 'Acme Corp' });
      const drive = await PlacementDrive.create({
        company: company._id,
        collegeId: defaultCollege._id,
        jobRole: 'Analyst',
        jobDescription: 'Data role',
        driveDate: new Date(),
        registrationDeadline: new Date(Date.now() + 86400000),
      });

      await DriveApplication.create({
        student: unverifiedUser._id,
        placementDrive: drive._id,
      });

      const profileAnalysis = await analyzeStudentProfiles();
      const appAnalysis = await analyzeApplications();

      // Profile must be blocked from automatic backfill
      expect(profileAnalysis.blockedByUnverifiedUser.length).toBe(1);
      expect(profileAnalysis.blockedByUnverifiedUser[0].note).toContain('Backfill paused');
      expect(profileAnalysis.pendingInheritance.length).toBe(0);

      // Application must be blocked from automatic backfill
      expect(appAnalysis.blockedByUnverifiedStudent.length).toBe(1);
      expect(appAnalysis.blockedByUnverifiedStudent[0].note).toContain('Application backfill paused');

      // Dry run plan must report PAUSED status
      const { dryRunPlan } = await runAnalysis('college_placement_test_db');
      expect(dryRunPlan.stages[0].status).toBe('PAUSED_AWAITING_ADMIN_VERIFICATION');
    });
  });

  describe('5. Deterministic Department Mapping & Ambiguous Review Flags', () => {
    it('should propose standard mappings for unambiguous strings and flag ambiguous cases for review', async () => {
      const u1 = await User.create({ name: 'U1', email: 'u1@a.edu', password: 'password123', collegeId: collegeA._id, collegeAssignmentStatus: 'VERIFIED' });
      const u2 = await User.create({ name: 'U2', email: 'u2@a.edu', password: 'password123', collegeId: collegeA._id, collegeAssignmentStatus: 'VERIFIED' });
      const u3 = await User.create({ name: 'U3', email: 'u3@a.edu', password: 'password123', collegeId: collegeA._id, collegeAssignmentStatus: 'VERIFIED' });

      // Unambiguous: standard uppercase code
      await StudentProfile.create({ user: u1._id, department: 'CSE' });
      // Unambiguous: standard full name
      await StudentProfile.create({ user: u2._id, department: 'Information Technology' });
      // Ambiguous: custom non-standard name
      await StudentProfile.create({ user: u3._id, department: 'Robotics and Nanotechnology' });

      const deptAnalysis = await analyzeDepartments();

      expect(deptAnalysis.proposedStandardMappings.length).toBe(2);
      expect(deptAnalysis.proposedStandardMappings.find((m) => m.legacyString === 'CSE').suggestedStandardCode).toBe('CSE');
      expect(deptAnalysis.proposedStandardMappings.find((m) => m.legacyString === 'Information Technology').suggestedStandardCode).toBe('IT');

      expect(deptAnalysis.ambiguousOrCustomDepartments.length).toBe(1);
      expect(deptAnalysis.ambiguousOrCustomDepartments[0].legacyString).toBe('Robotics and Nanotechnology');
      expect(deptAnalysis.ambiguousOrCustomDepartments[0].confidence).toBe('AMBIGUOUS_REQUIRES_REVIEW');

      // Verify that profile department field remains strictly unchanged
      const p3 = await StudentProfile.findOne({ user: u3._id });
      expect(p3.department).toBe('Robotics and Nanotechnology');
      expect(p3.departmentId).toBeUndefined();
    });
  });

  describe('6. Repeated Dry-Runs & Non-Mutating Invariants', () => {
    it('should produce identical dry-run plans on repeated runs with zero database modifications', async () => {
      const user = await User.create({
        name: 'Test Student',
        email: 'repeat_test@alpha.edu',
        password: 'password123',
        collegeId: collegeA._id,
        collegeAssignmentStatus: 'VERIFIED',
      });

      await StudentProfile.create({
        user: user._id,
        collegeId: collegeA._id,
        rollNumber: 'ROLL-REPEAT-1',
        department: 'Computer Science and Engineering',
      });

      // Capture collection document counts and index lists before analysis
      const collections = await mongoose.connection.db.listCollections().toArray();
      const countsBefore = {};
      const indexesBefore = {};

      for (const coll of collections) {
        countsBefore[coll.name] = await mongoose.connection.db.collection(coll.name).countDocuments();
        indexesBefore[coll.name] = (await mongoose.connection.db.collection(coll.name).indexes()).map((i) => i.name);
      }

      // Run dry-run 1
      const res1 = await runAnalysis('college_placement_test_db');
      // Run dry-run 2
      const res2 = await runAnalysis('college_placement_test_db');

      // Assert identical plans
      expect(res1.dryRunPlan.stages.length).toBe(res2.dryRunPlan.stages.length);
      expect(res1.analysis.users.totalUsers).toBe(res2.analysis.users.totalUsers);
      expect(res1.analysis.rollNumbers.totalProfilesAudited).toBe(res2.analysis.rollNumbers.totalProfilesAudited);

      // Assert 0 database mutations or index modifications
      for (const coll of collections) {
        const countAfter = await mongoose.connection.db.collection(coll.name).countDocuments();
        const indexesAfter = (await mongoose.connection.db.collection(coll.name).indexes()).map((i) => i.name);
        expect(countAfter).toBe(countsBefore[coll.name]);
        expect(indexesAfter).toEqual(indexesBefore[coll.name]);
      }
    });

    it('should reject invalid and forbidden database targets safely', () => {
      expect(() => validateTargetConfig('')).toThrow(/TARGET_UNSPECIFIED/);
      expect(() => validateTargetConfig('admin')).toThrow(/TARGET_FORBIDDEN/);
      expect(() => validateTargetConfig('production')).toThrow(/TARGET_FORBIDDEN/);
    });
  });
});
