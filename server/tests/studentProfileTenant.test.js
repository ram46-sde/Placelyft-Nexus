const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const { executeSafeConditionalRollback, RollbackPreconditionError } = require('../scripts/safeRollback');

describe('Milestone 2F.1 — Student Profile Multi-Tenant Validation & Security Tests', () => {
  let collegeAlpha;
  let collegeBeta;

  let verifiedStudentA1;
  let tokenA1;

  let verifiedStudentA2;
  let tokenA2;

  let verifiedStudentB;
  let tokenB;

  let unverifiedStudent;
  let tokenUnverified;

  let noCollegeStudent;
  let tokenNoCollege;

  let recruiterUser;
  let tokenRecruiter;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'College Alpha',
      contactEmail: 'admin@alpha.edu',
    });

    collegeBeta = await College.create({
      name: 'College Beta',
      contactEmail: 'admin@beta.edu',
    });

    // 2. Verified Student 1 in College Alpha
    verifiedStudentA1 = await User.create({
      name: 'Student Alpha One',
      email: 'alpha1@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenA1 = generateToken(verifiedStudentA1._id, 'student');

    // 3. Verified Student 2 in College Alpha
    verifiedStudentA2 = await User.create({
      name: 'Student Alpha Two',
      email: 'alpha2@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenA2 = generateToken(verifiedStudentA2._id, 'student');

    // 4. Verified Student in College Beta
    verifiedStudentB = await User.create({
      name: 'Student Beta',
      email: 'beta@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenB = generateToken(verifiedStudentB._id, 'student');

    // 5. Unverified Student (Pending Approval)
    unverifiedStudent = await User.create({
      name: 'Unverified Student',
      email: 'unverified@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'PENDING_APPROVAL',
    });
    tokenUnverified = generateToken(unverifiedStudent._id, 'student');

    // 6. Student with No College Assigned
    noCollegeStudent = await User.create({
      name: 'Unaffiliated Student',
      email: 'unaffiliated@example.com',
      password: 'password123',
      role: 'student',
    });
    tokenNoCollege = generateToken(noCollegeStudent._id, 'student');

    // 7. Non-student user (Recruiter)
    recruiterUser = await User.create({
      name: 'Tech Recruiter',
      email: 'recruiter@techcorp.com',
      password: 'password123',
      role: 'recruiter',
    });
    tokenRecruiter = generateToken(recruiterUser._id, 'recruiter');
  });

  describe('1. College Assignment Enforcement (Missing & Unverified Assignments)', () => {
    it('should reject profile GET and PUT if student account is not associated with an institution', async () => {
      // GET
      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenNoCollege}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.message).toMatch(/not associated with an institution/i);

      // PUT
      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenNoCollege}`)
        .send({ department: 'Computer Science', cgpa: 8.5 });

      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);
      expect(putRes.body.message).toMatch(/not associated with an institution/i);
    });

    it('should reject profile GET and PUT if student account college assignment is not verified', async () => {
      // GET
      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenUnverified}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.message).toMatch(/college assignment is not verified/i);

      // PUT
      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenUnverified}`)
        .send({ department: 'Computer Science', cgpa: 8.5 });

      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);
      expect(putRes.body.message).toMatch(/college assignment is not verified/i);
    });

    it('should allow profile creation and retrieval for students with verified college assignments', async () => {
      // Initial GET (null profile)
      const initialGet = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`);

      expect(initialGet.status).toBe(200);
      expect(initialGet.body.success).toBe(true);
      expect(initialGet.body.profile).toBeNull();

      // PUT to create profile
      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          rollNumber: 'CS-2025-001',
          department: 'Computer Science',
          course: 'B.Tech',
          cgpa: 9.1,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.profile.rollNumber).toBe('CS-2025-001');
      expect(putRes.body.profile.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(putRes.body.profile.user.toString()).toBe(verifiedStudentA1._id.toString());

      // Subsequent GET
      const fetchGet = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`);

      expect(fetchGet.status).toBe(200);
      expect(fetchGet.body.profile._id).toBe(putRes.body.profile._id);
      expect(fetchGet.body.profile.rollNumber).toBe('CS-2025-001');
    });
  });

  describe('2. Client College Override & Tenant Authority Derivation', () => {
    it('should reject requests where client attempts to supply a different collegeId', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          collegeId: collegeBeta._id, // Malicious override attempt
          rollNumber: 'CS-2025-001',
          department: 'Information Technology',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot specify or override college assignment/i);

      // Verify no profile was created in College Beta
      const profileInBeta = await StudentProfile.findOne({ collegeId: collegeBeta._id });
      expect(profileInBeta).toBeNull();
    });

    it('should always derive collegeId strictly from the authenticated user assignment', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          department: 'Mechanical Engineering',
          cgpa: 8.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.collegeId.toString()).toBe(collegeAlpha._id.toString());

      const saved = await StudentProfile.findOne({ user: verifiedStudentA1._id });
      expect(saved.collegeId.toString()).toBe(collegeAlpha._id.toString());
    });
  });

  describe('3. Same-College Roll Number Duplicates & Case Variations', () => {
    beforeEach(async () => {
      // Student A1 creates profile with roll number 'CSE-2025-01'
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          rollNumber: 'CSE-2025-01',
          department: 'Computer Science',
        });
    });

    it('should reject exact duplicate roll number within the same college', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({
          rollNumber: 'CSE-2025-01',
          department: 'Information Technology',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/roll number already in use by another student in this college/i);
    });

    it('should reject case variations of duplicate roll number within the same college', async () => {
      // lowercase variant
      const lowerRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({
          rollNumber: 'cse-2025-01',
          department: 'Information Technology',
        });

      expect(lowerRes.status).toBe(400);
      expect(lowerRes.body.success).toBe(false);
      expect(lowerRes.body.message).toMatch(/roll number already in use by another student in this college/i);

      // mixed-case variant
      const mixedRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({
          rollNumber: 'Cse-2025-01',
          department: 'Information Technology',
        });

      expect(mixedRes.status).toBe(400);
      expect(mixedRes.body.success).toBe(false);
      expect(mixedRes.body.message).toMatch(/roll number already in use by another student in this college/i);
    });

    it('should allow student to update other profile fields without triggering false self-duplicate error', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          rollNumber: 'CSE-2025-01', // Same roll number belonging to Student A1
          cgpa: 9.8,
          skills: ['Node.js', 'MongoDB'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.cgpa).toBe(9.8);
      expect(res.body.profile.skills).toContain('Node.js');
    });
  });

  describe('4. Cross-College Roll Number Reuse', () => {
    it('should allow identical roll numbers to be used in different colleges', async () => {
      // Student A1 in College Alpha creates profile with roll 'DUAL-CAMPUS-100'
      const resA = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          rollNumber: 'DUAL-CAMPUS-100',
          department: 'Computer Science',
        });

      expect(resA.status).toBe(200);
      expect(resA.body.profile.rollNumber).toBe('DUAL-CAMPUS-100');

      // Student B in College Beta creates profile with exact same roll 'DUAL-CAMPUS-100'
      const resB = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          rollNumber: 'DUAL-CAMPUS-100',
          department: 'Data Science',
        });

      expect(resB.status).toBe(200);
      expect(resB.body.success).toBe(true);
      expect(resB.body.profile.rollNumber).toBe('DUAL-CAMPUS-100');
      expect(resB.body.profile.collegeId.toString()).toBe(collegeBeta._id.toString());

      // Also verify case-variant identical roll number across colleges
      // Student in College Beta uses lowercase variant 'dual-campus-100'
      const studentB2 = await User.create({
        name: 'Student Beta Two',
        email: 'beta2@beta.edu',
        password: 'password123',
        role: 'student',
        collegeId: collegeBeta._id,
        collegeAssignmentStatus: 'VERIFIED',
      });
      const tokenB2 = generateToken(studentB2._id, 'student');

      // Attempting lowercase variant within College Beta should fail (same college)
      const resB2Fail = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenB2}`)
        .send({ rollNumber: 'dual-campus-100' });

      expect(resB2Fail.status).toBe(400);
    });
  });

  describe('5. Missing, Null, and Blank Roll Numbers', () => {
    it('should allow multiple students in the same college to have missing roll numbers without collision', async () => {
      const res1 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ department: 'Civil Engineering' });

      expect(res1.status).toBe(200);
      expect(res1.body.profile.rollNumber).toBeUndefined();

      const res2 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({ department: 'Mechanical Engineering' });

      expect(res2.status).toBe(200);
      expect(res2.body.profile.rollNumber).toBeUndefined();
    });

    it('should allow multiple students in the same college to have null roll numbers without collision', async () => {
      const res1 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ rollNumber: null, department: 'Civil Engineering' });

      expect(res1.status).toBe(200);
      expect(res1.body.profile.rollNumber).toBeNull();

      const res2 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({ rollNumber: null, department: 'Mechanical Engineering' });

      expect(res2.status).toBe(200);
      expect(res2.body.profile.rollNumber).toBeNull();
    });

    it('should allow multiple students in the same college to have empty string roll numbers without collision', async () => {
      const res1 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ rollNumber: '', department: 'Civil Engineering' });

      expect(res1.status).toBe(200);
      expect(res1.body.profile.rollNumber).toBe('');

      const res2 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({ rollNumber: '', department: 'Mechanical Engineering' });

      expect(res2.status).toBe(200);
      expect(res2.body.profile.rollNumber).toBe('');
    });

    it('should allow multiple students in the same college to have whitespace-only roll numbers without collision', async () => {
      const res1 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ rollNumber: '   ', department: 'Civil Engineering' });

      expect(res1.status).toBe(200);
      expect(res1.body.profile.rollNumber).toBe('');

      const res2 = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({ rollNumber: '  \t  ', department: 'Mechanical Engineering' });

      expect(res2.status).toBe(200);
      expect(res2.body.profile.rollNumber).toBe('');
    });
  });

  describe('6. Unauthorized Profile Access & Modification', () => {
    it('should reject unauthenticated profile requests with 401', async () => {
      const getRes = await request(app).get('/api/student/profile');
      expect(getRes.status).toBe(401);

      const putRes = await request(app)
        .put('/api/student/profile')
        .send({ department: 'Computer Science' });
      expect(putRes.status).toBe(401);
    });

    it('should reject non-student role requests with 403', async () => {
      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenRecruiter}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should ignore client-supplied user ID in payload and bind strictly to authenticated user', async () => {
      // Student A1 attempts to create/modify Student A2's profile by supplying user: studentA2._id
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          user: verifiedStudentA2._id, // Spoof attempt
          department: 'Hacked Department',
        });

      expect(res.status).toBe(200);
      // The profile created must belong to Student A1, NOT Student A2
      expect(res.body.profile.user.toString()).toBe(verifiedStudentA1._id.toString());

      // Student A2 must still have no profile
      const a2Profile = await StudentProfile.findOne({ user: verifiedStudentA2._id });
      expect(a2Profile).toBeNull();
    });

    it('should reject cross-tenant profile access if a profile belongs to a different college', async () => {
      // Simulate an anomaly where a profile exists with a different collegeId
      await StudentProfile.create({
        user: verifiedStudentA1._id,
        collegeId: collegeBeta._id, // Mismatched college
        department: 'Electronics',
      });

      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.message).toMatch(/belongs to a different institution/i);

      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ department: 'Modified Dept' });

      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);
      expect(putRes.body.message).toMatch(/belongs to a different institution/i);
    });
  });

  describe('7. Concurrent Write Race Conditions & Index-Specific E11000 Handling', () => {
    it('should exercise actual MongoDB unique index in test database under concurrent writes', async () => {
      // Build the actual compound unique index on the isolated test database collection
      await StudentProfile.collection.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      // Execute concurrent writes for two students in the same college attempting to claim the same roll number
      const [res1, res2] = await Promise.all([
        request(app)
          .put('/api/student/profile')
          .set('Authorization', `Bearer ${tokenA1}`)
          .send({ rollNumber: 'CONCURRENT-ROLL-99', department: 'CS' }),
        request(app)
          .put('/api/student/profile')
          .set('Authorization', `Bearer ${tokenA2}`)
          .send({ rollNumber: 'CONCURRENT-ROLL-99', department: 'IT' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed with 200, and one must be rejected with 400
      expect(statuses).toEqual([200, 400]);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.message).toMatch(/roll number already in use by another student in this college/i);
    });

    it('should return roll-number conflict message when E11000 corresponds to roll-number index', async () => {
      const createSpy = jest.spyOn(StudentProfile, 'create').mockImplementationOnce(() => {
        const err = new Error(
          'E11000 duplicate key error collection: college_placement_test_db.studentprofiles index: collegeId_1_rollNumber_1 dup key: { collegeId: ObjectId("..."), rollNumber: "CSE-101" }'
        );
        err.code = 11000;
        err.keyPattern = { collegeId: 1, rollNumber: 1 };
        err.keyValue = { collegeId: collegeAlpha._id, rollNumber: 'CSE-101' };
        throw err;
      });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ rollNumber: 'CSE-101', department: 'CS' });

      createSpy.mockRestore();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Roll number already in use by another student in this college.');
    });

    it('should return user account conflict message when E11000 corresponds to user_1 index', async () => {
      const createSpy = jest.spyOn(StudentProfile, 'create').mockImplementationOnce(() => {
        const err = new Error(
          'E11000 duplicate key error collection: college_placement_test_db.studentprofiles index: user_1 dup key: { user: ObjectId("...") }'
        );
        err.code = 11000;
        err.keyPattern = { user: 1 };
        err.keyValue = { user: verifiedStudentA1._id };
        throw err;
      });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ department: 'CS' });

      createSpy.mockRestore();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('A student profile already exists for this user account.');
    });

    it('should return generic duplicate message when E11000 corresponds to an unrelated unique index', async () => {
      const createSpy = jest.spyOn(StudentProfile, 'create').mockImplementationOnce(() => {
        const err = new Error(
          'E11000 duplicate key error collection: college_placement_test_db.studentprofiles index: someOtherIndex_1 dup key: { someOtherField: "value" }'
        );
        err.code = 11000;
        err.keyPattern = { someOtherField: 1 };
        throw err;
      });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ department: 'CS' });

      createSpy.mockRestore();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Duplicate key conflict on student profile.');
    });

    it('should enforce schema validation: non-empty roll number strictly requires a valid college assignment', async () => {
      const profileWithoutCollege = new StudentProfile({
        user: new mongoose.Types.ObjectId(),
        rollNumber: 'CS-SCHEMA-101', // Non-empty roll number
        // collegeId omitted intentionally
      });

      let validationError;
      try {
        await profileWithoutCollege.validate();
      } catch (err) {
        validationError = err;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.collegeId).toBeDefined();
      expect(validationError.errors.collegeId.message).toMatch(
        /A non-empty roll number requires a valid college assignment/i
      );
    });
  });

  describe('8. Milestone 2G.3.2 — Legacy Index Preconditions, Rollback Verification & Narrowed Cleanup', () => {
    it('should reject same-college duplicate roll numbers at application level without any unique index in MongoDB', async () => {
      // Ensure NO unique indexes exist on studentprofiles (simulating legacy non-unique rollNumber_1 index)
      const existingIndexes = await StudentProfile.collection.indexes();
      const nonIdIndexes = existingIndexes.filter((i) => i.name !== '_id_' && i.name !== 'user_1');
      for (const idx of nonIdIndexes) {
        await StudentProfile.collection.dropIndex(idx.name);
      }

      // Recreate legacy sparse non-unique index
      await StudentProfile.collection.createIndex({ rollNumber: 1 }, { name: 'rollNumber_1', sparse: true });

      const catalogIndexes = await StudentProfile.collection.indexes();
      const legacyIdx = catalogIndexes.find((i) => i.name === 'rollNumber_1');
      expect(legacyIdx).toBeDefined();
      expect(legacyIdx.unique).toBeFalsy(); // Confirms legacy index is non-unique
      expect(legacyIdx.sparse).toBe(true);

      // Student A1 creates profile
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ rollNumber: 'APP-CHECK-001', department: 'CS' });

      // Student A2 attempts to use same roll number in same college
      // Application-level check in controller must catch and reject this, despite MongoDB index being non-unique!
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenA2}`)
        .send({ rollNumber: 'app-check-001', department: 'IT' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/roll number already in use by another student in this college/i);
    });

    it('should accurately validate complete index definition for safe rollback and halt on discrepancies', async () => {
      function validateRollbackIndexDefinition(indexObj) {
        if (!indexObj) {
          return { canDrop: false, reason: 'INDEX_NOT_FOUND' };
        }
        const keyMatches =
          indexObj.key &&
          indexObj.key.collegeId === 1 &&
          indexObj.key.rollNumber === 1 &&
          Object.keys(indexObj.key).length === 2;
        const uniqueMatches = indexObj.unique === true;
        const collationMatches =
          indexObj.collation &&
          indexObj.collation.locale === 'en' &&
          indexObj.collation.strength === 2;
        const partialMatches =
          indexObj.partialFilterExpression &&
          indexObj.partialFilterExpression.rollNumber &&
          indexObj.partialFilterExpression.rollNumber.$type === 'string' &&
          indexObj.partialFilterExpression.rollNumber.$gt === '';

        if (!keyMatches) return { canDrop: false, reason: 'KEY_PATTERN_MISMATCH' };
        if (!uniqueMatches) return { canDrop: false, reason: 'UNIQUE_FLAG_MISMATCH' };
        if (!collationMatches) return { canDrop: false, reason: 'COLLATION_MISMATCH' };
        if (!partialMatches) return { canDrop: false, reason: 'PARTIAL_FILTER_MISMATCH' };

        return { canDrop: true, reason: 'EXACT_MATCH' };
      }

      // 1. Exact expected definition
      const validDefinition = {
        name: 'collegeId_1_rollNumber_1',
        key: { collegeId: 1, rollNumber: 1 },
        unique: true,
        collation: { locale: 'en', strength: 2 },
        partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
      };
      expect(validateRollbackIndexDefinition(validDefinition)).toEqual({
        canDrop: true,
        reason: 'EXACT_MATCH',
      });

      // 2. Missing partialFilterExpression
      const missingPartial = { ...validDefinition, partialFilterExpression: undefined };
      expect(validateRollbackIndexDefinition(missingPartial)).toEqual({
        canDrop: false,
        reason: 'PARTIAL_FILTER_MISMATCH',
      });

      // 3. Divergent collation strength
      const badCollation = {
        ...validDefinition,
        collation: { locale: 'en', strength: 1 },
      };
      expect(validateRollbackIndexDefinition(badCollation)).toEqual({
        canDrop: false,
        reason: 'COLLATION_MISMATCH',
      });

      // 4. Missing unique flag
      const notUnique = { ...validDefinition, unique: false };
      expect(validateRollbackIndexDefinition(notUnique)).toEqual({
        canDrop: false,
        reason: 'UNIQUE_FLAG_MISMATCH',
      });

      // 5. Index absent
      expect(validateRollbackIndexDefinition(null)).toEqual({
        canDrop: false,
        reason: 'INDEX_NOT_FOUND',
      });
    });

    it('should delete strictly by exact testRunId during manual smoke-test cleanup and preserve unrelated records', async () => {
      const coll = StudentProfile.collection;

      const exactRunId = 'smoke_1760512800000_a1b2c3d4';
      const otherRunId = 'smoke_1760512900000_e5f6g7h8';

      // Insert existing legitimate profile (no testRunId)
      await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeAlpha._id,
        rollNumber: 'LEGIT-001',
      });

      // Insert record belonging to exact test run
      await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeAlpha._id,
        rollNumber: 'TEST-001',
        testRunId: exactRunId,
      });

      // Insert record belonging to another test run
      await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeBeta._id,
        rollNumber: 'TEST-002',
        testRunId: otherRunId,
      });

      // Pre-cleanup inspection
      const inspectedDocs = await coll.find({ testRunId: exactRunId }).toArray();
      expect(inspectedDocs.length).toBe(1);
      expect(inspectedDocs[0].rollNumber).toBe('TEST-001');

      // Delete strictly by exact testRunId (NOT broad regex)
      const deleteResult = await coll.deleteMany({ testRunId: exactRunId });
      expect(deleteResult.deletedCount).toBe(1);

      // Verify that exact run record is deleted, but other run and legitimate profile are preserved
      const remainingExact = await coll.countDocuments({ testRunId: exactRunId });
      expect(remainingExact).toBe(0);

      const remainingOther = await coll.countDocuments({ testRunId: otherRunId });
      expect(remainingOther).toBe(1);

      const remainingLegit = await coll.countDocuments({ rollNumber: 'LEGIT-001' });
      expect(remainingLegit).toBe(1);
    });
  });

  describe('9. Milestone 2G.3.3 — Hardened Safe Rollback & Intended Index Direct BSON Validation', () => {
    it('should verify MongoDB partial unique index enforces uniqueness for non-empty strings and allows duplicates for null, empty, or missing roll numbers', async () => {
      const coll = StudentProfile.collection;

      // Ensure clean indexes
      const existingIndexes = await coll.indexes();
      for (const idx of existingIndexes) {
        if (idx.name !== '_id_') await coll.dropIndex(idx.name);
      }

      // Build the exact intended compound partial unique index
      await coll.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      // Multiple profiles in same college with null rollNumber
      await coll.insertOne({ user: new mongoose.Types.ObjectId(), collegeId: collegeAlpha._id, rollNumber: null });
      await coll.insertOne({ user: new mongoose.Types.ObjectId(), collegeId: collegeAlpha._id, rollNumber: null });

      // Multiple profiles in same college with empty string rollNumber
      await coll.insertOne({ user: new mongoose.Types.ObjectId(), collegeId: collegeAlpha._id, rollNumber: '' });
      await coll.insertOne({ user: new mongoose.Types.ObjectId(), collegeId: collegeAlpha._id, rollNumber: '' });

      // Profile in same college with missing rollNumber
      await coll.insertOne({ user: new mongoose.Types.ObjectId(), collegeId: collegeAlpha._id });

      // Profile with non-empty rollNumber
      await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeAlpha._id,
        rollNumber: 'INTENDED-ROLL-100',
      });

      // Attempt duplicate non-empty rollNumber (case variant) in same college: MUST FAIL with E11000
      let dupError;
      try {
        await coll.insertOne({
          user: new mongoose.Types.ObjectId(),
          collegeId: collegeAlpha._id,
          rollNumber: 'intended-roll-100',
        });
      } catch (err) {
        dupError = err;
      }
      expect(dupError).toBeDefined();
      expect(dupError.code).toBe(11000);

      // Identical rollNumber in DIFFERENT college: MUST SUCCEED
      const crossCollegeInsert = await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeBeta._id,
        rollNumber: 'INTENDED-ROLL-100',
      });
      expect(crossCollegeInsert.acknowledged).toBe(true);
    });

    it('should execute safe conditional rollback cleanly with controlled error propagation and connection cleanup', async () => {
      const coll = StudentProfile.collection;
      await coll.deleteMany({}); // Ensure baseline is 0

      // Create target index
      await coll.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      // Verify index is present
      let idxs = await coll.indexes();
      expect(idxs.some((i) => i.name === 'collegeId_1_rollNumber_1')).toBe(true);

      // Execute safe rollback
      const result = await executeSafeConditionalRollback({
        targetDb: 'college_placement_test_db',
        checkWritePause: false,
        expectedBaselineCount: 0,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DROPPED');

      // Verify index is dropped
      idxs = await coll.indexes();
      expect(idxs.some((i) => i.name === 'collegeId_1_rollNumber_1')).toBe(false);
    });

    it('should halt rollback and throw RollbackPreconditionError without modifying indexes when document count diverges', async () => {
      const coll = StudentProfile.collection;
      await coll.deleteMany({});

      // Insert record to violate baseline
      await coll.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: collegeAlpha._id,
        rollNumber: 'DATA-001',
      });

      // Create target index
      await coll.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      let caughtError;
      try {
        await executeSafeConditionalRollback({
          targetDb: 'college_placement_test_db',
          checkWritePause: false,
          expectedBaselineCount: 0, // Baseline expected 0, but 1 exists
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(RollbackPreconditionError);
      expect(caughtError.code).toBe('BASELINE_COUNT_MISMATCH');

      // Confirm index was NOT dropped
      const idxs = await coll.indexes();
      expect(idxs.some((i) => i.name === 'collegeId_1_rollNumber_1')).toBe(true);
    });

    it('should halt rollback and throw RollbackPreconditionError without modifying indexes when index definition diverges', async () => {
      const coll = StudentProfile.collection;
      await coll.deleteMany({});

      // Drop existing if any
      const existingIndexes = await coll.indexes();
      for (const idx of existingIndexes) {
        if (idx.name !== '_id_') await coll.dropIndex(idx.name);
      }

      // Create index with divergent definition (wrong collation strength)
      await coll.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 1 }, // Divergent strength: 1
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        }
      );

      let caughtError;
      try {
        await executeSafeConditionalRollback({
          targetDb: 'college_placement_test_db',
          checkWritePause: false,
          expectedBaselineCount: 0,
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(RollbackPreconditionError);
      expect(caughtError.code).toBe('DEFINITION_DIVERGENCE');

      // Confirm index was NOT dropped
      const idxs = await coll.indexes();
      expect(idxs.some((i) => i.name === 'collegeId_1_rollNumber_1')).toBe(true);
    });
  });
});

