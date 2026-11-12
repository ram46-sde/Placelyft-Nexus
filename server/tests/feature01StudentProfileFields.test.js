const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

/**
 * Feature 01: Enhanced Student Details Panel — Stage 1 Tests
 *
 * Tests the additive `section` and `academicYear` fields on StudentProfile,
 * including schema validation, profile upsert API, partial update semantics,
 * and backward compatibility with existing profile fields.
 */
describe('Feature 01 Stage 1: StudentProfile section and academicYear fields', () => {
  let college;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'feature01_test_secret_key_at_least_32_characters!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    college = await College.create({
      name: 'Feature 01 Test College',
      contactEmail: 'admin@f01test.edu',
      address: '1 Test Lane',
      isActive: true,
    });

    process.env.COLLEGE_ID = college._id.toString();

    studentUser = await User.create({
      name: 'Alice TestStudent',
      email: 'alice@f01test.edu',
      password: 'password123',
      role: 'student',
      collegeId: college._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentToken = generateToken(studentUser._id, studentUser.role);
  });

  // ─── 1. Valid section and academicYear are saved ──────────────────────
  describe('1. Valid section and academicYear are saved', () => {
    it('should save section and academicYear on profile creation', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          department: 'Computer Science',
          section: 'A',
          academicYear: 'III',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.section).toBe('A');
      expect(res.body.profile.academicYear).toBe('III');
      expect(res.body.profile.department).toBe('Computer Science');
    });

    it('should persist section and academicYear in the database', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'B', academicYear: 'II' });

      const dbProfile = await StudentProfile.findOne({ user: studentUser._id });
      expect(dbProfile.section).toBe('B');
      expect(dbProfile.academicYear).toBe('II');
    });
  });

  // ─── 2. Section whitespace is trimmed ─────────────────────────────────
  describe('2. Section whitespace is trimmed', () => {
    it('should trim leading and trailing whitespace from section', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: '  A  ' });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBe('A');
    });

    it('should treat whitespace-only section as null', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: '   ' });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBeNull();
    });
  });

  // ─── 3. Academic years I, II, III, IV are accepted ────────────────────
  describe('3. Academic years I, II, III, IV are accepted', () => {
    const validYears = ['I', 'II', 'III', 'IV'];

    it.each(validYears)('should accept academicYear "%s"', async (year) => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: year });

      expect(res.status).toBe(200);
      expect(res.body.profile.academicYear).toBe(year);
    });
  });

  // ─── 4. Invalid academicYear values are rejected ──────────────────────
  describe('4. Invalid academicYear values are rejected', () => {
    const invalidValues = ['V', '1', 'first', 'i', 'ii', 'iii', 'iv', '0', 'none', 'Year 1'];

    it.each(invalidValues)('should reject invalid academicYear "%s" with 400', async (val) => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: val });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Academic year must be one of/i);
    });

    it('should reject numeric academicYear with 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject boolean academicYear with 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: true });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject object academicYear with 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: { value: 'III' } });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 5. Empty section is handled correctly ────────────────────────────
  describe('5. Empty section is handled correctly', () => {
    it('should treat empty string section as null', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: '' });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBeNull();
    });

    it('should accept null section explicitly', async () => {
      // First create a profile with a section
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'C' });

      // Then clear it with null
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: null });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBeNull();
    });

    it('should treat null academicYear as clearing the value', async () => {
      // First set it
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: 'IV' });

      // Then clear it
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: null });

      expect(res.status).toBe(200);
      expect(res.body.profile.academicYear).toBeNull();
    });

    it('should treat empty string academicYear as clearing the value', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: 'II' });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: '' });

      expect(res.status).toBe(200);
      expect(res.body.profile.academicYear).toBeNull();
    });
  });

  // ─── 6. Missing optional fields do not break existing profiles ────────
  describe('6. Missing optional fields do not break existing profiles', () => {
    it('should create a profile without section or academicYear', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          department: 'Electrical Engineering',
          cgpa: 7.5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.department).toBe('Electrical Engineering');
      expect(res.body.profile.cgpa).toBe(7.5);
      // New fields default to null when not provided
      expect(res.body.profile.section).toBeNull();
      expect(res.body.profile.academicYear).toBeNull();
    });

    it('should not affect legacy profiles that were created before these fields existed', async () => {
      // Simulate a legacy profile by direct insertion without the new fields
      await StudentProfile.create({
        user: studentUser._id,
        collegeId: college._id,
        department: 'Mechanical Engineering',
        cgpa: 8.0,
      });

      // Read it back via the API
      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.profile.department).toBe('Mechanical Engineering');
      expect(res.body.profile.cgpa).toBe(8.0);
      // Fields default to null on legacy documents
      expect(res.body.profile.section).toBeNull();
      expect(res.body.profile.academicYear).toBeNull();
    });
  });

  // ─── 7. Partial updates preserve previously saved values ──────────────
  describe('7. Partial updates preserve previously saved values', () => {
    it('should preserve section when only academicYear is updated', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'A', academicYear: 'I', department: 'CS' });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ academicYear: 'II' });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBe('A');
      expect(res.body.profile.academicYear).toBe('II');
      expect(res.body.profile.department).toBe('CS');
    });

    it('should preserve academicYear when only section is updated', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'A', academicYear: 'III' });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'B' });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBe('B');
      expect(res.body.profile.academicYear).toBe('III');
    });

    it('should not overwrite section or academicYear when neither is sent', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'D', academicYear: 'IV', cgpa: 9.0 });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ cgpa: 9.5 });

      expect(res.status).toBe(200);
      expect(res.body.profile.cgpa).toBe(9.5);
      expect(res.body.profile.section).toBe('D');
      expect(res.body.profile.academicYear).toBe('IV');
    });
  });

  // ─── 8. Existing profile fields remain unaffected ─────────────────────
  describe('8. Existing profile fields remain unaffected', () => {
    it('should preserve all existing fields when adding section and academicYear', async () => {
      // Create a full profile
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          rollNumber: 'F01-CSE-001',
          department: 'Computer Science',
          course: 'B.Tech',
          batch: '2026',
          cgpa: 8.5,
          backlogs: 0,
          tenthPercentage: 90,
          twelfthPercentage: 85,
          skills: ['Python', 'Java'],
          resumeUrl: 'https://drive.google.com/resume.pdf',
        });

      // Now update only section and academicYear
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'A', academicYear: 'IV' });

      expect(res.status).toBe(200);
      const p = res.body.profile;
      expect(p.rollNumber).toBe('F01-CSE-001');
      expect(p.department).toBe('Computer Science');
      expect(p.course).toBe('B.Tech');
      expect(p.batch).toBe('2026');
      expect(p.cgpa).toBe(8.5);
      expect(p.backlogs).toBe(0);
      expect(p.tenthPercentage).toBe(90);
      expect(p.twelfthPercentage).toBe(85);
      expect(p.skills).toEqual(['Python', 'Java']);
      expect(p.resumeUrl).toBe('https://drive.google.com/resume.pdf');
      expect(p.section).toBe('A');
      expect(p.academicYear).toBe('IV');
    });

    it('should preserve section and academicYear when updating other fields', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          section: 'B',
          academicYear: 'II',
          cgpa: 7.0,
        });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          cgpa: 7.5,
          skills: ['React'],
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.section).toBe('B');
      expect(res.body.profile.academicYear).toBe('II');
      expect(res.body.profile.cgpa).toBe(7.5);
      expect(res.body.profile.skills).toEqual(['React']);
    });
  });

  // ─── 9. Student identity cannot be changed through request-body ───────
  describe('9. Student identity cannot be changed through request-body manipulation', () => {
    it('should ignore user field in request body', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'A', user: fakeUserId.toString() });

      expect(res.status).toBe(200);
      // Profile is created for the authenticated user, not the fake one
      expect(res.body.profile.user.toString()).toBe(studentUser._id.toString());
      expect(res.body.profile.section).toBe('A');
    });

    it('should reject mismatched collegeId in request body', async () => {
      const fakeCollegeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'A', collegeId: fakeCollegeId.toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot specify or override college assignment/i);
    });
  });

  // ─── 10. Existing profile API regression: GET returns new fields ──────
  describe('10. Existing profile API regression', () => {
    it('GET /api/student/profile returns section and academicYear in response', async () => {
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 'C', academicYear: 'I' });

      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.section).toBe('C');
      expect(res.body.profile.academicYear).toBe('I');
    });

    it('GET /api/student/profile returns null profile for new users', async () => {
      const newUser = await User.create({
        name: 'Bob NoProfile',
        email: 'bob@f01test.edu',
        password: 'password123',
        role: 'student',
        collegeId: college._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });

      const newToken = generateToken(newUser._id, newUser.role);

      const res = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile).toBeNull();
    });

    it('should reject non-string section values (number)', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Section must be a string/i);
    });

    it('should reject non-string section values (boolean)', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ section: true });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Section must be a string/i);
    });

    it('unauthenticated request is rejected with 401', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .send({ section: 'A', academicYear: 'II' });

      expect(res.status).toBe(401);
    });

    it('placement officer cannot access student profile route', async () => {
      const officer = await User.create({
        name: 'Officer One',
        email: 'officer@f01test.edu',
        password: 'password123',
        role: 'placement_officer',
        collegeId: college._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });

      const officerToken = generateToken(officer._id, officer.role);

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ section: 'A' });

      expect(res.status).toBe(403);
    });
  });
});

