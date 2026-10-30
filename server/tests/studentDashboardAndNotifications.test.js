const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const Notification = require('../models/Notification');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Feature 1: Student Dashboard Metrics & Persistent Notifications', () => {
  let collegeAlpha;
  let collegeBeta;
  let company;

  let studentAlpha1;
  let studentAlpha2;
  let studentBeta;
  let officerAlpha;
  let officerBeta;
  let recruiterUser;

  let studentAlpha1Token;
  let studentAlpha2Token;
  let studentBetaToken;
  let officerAlphaToken;
  let officerBetaToken;
  let recruiterToken;

  let driveAlphaEligible;
  let driveAlphaIneligible;
  let driveAlphaExpired;
  let driveBeta;

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
    collegeAlpha = await College.create({
      name: 'Alpha Engineering College',
      contactEmail: 'admin@alpha.edu',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta Institute of Technology',
      contactEmail: 'admin@beta.edu',
      isActive: true,
    });

    process.env.COLLEGE_ID = collegeAlpha._id.toString();

    // 2. Setup Company
    company = await Company.create({
      name: 'CloudCore Systems',
      industry: 'Enterprise Software',
    });

    // 3. Setup Users
    studentAlpha1 = await User.create({
      name: 'Alice Alpha',
      email: 'alice@alpha.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    studentAlpha1Token = generateToken(studentAlpha1._id, 'student');

    studentAlpha2 = await User.create({
      name: 'Alex Alpha',
      email: 'alex@alpha.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    studentAlpha2Token = generateToken(studentAlpha2._id, 'student');

    studentBeta = await User.create({
      name: 'Bob Beta',
      email: 'bob@beta.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    studentBetaToken = generateToken(studentBeta._id, 'student');

    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer@alpha.edu',
      password: 'Password123!',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    officerAlphaToken = generateToken(officerAlpha._id, 'placement_officer');

    officerBeta = await User.create({
      name: 'Officer Beta',
      email: 'officer@beta.edu',
      password: 'Password123!',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    officerBetaToken = generateToken(officerBeta._id, 'placement_officer');

    recruiterUser = await User.create({
      name: 'Tech Recruiter',
      email: 'recruiter@techcorp.com',
      password: 'Password123!',
      role: 'recruiter',
      isActive: true,
    });
    recruiterToken = generateToken(recruiterUser._id, 'recruiter');

    // 4. Setup Academic Profile for Student Alpha 1 (CGPA: 8.5, backlogs: 0, B.Tech, React/Node)
    await StudentProfile.create({
      user: studentAlpha1._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS001',
      department: 'Computer Science',
      course: 'B.Tech',
      cgpa: 8.5,
      backlogs: 0,
      skills: ['React', 'Node.js', 'MongoDB'],
    });

    // 5. Setup Placement Drives
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const pastDeadline = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Eligible drive in College Alpha (minCgpa: 7.0, open)
    driveAlphaEligible = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Fullstack development',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
        requiredSkills: ['Node.js'],
      },
    });

    // Ineligible drive in College Alpha (minCgpa: 9.0 > 8.5)
    driveAlphaIneligible = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Principal Architect',
      jobDescription: 'High CGPA requirements',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 9.0,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
      },
    });

    // Expired drive in College Alpha (deadline in the past)
    driveAlphaExpired = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Intern',
      jobDescription: 'Past deadline',
      driveDate: futureDate,
      registrationDeadline: pastDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 6.0,
      },
    });

    // Drive in College Beta (should not be counted for College Alpha)
    driveBeta = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeBeta._id,
      jobRole: 'Beta Engineer',
      jobDescription: 'College Beta only',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 6.0,
      },
    });
  });

  // =========================================================================
  // SUITE 1: STUDENT DASHBOARD SUMMARY ENDPOINT
  // =========================================================================
  describe('1. GET /api/student/dashboard/summary', () => {
    it('should return predictable zero counts when a student has no drives or applications', async () => {
      // Student Alpha 2 has no profile and no applications
      const res = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${studentAlpha2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalEligibleDrives).toBe(0);
      expect(res.body.registeredApplications).toBe(0);
      expect(res.body.inProgressApplications).toBe(0);
      expect(res.body.selectedApplications).toBe(0);
    });

    it('should return correct counts for a student with mixed application statuses and eligible drives', async () => {
      // Create additional drives to test application statuses
      const drive2 = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Cloud Engineer',
        jobDescription: 'Cloud infrastructure',
        driveDate: new Date(Date.now() + 10 * 86400000),
        registrationDeadline: new Date(Date.now() + 5 * 86400000),
        isActive: true,
        eligibilityCriteria: { minCgpa: 8.0 },
      });

      const drive3 = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'DevOps Engineer',
        jobDescription: 'CI/CD pipeline',
        driveDate: new Date(Date.now() + 10 * 86400000),
        registrationDeadline: new Date(Date.now() + 5 * 86400000),
        isActive: true,
        eligibilityCriteria: { minCgpa: 8.0 },
      });

      const drive4 = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'QA Engineer',
        jobDescription: 'Testing and automation',
        driveDate: new Date(Date.now() + 10 * 86400000),
        registrationDeadline: new Date(Date.now() + 5 * 86400000),
        isActive: true,
        eligibilityCriteria: { minCgpa: 8.0 },
      });

      // Student Alpha 1 applications:
      // 1. Applied
      await DriveApplication.create({
        student: studentAlpha1._id,
        placementDrive: driveAlphaEligible._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      // 2. Shortlisted (In Progress)
      await DriveApplication.create({
        student: studentAlpha1._id,
        placementDrive: drive2._id,
        collegeId: collegeAlpha._id,
        status: 'Shortlisted',
      });

      // 3. Interviewing (In Progress)
      await DriveApplication.create({
        student: studentAlpha1._id,
        placementDrive: drive3._id,
        collegeId: collegeAlpha._id,
        status: 'Interviewing',
      });

      // 4. Selected
      await DriveApplication.create({
        student: studentAlpha1._id,
        placementDrive: drive4._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      const res = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Eligible drives in College Alpha: driveAlphaEligible, drive2, drive3, drive4 (all minCgpa <= 8.5 and open) = 4
      expect(res.body.totalEligibleDrives).toBe(4);
      // Total submitted applications: 4
      expect(res.body.registeredApplications).toBe(4);
      // In Progress applications (Shortlisted + Interviewing): 2
      expect(res.body.inProgressApplications).toBe(2);
      // Selected applications: 1
      expect(res.body.selectedApplications).toBe(1);
    });

    it('should not count applications belonging to another student', async () => {
      // Applications for Student Alpha 2
      await DriveApplication.create({
        student: studentAlpha2._id,
        placementDrive: driveAlphaEligible._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // Check Student Alpha 1 summary: should remain 0
      const res = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.registeredApplications).toBe(0);
      expect(res.body.selectedApplications).toBe(0);
    });

    it('should not include data or drives from another college', async () => {
      // Student Beta has an application in College Beta
      await DriveApplication.create({
        student: studentBeta._id,
        placementDrive: driveBeta._id,
        collegeId: collegeBeta._id,
        status: 'Selected',
      });

      const resAlpha = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(resAlpha.status).toBe(200);
      expect(resAlpha.body.selectedApplications).toBe(0);
      // Should only count College Alpha eligible drives (driveAlphaEligible)
      expect(resAlpha.body.totalEligibleDrives).toBe(1);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/student/dashboard/summary');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized roles (placement_officer, recruiter) with 403', async () => {
      const officerRes = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${officerAlphaToken}`);
      expect(officerRes.status).toBe(403);

      const recruiterRes = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(recruiterRes.status).toBe(403);
    });
  });

  // =========================================================================
  // SUITE 2: NOTIFICATION CREATION ON APPLICATION STATUS CHANGE
  // =========================================================================
  describe('2. Officer Status Change & Notification Creation', () => {
    let application;

    beforeEach(async () => {
      application = await DriveApplication.create({
        student: studentAlpha1._id,
        placementDrive: driveAlphaEligible._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });
    });

    it('should create exactly one persistent notification when status genuinely changes', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${application._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.status).toBe('Shortlisted');

      // Verify persistent notification in DB
      const notifications = await Notification.find({ recipient: studentAlpha1._id });
      expect(notifications.length).toBe(1);

      const notif = notifications[0];
      expect(notif.recipient.toString()).toBe(studentAlpha1._id.toString());
      expect(notif.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(notif.type).toBe('STATUS_UPDATE');
      expect(notif.title).toContain('Software Engineer');
      expect(notif.message).toContain('Shortlisted');
      expect(notif.message).toContain('CloudCore Systems');
      expect(notif.isRead).toBe(false);
      expect(notif.application.toString()).toBe(application._id.toString());
      expect(notif.placementDrive.toString()).toBe(driveAlphaEligible._id.toString());
    });

    it('should NOT create duplicate notification when submitting the same status again', async () => {
      // First update: Applied -> Shortlisted
      await request(app)
        .patch(`/api/officer/applications/${application._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      let count = await Notification.countDocuments({ recipient: studentAlpha1._id });
      expect(count).toBe(1);

      // Second update with same status: Shortlisted -> Shortlisted
      const resDuplicate = await request(app)
        .patch(`/api/officer/applications/${application._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(resDuplicate.status).toBe(200);
      expect(resDuplicate.body.success).toBe(true);

      // Notification count must remain strictly 1
      count = await Notification.countDocuments({ recipient: studentAlpha1._id });
      expect(count).toBe(1);
    });

    it('should rollback application status if notification creation throws an unexpected error', async () => {
      // Spy on Notification.create and simulate a DB write failure
      const createSpy = jest.spyOn(Notification, 'create').mockRejectedValueOnce(
        new Error('Simulated database write failure during notification generation')
      );

      const res = await request(app)
        .patch(`/api/officer/applications/${application._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/rolled back/i);

      // Verify compensating rollback: application status must still be 'Applied'
      const appInDb = await DriveApplication.findById(application._id);
      expect(appInDb.status).toBe('Applied');

      createSpy.mockRestore();
    });
  });

  // =========================================================================
  // SUITE 3: STUDENT NOTIFICATION API
  // =========================================================================
  describe('3. Student Notification API Endpoints', () => {
    let notif1;
    let notif2;
    let notifBeta;

    beforeEach(async () => {
      // Create notifications for Student Alpha 1
      notif1 = await Notification.create({
        recipient: studentAlpha1._id,
        collegeId: collegeAlpha._id,
        title: 'Interview Scheduled',
        message: 'Your interview is set for tomorrow at 10 AM.',
        type: 'STATUS_UPDATE',
        isRead: false,
      });

      notif2 = await Notification.create({
        recipient: studentAlpha1._id,
        collegeId: collegeAlpha._id,
        title: 'Offer Extended',
        message: 'Congratulations! You have received an offer.',
        type: 'STATUS_UPDATE',
        isRead: false,
      });

      // Notification for Student Beta in College Beta
      notifBeta = await Notification.create({
        recipient: studentBeta._id,
        collegeId: collegeBeta._id,
        title: 'Beta College Update',
        message: 'Confidential Beta college announcement.',
        type: 'SYSTEM',
        isRead: false,
      });
    });

    it('should list notifications for the authenticated student ordered newest first', async () => {
      const res = await request(app)
        .get('/api/student/notifications')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.unreadCount).toBe(2);
      expect(res.body.notifications[0]._id.toString()).toBe(notif2._id.toString());
      expect(res.body.notifications[1]._id.toString()).toBe(notif1._id.toString());
    });

    it('should not allow Student A to read Student B notifications (multi-tenant and cross-student isolation)', async () => {
      // Student Alpha 2 queries notifications: should have 0
      const res = await request(app)
        .get('/api/student/notifications')
        .set('Authorization', `Bearer ${studentAlpha2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.notifications).toEqual([]);
    });

    it('should allow student to mark one notification as read and be idempotent', async () => {
      const res = await request(app)
        .patch(`/api/student/notifications/${notif1._id}/read`)
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notification.isRead).toBe(true);

      const dbNotif = await Notification.findById(notif1._id);
      expect(dbNotif.isRead).toBe(true);

      // Repeat mark-read request (idempotency check)
      const resRepeat = await request(app)
        .patch(`/api/student/notifications/${notif1._id}/read`)
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(resRepeat.status).toBe(200);
      expect(resRepeat.body.success).toBe(true);
      expect(resRepeat.body.notification.isRead).toBe(true);
    });

    it('should deny Student Alpha 1 from marking Student Beta notification as read with 404', async () => {
      // Attempting to access another college/student notification should 404 without leaking existence
      const res = await request(app)
        .patch(`/api/student/notifications/${notifBeta._id}/read`)
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify DB document was untouched
      const dbNotif = await Notification.findById(notifBeta._id);
      expect(dbNotif.isRead).toBe(false);
    });

    it('should allow student to mark all unread notifications as read and be idempotent', async () => {
      const res = await request(app)
        .patch('/api/student/notifications/read-all')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unreadAfter = await Notification.countDocuments({
        recipient: studentAlpha1._id,
        isRead: false,
      });
      expect(unreadAfter).toBe(0);

      // Verify Student Beta notifications were untouched
      const betaNotif = await Notification.findById(notifBeta._id);
      expect(betaNotif.isRead).toBe(false);

      // Idempotent repeat call
      const resRepeat = await request(app)
        .patch('/api/student/notifications/read-all')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(resRepeat.status).toBe(200);
      expect(resRepeat.body.success).toBe(true);
      expect(resRepeat.body.modifiedCount).toBe(0);
    });

    it('should return 400 for invalid notification ObjectId format', async () => {
      const res = await request(app)
        .patch('/api/student/notifications/invalid-id-format/read')
        .set('Authorization', `Bearer ${studentAlpha1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid notification id/i);
    });

    it('should reject unauthenticated requests to notification routes with 401', async () => {
      const resList = await request(app).get('/api/student/notifications');
      expect(resList.status).toBe(401);

      const resRead = await request(app).patch(`/api/student/notifications/${notif1._id}/read`);
      expect(resRead.status).toBe(401);

      const resReadAll = await request(app).patch('/api/student/notifications/read-all');
      expect(resReadAll.status).toBe(401);
    });

    it('should reject non-student roles with 403 on notification endpoints', async () => {
      const resOfficer = await request(app)
        .get('/api/student/notifications')
        .set('Authorization', `Bearer ${officerAlphaToken}`);
      expect(resOfficer.status).toBe(403);
    });
  });
});
