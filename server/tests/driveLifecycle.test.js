const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const PlacementDrive = require('../models/PlacementDrive');
const Company = require('../models/Company');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');
const jwt = require('jsonwebtoken');
const { getDriveLifecycleStatus, isRegistrationDeadlinePassed } = require('../utils/driveLifecycle');

describe('CPMS: Drive Lifecycle Follow-up (after Batch 1A / 1B)', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, studentAlpha, studentBeta;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenStudentAlpha, tokenStudentBeta;
  let company;

  const generateToken = (userId, role = 'student') => {
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'lifecycle_test_secret_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    collegeAlpha = await College.create({ name: 'Alpha Institute of Tech', isActive: true });
    collegeBeta = await College.create({ name: 'Beta State College', isActive: true });

    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer.alpha@alphatech.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    officerBeta = await User.create({
      name: 'Officer Beta',
      email: 'officer.beta@betastate.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentAlpha = await User.create({
      name: 'Student Alpha',
      email: 'student.alpha@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-001',
      department: 'Computer Science',
      cgpa: 8.5,
      tenthPercentage: 85,
      twelfthPercentage: 80,
      ugPercentage: 85,
      backlogs: 0,
      skills: ['JavaScript', 'Node.js', 'React'],
    });

    studentBeta = await User.create({
      name: 'Student Beta',
      email: 'student.beta@betastate.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    await StudentProfile.create({
      user: studentBeta._id,
      collegeId: collegeBeta._id,
      rollNumber: 'BETA-001',
      department: 'Computer Science',
      cgpa: 8.0,
      tenthPercentage: 80,
      twelfthPercentage: 78,
      ugPercentage: 80,
      backlogs: 0,
    });

    tokenOfficerAlpha = generateToken(officerAlpha._id, 'placement_officer');
    tokenOfficerBeta = generateToken(officerBeta._id, 'placement_officer');
    tokenStudentAlpha = generateToken(studentAlpha._id, 'student');
    tokenStudentBeta = generateToken(studentBeta._id, 'student');

    company = await Company.create({
      name: 'Nexus Tech Global',
      industry: 'Software',
    });
  });

  // =========================================================================
  // 1. DEADLINE BOUNDARIES & TIMEZONE RULES
  // =========================================================================

  describe('1. Deadline Boundaries & Timezone Rules', () => {
    test('Datetime deadline: 1 second before = active; exactly at/after = closed', () => {
      const deadline = new Date('2026-11-05T15:30:00.000Z');

      const oneSecBefore = new Date('2026-11-05T15:29:59.000Z');
      const exactlyAt = new Date('2026-11-05T15:30:00.000Z');
      const oneSecAfter = new Date('2026-11-05T15:30:01.000Z');

      expect(isRegistrationDeadlinePassed(deadline, oneSecBefore)).toBe(false);
      expect(isRegistrationDeadlinePassed(deadline, exactlyAt)).toBe(true);
      expect(isRegistrationDeadlinePassed(deadline, oneSecAfter)).toBe(true);

      const driveMock = {
        isArchived: false,
        isActive: true,
        registrationDeadline: deadline,
      };

      expect(getDriveLifecycleStatus(driveMock, oneSecBefore)).toBe('active');
      expect(getDriveLifecycleStatus(driveMock, exactlyAt)).toBe('closed');
      expect(getDriveLifecycleStatus(driveMock, oneSecAfter)).toBe('closed');
    });

    test('Date-only deadline stays active until end-of-day', () => {
      // Date-only stored as midnight UTC
      const dateOnlyDeadline = new Date('2026-11-05T00:00:00.000Z');

      // During the day at 12:00 PM
      const midday = new Date('2026-11-05T12:00:00.000Z');
      expect(isRegistrationDeadlinePassed(dateOnlyDeadline, midday)).toBe(false);

      // 1 second before end of day UTC (23:59:58)
      const oneSecBeforeEndOfDay = new Date('2026-11-05T23:59:58.000Z');
      expect(isRegistrationDeadlinePassed(dateOnlyDeadline, oneSecBeforeEndOfDay)).toBe(false);

      // Next day starts (2026-11-06T00:00:00.000Z)
      const nextDay = new Date('2026-11-06T00:00:00.000Z');
      expect(isRegistrationDeadlinePassed(dateOnlyDeadline, nextDay)).toBe(true);

      const driveMock = {
        isArchived: false,
        isActive: true,
        registrationDeadline: dateOnlyDeadline,
      };

      expect(getDriveLifecycleStatus(driveMock, midday)).toBe('active');
      expect(getDriveLifecycleStatus(driveMock, oneSecBeforeEndOfDay)).toBe('active');
      expect(getDriveLifecycleStatus(driveMock, nextDay)).toBe('closed');
    });

    test('Drive date does not affect registration deadline', async () => {
      // Drive date in past, but registration deadline in future (unusual, but spec rule: drive date must never close registration)
      const drive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Specialist Role',
        companyLocation: 'Bangalore, India',
        jobDescription: 'Drive date is not used for deadline checking.',
        driveDate: new Date('2026-11-01T10:00:00.000Z'),
        registrationDeadline: new Date('2026-11-10T18:00:00.000Z'),
        isActive: true,
        isArchived: false,
      });

      const now = new Date('2026-11-05T10:00:00.000Z');
      expect(getDriveLifecycleStatus(drive, now)).toBe('active');
    });
  });

  // =========================================================================
  // 2. LIFECYCLE CATEGORIES & MUTUAL EXCLUSIVITY
  // =========================================================================

  describe('2. Lifecycle Categories & Single Source of Truth', () => {
    test('Manually closed drive with future deadline stays closed', () => {
      const futureDeadline = new Date(Date.now() + 10 * 86400000);
      const drive = {
        isArchived: false,
        isActive: false, // manually closed
        registrationDeadline: futureDeadline,
      };

      expect(getDriveLifecycleStatus(drive)).toBe('closed');
    });

    test('No category overlap: each drive appears in exactly one of Active/Closed/Archived, and counts equal list lengths', async () => {
      const now = new Date();

      // Drive 1: Active
      await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Active Engineer',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Active drive accepting applications.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: true,
        isArchived: false,
      });

      // Drive 2: Closed by deadline expiration
      await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Expired Engineer',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Expired drive not accepting applications.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 2 * 86400000), // passed
        isActive: true,
        isArchived: false,
      });

      // Drive 3: Closed manually (isActive: false)
      await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Manually Closed Engineer',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Manually closed drive.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: false,
        isArchived: false,
      });

      // Drive 4: Archived
      await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Archived Engineer',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Archived drive.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: false,
        isArchived: true,
      });

      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.counts).toBeDefined();

      const { total, active, closed, archived } = res.body.counts;

      expect(active).toBe(1);
      expect(closed).toBe(2);
      expect(archived).toBe(1);
      expect(total).toBe(active + closed); // 3 non-archived

      // Verify each drive has exactly one status
      const drives = res.body.drives;
      expect(drives.length).toBe(4);

      const activeList = drives.filter((d) => d.status === 'active');
      const closedList = drives.filter((d) => d.status === 'closed');
      const archivedList = drives.filter((d) => d.status === 'archived');

      expect(activeList.length).toBe(active);
      expect(closedList.length).toBe(closed);
      expect(archivedList.length).toBe(archived);

      // Mutually exclusive: sum equals total list length
      expect(activeList.length + closedList.length + archivedList.length).toBe(drives.length);
    });

    test('Expired, non-archived drive appears in Closed without officer intervention', async () => {
      const now = new Date();
      const expiredDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Auto Closed Role',
        companyLocation: 'Chennai, India',
        jobDescription: 'Drive with past deadline.',
        driveDate: new Date(now.getTime() + 2 * 86400000),
        registrationDeadline: new Date(now.getTime() - 10000), // 10s ago
        isActive: true,
        isArchived: false,
      });

      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      const found = res.body.drives.find((d) => d._id === expiredDrive._id.toString());
      expect(found).toBeDefined();
      expect(found.status).toBe('closed');
    });

    test('Restoring an expired archived drive lands in Closed, never Active', async () => {
      const now = new Date();
      const expiredArchivedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Expired Archived Role',
        companyLocation: 'Chennai, India',
        jobDescription: 'Archived drive with passed registration deadline.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000), // yesterday
        isActive: false,
        isArchived: true,
      });

      const res = await request(app)
        .patch(`/api/officer/drives/${expiredArchivedDrive._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.isArchived).toBe(false);
      expect(res.body.drive.status).toBe('closed');
    });
  });

  // =========================================================================
  // 3. APPLY ENDPOINT WRITE-TIME VALIDATION
  // =========================================================================

  describe('3. Apply Endpoint Write-time Rejection', () => {
    test('Stale-page apply after deadline is rejected by the server', async () => {
      const now = new Date();
      // Drive deadline was 1 hour ago
      const expiredDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Stale UI Opportunity',
        companyLocation: 'Hyderabad, India',
        jobDescription: 'User tries applying on stale UI page.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 3600000),
        isActive: true,
        isArchived: false,
      });

      const res = await request(app)
        .post(`/api/student/applications/${expiredDrive._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_CLOSED');
      expect(res.body.message).toMatch(/deadline has passed/i);
    });

    test('Apply rejected if drive was manually closed', async () => {
      const now = new Date();
      const closedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Manually Inactivated Opportunity',
        companyLocation: 'Hyderabad, India',
        jobDescription: 'Drive manually deactivated.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: false,
        isArchived: false,
      });

      const res = await request(app)
        .post(`/api/student/applications/${closedDrive._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_CLOSED');
    });

    test('Apply rejected if drive is archived', async () => {
      const now = new Date();
      const archivedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Archived Opportunity',
        companyLocation: 'Hyderabad, India',
        jobDescription: 'Archived drive.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: false,
        isArchived: true,
      });

      const res = await request(app)
        .post(`/api/student/applications/${archivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_ARCHIVED');
    });
  });

  // =========================================================================
  // 4. ARCHIVE (CLOSED DRIVES ONLY) & PERMANENT DELETE (SAFEGUARDS)
  // =========================================================================

  describe('4. Archive (Closed Only) & Permanent Delete Safeguards', () => {
    test('Archiving an active drive is rejected (400)', async () => {
      const now = new Date();
      const activeDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Live Active Role',
        companyLocation: 'Pune, India',
        jobDescription: 'Still open for registration.',
        driveDate: new Date(now.getTime() + 10 * 86400000),
        registrationDeadline: new Date(now.getTime() + 5 * 86400000),
        isActive: true,
        isArchived: false,
      });

      const res = await request(app)
        .patch(`/api/officer/drives/${activeDrive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_NOT_CLOSED');
    });

    test('Archiving a closed drive succeeds (200)', async () => {
      const now = new Date();
      const closedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Ready For Archive Role',
        companyLocation: 'Pune, India',
        jobDescription: 'Closed drive ready for archive.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000), // expired
        isActive: true,
        isArchived: false,
      });

      const res = await request(app)
        .patch(`/api/officer/drives/${closedDrive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.isArchived).toBe(true);
      expect(res.body.drive.status).toBe('archived');
    });

    test('Delete blocked (400) when drive is not archived', async () => {
      const now = new Date();
      const unarchivedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Unarchived Role',
        companyLocation: 'Pune, India',
        jobDescription: 'Not archived.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000),
        isActive: false,
        isArchived: false,
      });

      const res = await request(app)
        .delete(`/api/officer/drives/${unarchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRIVE_NOT_ARCHIVED');
    });

    test('Delete blocked (409) with applications; recommends keeping archived', async () => {
      const now = new Date();
      const driveWithApps = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Popular Role with Apps',
        companyLocation: 'Pune, India',
        jobDescription: 'Drive with applications.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000),
        isActive: false,
        isArchived: true,
      });

      await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveWithApps._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .delete(`/api/officer/drives/${driveWithApps._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_DELETE_BLOCKED_DEPENDENT_RECORDS');
      expect(res.body.message).toMatch(/application/i);
      expect(res.body.message).toMatch(/archived/i);
    });

    test('Delete allowed for empty archived drive; repeated delete returns 404 safely', async () => {
      const now = new Date();
      const emptyArchivedDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Empty Archived Role',
        companyLocation: 'Pune, India',
        jobDescription: 'Empty archived drive.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000),
        isActive: false,
        isArchived: true,
      });

      const res1 = await request(app)
        .delete(`/api/officer/drives/${emptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      const checkInDb = await PlacementDrive.findById(emptyArchivedDrive._id);
      expect(checkInDb).toBeNull();

      // Repeated delete returns 404 idempotent response
      const res2 = await request(app)
        .delete(`/api/officer/drives/${emptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res2.status).toBe(404);
      expect(res2.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. TENANT & ROLE SECURITY GATES
  // =========================================================================

  describe('5. Tenant and Role Security Gates', () => {
    let driveAlphaClosed, driveAlphaArchived;

    beforeEach(async () => {
      const now = new Date();
      driveAlphaClosed = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Alpha Closed Drive',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Drive in College Alpha.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000),
        isActive: false,
        isArchived: false,
      });

      driveAlphaArchived = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Alpha Archived Drive',
        companyLocation: 'Bengaluru, India',
        jobDescription: 'Archived drive in College Alpha.',
        driveDate: new Date(now.getTime() + 5 * 86400000),
        registrationDeadline: new Date(now.getTime() - 86400000),
        isActive: false,
        isArchived: true,
      });
    });

    test('Cross-tenant officer cannot archive, restore, or delete College Alpha drive', async () => {
      // Officer Beta attempts archive on College Alpha drive
      const archiveRes = await request(app)
        .patch(`/api/officer/drives/${driveAlphaClosed._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);
      expect(archiveRes.status).toBe(403);

      // Officer Beta attempts restore on College Alpha drive
      const restoreRes = await request(app)
        .patch(`/api/officer/drives/${driveAlphaArchived._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);
      expect(restoreRes.status).toBe(403);

      // Officer Beta attempts delete on College Alpha drive
      const deleteRes = await request(app)
        .delete(`/api/officer/drives/${driveAlphaArchived._id}`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);
      expect(deleteRes.status).toBe(403);
    });

    test('Student token cannot archive, restore, or delete drives (403)', async () => {
      const archiveRes = await request(app)
        .patch(`/api/officer/drives/${driveAlphaClosed._id}/archive`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(archiveRes.status).toBe(403);

      const restoreRes = await request(app)
        .patch(`/api/officer/drives/${driveAlphaArchived._id}/restore`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(restoreRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/officer/drives/${driveAlphaArchived._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(deleteRes.status).toBe(403);
    });
  });
});
