/**
 * CPMS Batch 1A — Mandatory Tests
 * Tests: Issue C (lifecycle) and Issue D (description validation)
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
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('CPMS Batch 1A — Mandatory Tests', () => {
  // ---- Fixtures ----
  let collegeA, collegeB;
  let officerA, tokenOfficerA;
  let officerB, tokenOfficerB;
  let studentA, tokenStudentA;
  let company, drive;

  const futureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'batch1a_test_secret_key_at_least_32_chars!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Two colleges
    collegeA = await College.create({ name: 'College Alpha', isActive: true });
    collegeB = await College.create({ name: 'College Beta', isActive: true });

    // Officers
    officerA = await User.create({
      name: 'Officer A',
      email: 'officerA@test.com',
      password: 'hashed',
      role: 'placement_officer',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerA = generateToken(officerA._id);

    officerB = await User.create({
      name: 'Officer B',
      email: 'officerB@test.com',
      password: 'hashed',
      role: 'placement_officer',
      collegeId: collegeB._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerB = generateToken(officerB._id);

    // Student in College A
    studentA = await User.create({
      name: 'Student A',
      email: 'studentA@test.com',
      password: 'hashed',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenStudentA = generateToken(studentA._id);

    // Company
    company = await Company.create({ name: 'Acme Corp' });

    // Drive belonging to College A
    drive = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeA._id,
      jobRole: 'Software Engineer',
      jobDescription: 'A valid job description with enough characters.',
      driveDate: futureDate(10),
      registrationDeadline: futureDate(5),
      isActive: true,
    });
  });

  // ---------------------------------------------------------------
  // CROSS-TENANT TESTS
  // ---------------------------------------------------------------

  describe('Cross-tenant isolation', () => {
    it('Officer B cannot archive College A drive', async () => {
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerB}`);
      expect(res.status).toBe(403);
    });

    it('Officer B cannot restore College A drive', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerB}`);
      expect(res.status).toBe(403);
    });

    it('Officer B cannot delete College A drive', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerB}`);
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------
  // STUDENT ROLE BLOCK
  // ---------------------------------------------------------------

  describe('Students cannot archive or delete', () => {
    it('Student cannot archive a drive', async () => {
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/archive`)
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(403);
    });

    it('Student cannot delete a drive', async () => {
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------
  // ARCHIVE / RESTORE LIFECYCLE
  // ---------------------------------------------------------------

  describe('Archive and Restore lifecycle', () => {
    it('Officer A can archive their own drive', async () => {
      // Drive must be closed before it can be archived
      await PlacementDrive.findByIdAndUpdate(drive._id, { isActive: false });
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = await PlacementDrive.findById(drive._id);
      expect(updated.isArchived).toBe(true);
      expect(updated.isActive).toBe(false);
      expect(updated.archivedAt).toBeTruthy();
      expect(updated.archivedBy.toString()).toBe(officerA._id.toString());
    });

    it('Archiving already-archived drive returns 400', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(400);
    });

    it('Officer A can restore an archived drive', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, {
        isArchived: true, isActive: false, archivedAt: new Date(), archivedBy: officerA._id,
      });
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = await PlacementDrive.findById(drive._id);
      expect(updated.isArchived).toBe(false);
    });

    it('Restoring non-archived drive returns 400', async () => {
      const res = await request(app)
        .patch(`/api/officer/drives/${drive._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------
  // DELETE GATES
  // ---------------------------------------------------------------

  describe('Permanent delete gates', () => {
    it('Delete blocked if drive is NOT archived', async () => {
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/archive/i);
    });

    it('Delete blocked if drive has applications', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      await DriveApplication.create({
        student: studentA._id,
        placementDrive: drive._id,
        collegeId: collegeA._id,
        status: 'Applied',
      });
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/application/i);
    });

    it('Delete succeeds when archived with zero applications', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const gone = await PlacementDrive.findById(drive._id);
      expect(gone).toBeNull();
    });

    it('Repeated delete returns 404 — no unsafe error', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      const res = await request(app)
        .delete(`/api/officer/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // STUDENT VISIBILITY
  // ---------------------------------------------------------------

  describe('Archived drives absent from student opportunities; history intact', () => {
    it('Archived drive does NOT appear in student opportunities list', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(200);
      const driveIds = (res.body.drives || []).map((d) => d._id.toString());
      expect(driveIds).not.toContain(drive._id.toString());
    });

    it('Non-archived active drive appears in student opportunities', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(200);
      const driveIds = (res.body.drives || []).map((d) => d._id.toString());
      expect(driveIds).toContain(drive._id.toString());
    });

    it('Application history remains intact after drive is archived', async () => {
      await DriveApplication.create({
        student: studentA._id,
        placementDrive: drive._id,
        collegeId: collegeA._id,
        status: 'Applied',
      });
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .get('/api/student/applications')
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(200);
      expect(res.body.applications.length).toBeGreaterThan(0);
      const appDriveIds = res.body.applications.map((a) => a.placementDrive?._id?.toString());
      expect(appDriveIds).toContain(drive._id.toString());
    });

    it('Student cannot access archived drive by direct ID', async () => {
      await PlacementDrive.findByIdAndUpdate(drive._id, { isArchived: true, isActive: false });
      const res = await request(app)
        .get(`/api/student/drives/${drive._id}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------
  // DESCRIPTION VALIDATION (Issue D)
  // ---------------------------------------------------------------

  describe('Description validation', () => {
    const basePayload = (daysAhead = 10) => ({
      companyName: 'Test Corp',
      jobRole: 'Tester',
      companyLocation: 'Bangalore, Karnataka, India',
      driveDate: futureDate(daysAhead).toISOString(),
      registrationDeadline: futureDate(daysAhead - 5).toISOString(),
      eligibilityCriteria: {
        ugCriteriaType: 'NONE',
        minCgpa: 0,
        minUgPercentage: 0,
        minTenthPercentage: 0,
        minTwelfthPercentage: 0,
        maxBacklogs: 0,
      },
    });

    it('Rejects description shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send({ ...basePayload(), jobDescription: 'Too short' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/10 characters/i);
    });

    it('Rejects description longer than 5000 characters', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send({ ...basePayload(), jobDescription: 'A'.repeat(5001) });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/5000/i);
    });

    it('Accepts valid description and stores it as plain text', async () => {
      const desc = 'This is a valid job description with enough characters for the test.';
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send({ ...basePayload(), jobDescription: desc });
      expect(res.status).toBe(201);
      expect(res.body.drive.jobDescription).toBe(desc.trim());
    });

    it('HTML in description round-trips as plain text (stored verbatim)', async () => {
      const desc = '<script>alert("xss")</script> This is a long enough job description for the test.';
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send({ ...basePayload(), jobDescription: desc });
      expect(res.status).toBe(201);
      expect(res.body.drive.jobDescription).toBe(desc.trim());
    });
  });
});
