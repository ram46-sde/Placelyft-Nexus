/**
 * CPMS Batch 1B — Mandatory Tests
 * Tests:
 *  1. Option 1: Applied student can view archived drive in read-only mode
 *  2. Non-applied student blocked from archived drive (403)
 *  3. Cross-tenant blocked from archived drive (403)
 *  4. Explicit rejection of new applications to archived drives (400)
 *  5. Application history intact for archived drives
 *  6. Notification dispatch on drive creation to all verified, active students of officer's college
 *  7. Cross-tenant notification isolation (no notifications across colleges)
 *  8. Unverified/inactive students excluded from notifications
 *  9. Duplicate announcement prevention (idempotent / partial unique index)
 * 10. Failure isolation: drive creation succeeds even if notification fails
 * 11. Dashboard latest drives (latest 3 non-archived, sorted createdAt desc, with eligibility)
 * 12. Dashboard excludes archived drives from eligible count and latest drives
 * 13. Server provides latestDriveCreatedAt for navigation watermark
 * DB: college_placement_test_db ONLY
 */

const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const College = require('../models/College');
const User = require('../models/User');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('CPMS Batch 1B — Mandatory Tests', () => {
  let collegeA, collegeB;
  let officerA, tokenOfficerA;
  let studentA1, tokenStudentA1, profileA1;
  let studentA2, tokenStudentA2, profileA2;
  let studentUnverifiedA, tokenStudentUnverifiedA;
  let studentInactiveA;
  let studentB, tokenStudentB;
  let company;
  let activeDriveA, archivedDriveA;

  const futureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'batch1b_test_secret_key_at_least_32_chars!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Two colleges
    collegeA = await College.create({ name: 'Alpha Institute of Tech', isActive: true });
    collegeB = await College.create({ name: 'Beta College of Eng', isActive: true });

    // 2. Officer in College A
    officerA = await User.create({
      name: 'Officer Alpha',
      email: 'officer.alpha@test.com',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerA = generateToken(officerA._id);

    // 3. Students in College A
    studentA1 = await User.create({
      name: 'Student Alpha 1',
      email: 'student.a1@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudentA1 = generateToken(studentA1._id);

    profileA1 = await StudentProfile.create({
      user: studentA1._id,
      collegeId: collegeA._id,
      tenthPercentage: 85,
      twelfthPercentage: 80,
      cgpa: 8.5,
      ugPercentage: 85,
      backlogs: 0,
      course: 'Computer Science',
      skills: ['JavaScript', 'Node.js'],
    });

    studentA2 = await User.create({
      name: 'Student Alpha 2',
      email: 'student.a2@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudentA2 = generateToken(studentA2._id);

    profileA2 = await StudentProfile.create({
      user: studentA2._id,
      collegeId: collegeA._id,
      tenthPercentage: 60,
      twelfthPercentage: 60,
      cgpa: 5.5,
      ugPercentage: 55,
      backlogs: 2,
      course: 'Mechanical',
      skills: ['AutoCAD'],
    });

    studentUnverifiedA = await User.create({
      name: 'Unverified Student A',
      email: 'unverified.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'PENDING_APPROVAL',
      isActive: true,
    });
    tokenStudentUnverifiedA = generateToken(studentUnverifiedA._id);

    studentInactiveA = await User.create({
      name: 'Inactive Student A',
      email: 'inactive.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: false,
    });

    // 4. Student in College B
    studentB = await User.create({
      name: 'Student Beta',
      email: 'student.b@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudentB = generateToken(studentB._id);

    // 5. Company
    company = await Company.create({
      name: 'Apex Tech Innovations',
      industry: 'Software',
    });

    // 6. Active Drive for College A
    activeDriveA = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeA._id,
      jobRole: 'Full Stack Engineer',
      jobDescription: 'Seeking competent software developers proficient in Node.js and React.',
      packageDetails: '12 LPA',
      driveDate: futureDate(15),
      registrationDeadline: futureDate(7),
      isActive: true,
      isArchived: false,
      eligibilityCriteria: {
        ugCriteriaType: 'CGPA',
        minCgpa: 7.0,
        minTenthPercentage: 70,
        minTwelfthPercentage: 70,
        maxBacklogs: 0,
      },
    });

    // 7. Archived Drive for College A
    archivedDriveA = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeA._id,
      jobRole: 'Cloud Architect',
      jobDescription: 'Archived placement drive role for senior cloud engineering candidates.',
      packageDetails: '18 LPA',
      driveDate: futureDate(20),
      registrationDeadline: futureDate(10),
      isActive: false,
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: officerA._id,
      eligibilityCriteria: {
        ugCriteriaType: 'CGPA',
        minCgpa: 6.0,
        minTenthPercentage: 60,
        minTwelfthPercentage: 60,
        maxBacklogs: 1,
      },
    });

    // studentA1 has already applied to archivedDriveA
    await DriveApplication.create({
      student: studentA1._id,
      placementDrive: archivedDriveA._id,
      collegeId: collegeA._id,
      status: 'Applied',
    });
  });

  // =========================================================================
  // TASK 1: ARCHIVED DRIVE READ-ONLY ACCESS & APPLICATION BLOCKING
  // =========================================================================

  describe('Task 1: Archived-drive read-only access (Option 1)', () => {
    it('Applied student CAN view archived drive in read-only mode (200)', async () => {
      const res = await request(app)
        .get(`/api/student/drives/${archivedDriveA._id}`)
        .set('Authorization', `Bearer ${tokenStudentA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive).toBeDefined();
      expect(res.body.drive.jobRole).toBe('Cloud Architect');
      expect(res.body.drive.isArchived).toBe(true);
      expect(res.body.drive.isReadOnly).toBe(true);
      expect(res.body.drive.hasApplied).toBe(true);
    });

    it('Non-applied student CANNOT view archived drive (403)', async () => {
      const res = await request(app)
        .get(`/api/student/drives/${archivedDriveA._id}`)
        .set('Authorization', `Bearer ${tokenStudentA2}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    it('Cross-tenant student CANNOT view archived drive (403)', async () => {
      const res = await request(app)
        .get(`/api/student/drives/${archivedDriveA._id}`)
        .set('Authorization', `Bearer ${tokenStudentB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Explicitly blocks new applications to archived drives (400)', async () => {
      const res = await request(app)
        .post(`/api/student/applications/${archivedDriveA._id}`)
        .set('Authorization', `Bearer ${tokenStudentA2}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/archived/i);
    });

    it('Preserves application history for archived drives in getMyApplications', async () => {
      const res = await request(app)
        .get('/api/student/applications')
        .set('Authorization', `Bearer ${tokenStudentA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.applications.length).toBe(1);
      const appRecord = res.body.applications[0];
      expect(appRecord.placementDrive._id.toString()).toBe(archivedDriveA._id.toString());
      expect(appRecord.placementDrive.jobRole).toBe('Cloud Architect');
    });
  });

  // =========================================================================
  // TASK 2: NEW-DRIVE NOTIFICATIONS (Failure-Isolated & Deduplicated)
  // =========================================================================

  describe('Task 2: New-drive notifications on drive creation', () => {
    it('Creates DRIVE_ANNOUNCEMENT notifications for all verified students of officer college', async () => {
      const payload = {
        companyName: 'Apex Tech Innovations',
        jobRole: 'Systems Analyst',
        companyLocation: 'Hyderabad, Telangana, India',
        jobDescription: 'Analyze and optimize high-throughput distributed systems in Linux environments.',
        packageDetails: '15 LPA',
        driveDate: futureDate(12).toISOString(),
        registrationDeadline: futureDate(5).toISOString(),
        eligibilityCriteria: {
          ugCriteriaType: 'NONE',
          minCgpa: 0,
          minUgPercentage: 0,
          minTenthPercentage: 0,
          minTwelfthPercentage: 0,
          maxBacklogs: 0,
        },
      };

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(payload);

      expect(res.status).toBe(201);
      const newDriveId = res.body.drive._id;

      // Check notifications created
      const notifsA1 = await Notification.find({
        recipient: studentA1._id,
        placementDrive: newDriveId,
      });
      expect(notifsA1.length).toBe(1);
      expect(notifsA1[0].type).toBe('DRIVE_ANNOUNCEMENT');
      expect(notifsA1[0].title).toMatch(/Systems Analyst/i);
      expect(notifsA1[0].collegeId.toString()).toBe(collegeA._id.toString());

      const notifsA2 = await Notification.find({
        recipient: studentA2._id,
        placementDrive: newDriveId,
      });
      expect(notifsA2.length).toBe(1);

      // Student B (College B) must receive ZERO notifications
      const notifsB = await Notification.find({
        recipient: studentB._id,
        placementDrive: newDriveId,
      });
      expect(notifsB.length).toBe(0);

      // Unverified & Inactive students in College A must receive ZERO notifications
      const notifsUnverified = await Notification.find({
        recipient: studentUnverifiedA._id,
        placementDrive: newDriveId,
      });
      expect(notifsUnverified.length).toBe(0);

      const notifsInactive = await Notification.find({
        recipient: studentInactiveA._id,
        placementDrive: newDriveId,
      });
      expect(notifsInactive.length).toBe(0);
    });

    it('Deduplicates DRIVE_ANNOUNCEMENT notifications idempotently', async () => {
      // Simulate partial unique index by inserting notification once
      await Notification.create({
        recipient: studentA1._id,
        collegeId: collegeA._id,
        title: 'New Placement Drive: Full Stack Engineer',
        message: 'A drive announcement.',
        type: 'DRIVE_ANNOUNCEMENT',
        placementDrive: activeDriveA._id,
        isRead: false,
      });

      // Attempting to insert duplicate with same recipient, type, and drive should trigger E11000
      let duplicateCaught = false;
      try {
        await Notification.create({
          recipient: studentA1._id,
          collegeId: collegeA._id,
          title: 'Duplicate Announcement',
          message: 'Should be rejected by partial index.',
          type: 'DRIVE_ANNOUNCEMENT',
          placementDrive: activeDriveA._id,
          isRead: false,
        });
      } catch (err) {
        duplicateCaught = true;
        expect(err.code).toBe(11000);
      }
      expect(duplicateCaught).toBe(true);
    });

    it('Drive creation succeeds even if notification dispatch throws (Failure isolation)', async () => {
      // Mock Notification.insertMany to throw an error
      const spy = jest.spyOn(Notification, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB network outage'));

      const payload = {
        companyName: 'Apex Tech Innovations',
        jobRole: 'Site Reliability Engineer',
        companyLocation: 'Hyderabad, Telangana, India',
        jobDescription: 'Maintain system reliability, SLA guarantees, and infrastructure observability.',
        packageDetails: '14 LPA',
        driveDate: futureDate(14).toISOString(),
        registrationDeadline: futureDate(6).toISOString(),
        eligibilityCriteria: {
          ugCriteriaType: 'NONE',
          minCgpa: 0,
          minUgPercentage: 0,
          minTenthPercentage: 0,
          minTwelfthPercentage: 0,
          maxBacklogs: 0,
        },
      };

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(payload);

      // Drive must still be created with 201 Created
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.jobRole).toBe('Site Reliability Engineer');

      spy.mockRestore();
    });
  });

  // =========================================================================
  // TASK 3 & 4: DASHBOARD LATEST DRIVES & WATERMARK BADGE SUPPORT
  // =========================================================================

  describe('Task 3 & 4: Student dashboard latest drives and watermark', () => {
    it('Returns latest 3 non-archived drives sorted createdAt descending with eligibility', async () => {
      // Create additional drive for Alpha
      const drive2 = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeA._id,
        jobRole: 'DevOps Engineer',
        jobDescription: 'Kubernetes, Docker, CI/CD pipeline automation.',
        packageDetails: '11 LPA',
        driveDate: futureDate(8),
        registrationDeadline: futureDate(4),
        isActive: true,
        isArchived: false,
        eligibilityCriteria: {
          ugCriteriaType: 'NONE',
          minCgpa: 0,
          minUgPercentage: 0,
          minTenthPercentage: 0,
          minTwelfthPercentage: 0,
          maxBacklogs: 0,
        },
      });

      const res = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${tokenStudentA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.latestDrives).toBeDefined();
      expect(Array.isArray(res.body.latestDrives)).toBe(true);
      expect(res.body.latestDrives.length).toBe(2);

      // Verify sorted createdAt descending: drive2 is newest
      expect(res.body.latestDrives[0]._id.toString()).toBe(drive2._id.toString());
      expect(res.body.latestDrives[1]._id.toString()).toBe(activeDriveA._id.toString());

      // Archived drive must be excluded
      const driveIds = res.body.latestDrives.map((d) => d._id.toString());
      expect(driveIds).not.toContain(archivedDriveA._id.toString());

      // Latest drive timestamp present for client watermark
      expect(res.body.latestDriveCreatedAt).toBeDefined();
    });

    it('getAvailableDrives provides latestDriveCreatedAt for navigation watermark', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.latestDriveCreatedAt).toBeDefined();
    });
  });
});
