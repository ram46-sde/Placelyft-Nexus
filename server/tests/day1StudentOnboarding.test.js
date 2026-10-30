const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Day 1 Implementation: Student Onboarding and Application Tenant Fixes', () => {
  let primaryCollege;
  let secondaryCollege;
  let inactiveCollege;
  let company;
  let primaryDrive;
  let secondaryDrive;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    delete process.env.COLLEGE_ID;
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Colleges
    primaryCollege = await College.create({
      name: 'Apex Engineering College',
      contactEmail: 'admin@apex.edu',
      address: '100 Apex Way',
      isActive: true,
    });

    secondaryCollege = await College.create({
      name: 'Zenith Technology Institute',
      contactEmail: 'admin@zenith.edu',
      address: '200 Zenith Road',
      isActive: true,
    });

    inactiveCollege = await College.create({
      name: 'Defunct Campus',
      contactEmail: 'admin@defunct.edu',
      address: '999 Old Lane',
      isActive: false,
    });

    // Configure the primary college for single-college MVP
    process.env.COLLEGE_ID = primaryCollege._id.toString();

    // 2. Setup Company & Placement Drives
    company = await Company.create({
      name: 'CloudCore Systems',
      industry: 'Software',
      website: 'https://cloudcore.example.com',
    });

    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    primaryDrive = await PlacementDrive.create({
      company: company._id,
      collegeId: primaryCollege._id,
      jobRole: 'Full Stack Engineer',
      jobDescription: 'Node and React development role',
      packageDetails: '10 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        requiredCourses: [],
        requiredSkills: [],
      },
    });

    secondaryDrive = await PlacementDrive.create({
      company: company._id,
      collegeId: secondaryCollege._id,
      jobRole: 'Systems Engineer',
      jobDescription: 'Zenith college only drive',
      packageDetails: '12 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 6.5,
        maxBacklogs: 0,
        requiredCourses: [],
        requiredSkills: [],
      },
    });
  });

  describe('Fix 1 — Safe Single-College Student Registration', () => {
    it('1.1 should fail closed with 500 if COLLEGE_ID is missing from environment', async () => {
      delete process.env.COLLEGE_ID;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rohan Sharma',
          email: 'rohan.sharma@apex.edu',
          password: 'password123',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/COLLEGE_ID is missing or invalid/i);

      // Verify no user was created
      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('1.2 should fail closed with 500 if COLLEGE_ID is not a valid ObjectId string', async () => {
      process.env.COLLEGE_ID = 'not-a-valid-object-id';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rohan Sharma',
          email: 'rohan.sharma@apex.edu',
          password: 'password123',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/COLLEGE_ID is missing or invalid/i);

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('1.3 should fail closed with 500 if COLLEGE_ID points to a nonexistent college', async () => {
      process.env.COLLEGE_ID = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rohan Sharma',
          email: 'rohan.sharma@apex.edu',
          password: 'password123',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Configured college not found or is inactive/i);

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('1.4 should fail closed with 500 if COLLEGE_ID points to an inactive college', async () => {
      process.env.COLLEGE_ID = inactiveCollege._id.toString();

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rohan Sharma',
          email: 'rohan.sharma@defunct.edu',
          password: 'password123',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Configured college not found or is inactive/i);

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('1.5 should successfully register student to the explicitly configured college and set VERIFIED status', async () => {
      process.env.COLLEGE_ID = primaryCollege._id.toString();

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Patel',
          email: 'priya.patel@apex.edu',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.collegeId.toString()).toBe(primaryCollege._id.toString());
      expect(res.body.user.collegeAssignmentStatus).toBe('VERIFIED');

      // Verify in MongoDB
      const savedUser = await User.findOne({ email: 'priya.patel@apex.edu' });
      expect(savedUser).not.toBeNull();
      expect(savedUser.collegeId.toString()).toBe(primaryCollege._id.toString());
      expect(savedUser.collegeAssignmentStatus).toBe('VERIFIED');
      expect(savedUser.role).toBe('student');
    });

    it('1.6 should strictly ignore client-supplied role or collegeId during registration', async () => {
      process.env.COLLEGE_ID = primaryCollege._id.toString();

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attacker Student',
          email: 'attacker@apex.edu',
          password: 'password123',
          role: 'super_admin', // Untrusted client injection attempt
          collegeId: secondaryCollege._id.toString(), // Untrusted college override attempt
          collegeAssignmentStatus: 'PENDING_APPROVAL',
        });

      expect(res.status).toBe(201);
      const savedUser = await User.findOne({ email: 'attacker@apex.edu' });
      expect(savedUser.role).toBe('student'); // Ignored injection!
      expect(savedUser.collegeId.toString()).toBe(primaryCollege._id.toString()); // Ignored injection!
      expect(savedUser.collegeAssignmentStatus).toBe('VERIFIED');
    });
  });

  describe('Fix 1 — Resolution of Student Profile Access Deadlock', () => {
    it('1.7 newly registered student can immediately access and update their profile without deadlock', async () => {
      process.env.COLLEGE_ID = primaryCollege._id.toString();

      // 1. Register student
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Ananya Deshmukh',
          email: 'ananya.deshmukh@apex.edu',
          password: 'password123',
        });

      expect(regRes.status).toBe(201);
      const token = regRes.body.token;

      // 2. Fetch profile (Initial null state - previously blocked with 403!)
      const getProfileRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(getProfileRes.status).toBe(200);
      expect(getProfileRes.body.success).toBe(true);
      expect(getProfileRes.body.profile).toBeNull();

      // 3. Upsert profile with academic details
      const putProfileRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rollNumber: 'APEX-2026-042',
          department: 'Computer Science',
          course: 'B.Tech',
          batch: '2026',
          cgpa: 8.9,
          backlogs: 0,
          skills: ['JavaScript', 'React', 'Node.js'],
        });

      expect(putProfileRes.status).toBe(200);
      expect(putProfileRes.body.success).toBe(true);
      expect(putProfileRes.body.profile.rollNumber).toBe('APEX-2026-042');
      expect(putProfileRes.body.profile.collegeId.toString()).toBe(primaryCollege._id.toString());
      expect(putProfileRes.body.profile.cgpa).toBe(8.9);
    });

    it('1.8 legacy unverified user remains blocked with 403 Forbidden on profile operations', async () => {
      // Legacy unverified user
      const legacyUser = await User.create({
        name: 'Legacy Unverified Student',
        email: 'legacy.unverified@apex.edu',
        password: 'password123',
        role: 'student',
        collegeId: primaryCollege._id,
        collegeAssignmentStatus: 'LEGACY_UNVERIFIED',
        isActive: true,
      });

      const legacyToken = generateToken(legacyUser._id, legacyUser.role);

      // GET profile blocked
      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${legacyToken}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.message).toMatch(/college assignment is not verified/i);

      // PUT profile blocked
      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${legacyToken}`)
        .send({ cgpa: 8.0 });

      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);
    });
  });

  describe('Fix 2 — Persist collegeId on Drive Applications', () => {
    let student;
    let studentToken;

    beforeEach(async () => {
      // Create a verified student in primary college with an eligible profile
      student = await User.create({
        name: 'Siddharth Nair',
        email: 'siddharth@apex.edu',
        password: 'password123',
        role: 'student',
        collegeId: primaryCollege._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });
      studentToken = generateToken(student._id, 'student');

      await StudentProfile.create({
        user: student._id,
        collegeId: primaryCollege._id,
        rollNumber: 'APEX-2026-007',
        department: 'Computer Science',
        course: 'B.Tech',
        batch: '2026',
        cgpa: 8.2, // Eligible for primaryDrive (minCgpa: 7.0)
        backlogs: 0,
      });
    });

    it('2.1 should explicitly persist student collegeId on newly created application', async () => {
      const res = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application).toBeDefined();

      // Inspect persisted document in MongoDB
      const savedApplication = await DriveApplication.findOne({
        student: student._id,
        placementDrive: primaryDrive._id,
      });

      expect(savedApplication).not.toBeNull();
      expect(savedApplication.collegeId).toBeDefined();
      expect(savedApplication.collegeId.toString()).toBe(primaryCollege._id.toString());
      expect(savedApplication.status).toBe('Applied');
    });

    it('2.2 should ignore client-supplied collegeId when applying for a drive', async () => {
      const spoofedCollegeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ collegeId: spoofedCollegeId.toString() }); // Client spoof attempt

      expect(res.status).toBe(201);

      const savedApplication = await DriveApplication.findOne({
        student: student._id,
        placementDrive: primaryDrive._id,
      });

      // Must be derived strictly from authenticated user, not client body!
      expect(savedApplication.collegeId.toString()).toBe(primaryCollege._id.toString());
      expect(savedApplication.collegeId.toString()).not.toBe(spoofedCollegeId.toString());
    });

    it('2.3 should reject cross-college drive applications with 403 Forbidden', async () => {
      // Student in primary college attempts to apply for secondary college drive
      const res = await request(app)
        .post(`/api/student/applications/${secondaryDrive._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized access to this placement drive/i);

      // Verify no application was created
      const appCount = await DriveApplication.countDocuments();
      expect(appCount).toBe(0);
    });

    it('2.4 should reject application if student has LEGACY_UNVERIFIED status', async () => {
      const unverifiedStudent = await User.create({
        name: 'Unverified Applicant',
        email: 'unverified.applicant@apex.edu',
        password: 'password123',
        role: 'student',
        collegeId: primaryCollege._id,
        collegeAssignmentStatus: 'LEGACY_UNVERIFIED',
        isActive: true,
      });

      const unverifiedToken = generateToken(unverifiedStudent._id, 'student');

      await StudentProfile.create({
        user: unverifiedStudent._id,
        collegeId: primaryCollege._id,
        cgpa: 8.5,
        backlogs: 0,
      });

      const res = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${unverifiedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const appCount = await DriveApplication.countDocuments({ student: unverifiedStudent._id });
      expect(appCount).toBe(0);
    });

    it('2.5 should preserve duplicate-application rejection (400 Bad Request)', async () => {
      // First application: succeeds
      const firstRes = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(firstRes.status).toBe(201);

      // Second application: rejected
      const secondRes = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toMatch(/already applied/i);
    });

    it('2.6 should preserve eligibility check rejection for ineligible CGPA (403 Forbidden)', async () => {
      // Create student with low CGPA (6.0 < 7.0 required)
      const lowCgpaStudent = await User.create({
        name: 'Low CGPA Student',
        email: 'low.cgpa@apex.edu',
        password: 'password123',
        role: 'student',
        collegeId: primaryCollege._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });
      const lowCgpaToken = generateToken(lowCgpaStudent._id, 'student');

      await StudentProfile.create({
        user: lowCgpaStudent._id,
        collegeId: primaryCollege._id,
        cgpa: 6.0,
        backlogs: 0,
      });

      const res = await request(app)
        .post(`/api/student/applications/${primaryDrive._id}`)
        .set('Authorization', `Bearer ${lowCgpaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not eligible to apply/i);

      const appCount = await DriveApplication.countDocuments({ student: lowCgpaStudent._id });
      expect(appCount).toBe(0);
    });
  });
});
