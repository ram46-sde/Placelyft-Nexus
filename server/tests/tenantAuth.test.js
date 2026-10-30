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

describe('Multi-Tenant Authorization & Student Drives / Applications', () => {
  let collegeA, collegeB;
  let studentA, studentB, studentNoCollege;
  let tokenA, tokenB, tokenNoCollege;
  let company;
  let driveCollegeA, driveCollegeB, driveNoCollege;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Create Colleges
    collegeA = await College.create({
      name: 'College Alpha',
      contactEmail: 'admin@college-alpha.edu',
      address: '100 Alpha Boulevard',
      isActive: true,
    });

    collegeB = await College.create({
      name: 'College Beta',
      contactEmail: 'admin@college-beta.edu',
      address: '200 Beta Avenue',
      isActive: true,
    });

    // 2. Create Students
    studentA = await User.create({
      name: 'Student Alpha',
      email: 'student.alpha@college-alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      isActive: true,
    });
    tokenA = generateToken(studentA._id, 'student');

    studentB = await User.create({
      name: 'Student Beta',
      email: 'student.beta@college-beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
      isActive: true,
    });
    tokenB = generateToken(studentB._id, 'student');

    studentNoCollege = await User.create({
      name: 'Student Unaffiliated',
      email: 'student.unaffiliated@example.edu',
      password: 'password123',
      role: 'student',
      // collegeId omitted intentionally
      isActive: true,
    });
    tokenNoCollege = generateToken(studentNoCollege._id, 'student');

    // 3. Create Company
    company = await Company.create({
      name: 'Tech Solutions Global',
      industry: 'Software',
      website: 'https://techsolutions.example.com',
      description: 'Enterprise cloud services',
    });

    // 4. Create Placement Drives
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days ahead
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

    driveCollegeA = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeA._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Full stack development role',
      packageDetails: '12 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
        requiredSkills: ['JavaScript'],
      },
    });

    driveCollegeB = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeB._id,
      jobRole: 'Data Scientist',
      jobDescription: 'Analytics role',
      packageDetails: '14 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 7.5,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
        requiredSkills: ['Python'],
      },
    });

    driveNoCollege = await PlacementDrive.create({
      company: company._id,
      // collegeId omitted intentionally
      jobRole: 'DevOps Engineer',
      jobDescription: 'Infrastructure engineer role',
      packageDetails: '10 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 6.0,
        maxBacklogs: 1,
        requiredCourses: [],
        requiredSkills: [],
      },
    });

    // 5. Create Profile for Student A (Eligible for driveCollegeA)
    await StudentProfile.create({
      user: studentA._id,
      rollNumber: 'ALPHA-001',
      department: 'Computer Science',
      course: 'B.Tech',
      batch: '2026',
      cgpa: 8.5,
      backlogs: 0,
      skills: ['JavaScript', 'Node.js', 'React'],
    });

    // Profile for Student B (Eligible for driveCollegeB)
    await StudentProfile.create({
      user: studentB._id,
      rollNumber: 'BETA-001',
      department: 'Data Science',
      course: 'B.Tech',
      batch: '2026',
      cgpa: 8.0,
      backlogs: 0,
      skills: ['Python', 'SQL'],
    });
  });

  describe('GET /api/student/drives/:id (Drive Details Access)', () => {
    it('1. A student accessing a drive belonging to their college should succeed (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/student/drives/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive).toBeDefined();
      expect(res.body.drive._id.toString()).toBe(driveCollegeA._id.toString());
      expect(res.body.drive.eligibility.isEligible).toBe(true);
    });

    it('2. A student accessing a drive belonging to another college should be rejected (403 Forbidden)', async () => {
      // Student A attempts to access College B's drive
      const res = await request(app)
        .get(`/api/student/drives/${driveCollegeB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized access to this placement drive/i);
    });

    it('3. A student without a college attempting to access a drive should be rejected (403 Forbidden)', async () => {
      // Student without collegeId attempts to access College A's drive
      const res = await request(app)
        .get(`/api/student/drives/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenNoCollege}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized access to this placement drive/i);
    });

    it('4. A drive without a college being accessed by a student should be rejected (403 Forbidden)', async () => {
      // Student A attempts to access an orphaned drive without collegeId
      const res = await request(app)
        .get(`/api/student/drives/${driveNoCollege._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized access to this placement drive/i);
    });

    it('should return 404 Not Found when requesting non-existent drive', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/student/drives/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/student/drives (Drive Listing Isolation)', () => {
    it('should only return drives belonging to the authenticated student college', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drives.length).toBe(1);
      expect(res.body.drives[0]._id.toString()).toBe(driveCollegeA._id.toString());
      expect(res.body.drives[0].collegeId.toString()).toBe(collegeA._id.toString());
    });

    it('should reject drive listing if student has no collegeId (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenNoCollege}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/student/applications/:driveId (Application Submissions)', () => {
    it('5. An unauthorized cross-college application attempt should be rejected (403 Forbidden)', async () => {
      // Student A attempts to apply for College B's drive
      const res = await request(app)
        .post(`/api/student/applications/${driveCollegeB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unauthorized access to this placement drive/i);

      // Verify no application was created in DB
      const appCount = await DriveApplication.countDocuments();
      expect(appCount).toBe(0);
    });

    it('5b. An unauthorized application attempt by a student without college should be rejected (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/student/applications/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenNoCollege}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5c. An unauthorized application attempt to a drive without college should be rejected (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/student/applications/${driveNoCollege._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('6. A valid eligible student applying to their own college drive should succeed (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/student/applications/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Successfully applied/i);
      expect(res.body.application).toBeDefined();
      expect(res.body.application.status).toBe('Applied');

      // Verify recorded in DB
      const dbApp = await DriveApplication.findOne({
        student: studentA._id,
        placementDrive: driveCollegeA._id,
      });
      expect(dbApp).not.toBeNull();
    });

    it('7. Duplicate applications should be rejected (400 Bad Request)', async () => {
      // First application: succeeds
      const firstRes = await request(app)
        .post(`/api/student/applications/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(firstRes.status).toBe(201);

      // Second application: rejected
      const secondRes = await request(app)
        .post(`/api/student/applications/${driveCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toMatch(/already applied/i);
    });

    it('should reject application if registration deadline has passed (400 Bad Request)', async () => {
      // Create an expired drive in College A
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const expiredDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeA._id,
        jobRole: 'Archived Role',
        jobDescription: 'Expired drive role',
        driveDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        registrationDeadline: pastDate,
        isActive: true,
        eligibilityCriteria: { minCgpa: 0 },
      });

      const res = await request(app)
        .post(`/api/student/applications/${expiredDrive._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/deadline has passed/i);
    });

    it('should reject application if student is ineligible (403 Forbidden)', async () => {
      // Create a high-threshold drive in College A (min CGPA 9.5)
      const highCgpaDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeA._id,
        jobRole: 'Chief Architect Fellow',
        jobDescription: 'Exceptional scholar role',
        driveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        eligibilityCriteria: { minCgpa: 9.5, maxBacklogs: 0 },
      });

      // Student A has CGPA 8.5 < 9.5
      const res = await request(app)
        .post(`/api/student/applications/${highCgpaDrive._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not eligible/i);
      expect(res.body.reasons).toBeDefined();
    });
  });

  describe('GET /api/student/applications (Student Application History)', () => {
    it('should list submitted applications for the authenticated student', async () => {
      // Create an application
      await DriveApplication.create({
        student: studentA._id,
        placementDrive: driveCollegeA._id,
        status: 'Applied',
      });

      const res = await request(app)
        .get('/api/student/applications')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.applications.length).toBe(1);
      expect(res.body.applications[0].placementDrive.jobRole).toBe('Software Engineer');
    });

    it('should reject listing if student has no college (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/student/applications')
        .set('Authorization', `Bearer ${tokenNoCollege}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
