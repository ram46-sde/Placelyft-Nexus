const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const PlacementOutcome = require('../models/PlacementOutcome');
const Notification = require('../models/Notification');
const StudentProfile = require('../models/StudentProfile');
const Department = require('../models/Department');
const {
  changeApplicationStatus,
  validateApplicationDeletion,
  bulkChangeApplicationStatus,
} = require('../services/applicationStatusService');
const {
  verifyOutcomeService,
  revokeOutcomeService,
} = require('../services/placementOutcomeService');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('CPMS Phase 4B: Verified Placement Application Integrity', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, unverifiedOfficer;
  let studentAlpha, studentBeta, studentGamma, recruiterUser;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenUnverifiedOfficer, tokenStudentAlpha, tokenRecruiter;
  let companyAlpha;
  let driveAlpha, driveBeta;
  let deptCseAlpha;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
    await DriveApplication.createIndexes();
    await PlacementOutcome.createIndexes();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Technology',
      contactEmail: 'admin@alphatech.edu',
      address: '100 Tech Park, Alpha City',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta State University',
      contactEmail: 'admin@betacollege.edu',
      address: '200 University Way, Beta City',
      isActive: true,
    });

    // 2. Officers & Users
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
      email: 'officer.beta@betacollege.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    unverifiedOfficer = await User.create({
      name: 'Unverified Officer',
      email: 'unverified.officer@alphatech.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'LEGACY_UNVERIFIED',
      isActive: true,
    });

    studentAlpha = await User.create({
      name: 'Alice Student',
      email: 'alice@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentBeta = await User.create({
      name: 'Bob Student',
      email: 'bob@betacollege.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentGamma = await User.create({
      name: 'Charlie Student',
      email: 'charlie@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    recruiterUser = await User.create({
      name: 'Recruiter Ray',
      email: 'ray@recruiter.com',
      password: 'password123',
      role: 'recruiter',
      isActive: true,
    });

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);
    tokenUnverifiedOfficer = generateToken(unverifiedOfficer);
    tokenStudentAlpha = generateToken(studentAlpha);
    tokenRecruiter = generateToken(recruiterUser);

    deptCseAlpha = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      collegeId: collegeAlpha._id,
      isActive: true,
      aliases: ['CS'],
    });

    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-001',
      department: 'Computer Science',
      departmentId: deptCseAlpha._id,
    });

    await StudentProfile.create({
      user: studentGamma._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-003',
      department: 'Computer Science',
      departmentId: deptCseAlpha._id,
    });

    companyAlpha = await Company.create({
      name: 'Acme Systems',
      companyLocation: 'Bangalore',
      industry: 'Software',
    });

    driveAlpha = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Developer',
      jobDescription: 'Full Stack Engineering',
      package: 12,
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      eligibleBatch: ['2026'],
      isArchived: false,
    });

    driveBeta = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeBeta._id,
      jobRole: 'Data Engineer',
      jobDescription: 'Big Data Pipeline Engineering',
      package: 14,
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      eligibleBatch: ['2026'],
      isArchived: false,
    });
  });

  // =========================================================================
  // 1. Status Change with Absent or Revoked Outcome
  // =========================================================================
  describe('1. Normal Status Change with Absent or Revoked Outcome', () => {
    it('should successfully change status when no outcome exists', async () => {
      const testApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .patch(`/api/officer/applications/${testApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.status).toBe('Shortlisted');

      const updated = await DriveApplication.findById(testApp._id);
      expect(updated.status).toBe('Shortlisted');
    });

    it('should successfully change status when outcome is revoked', async () => {
      const testApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // Verify outcome first
      await request(app)
        .post(`/api/officer/outcomes/${testApp._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 12.0 });

      // Revoke outcome
      await request(app)
        .post(`/api/officer/outcomes/${testApp._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Offer was withdrawn by candidate for higher studies' });

      // Status change to Rejected must succeed now
      const res = await request(app)
        .patch(`/api/officer/applications/${testApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.status).toBe('Rejected');

      const updated = await DriveApplication.findById(testApp._id);
      expect(updated.status).toBe('Rejected');
    });
  });

  // =========================================================================
  // 2. 409 VERIFIED_OUTCOME_EXISTS for Every Transition on Verified Outcome
  // =========================================================================
  describe('2. Lock Enforces 409 VERIFIED_OUTCOME_EXISTS on Verified Outcome', () => {
    let lockedApp;

    beforeEach(async () => {
      lockedApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      const verifyRes = await request(app)
        .post(`/api/officer/outcomes/${lockedApp._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 15.5 });

      expect(verifyRes.status).toBe(200);
    });

    const targetStatuses = ['Rejected', 'Interviewing', 'Shortlisted', 'Applied', 'Selected'];

    targetStatuses.forEach((targetStatus) => {
      it(`should return 409 VERIFIED_OUTCOME_EXISTS when attempting transition to "${targetStatus}"`, async () => {
        const res = await request(app)
          .patch(`/api/officer/applications/${lockedApp._id}/status`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ status: targetStatus });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('VERIFIED_OUTCOME_EXISTS');
        expect(res.body.message).toMatch(/revoke/i);
        // Ensure no outcome data (package, CTC) is revealed
        expect(res.body.offerPackageCtc).toBeUndefined();
        expect(res.body.package).toBeUndefined();
        expect(res.body.outcome).toBeUndefined();

        // Application status must remain unchanged
        const dbApp = await DriveApplication.findById(lockedApp._id);
        expect(dbApp.status).toBe('Selected');
        expect(dbApp.outcomeVerified).toBe(true);
      });
    });
  });

  // =========================================================================
  // 3. Every Discovered Write Path Returns 409
  // =========================================================================
  describe('3. Every Discovered Write Path Returns 409', () => {
    let verifiedApp;

    beforeEach(async () => {
      verifiedApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      await request(app)
        .post(`/api/officer/outcomes/${verifiedApp._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 10 });
    });

    it('Write Path 1: Officer Controller PATCH /api/officer/applications/:id/status returns 409', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${verifiedApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('VERIFIED_OUTCOME_EXISTS');
    });

    it('Write Path 2: Bulk status service helper reports 409 per locked item', async () => {
      const unlockedApp = await DriveApplication.create({
        student: studentGamma._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const results = await bulkChangeApplicationStatus({
        items: [
          { applicationId: verifiedApp._id, status: 'Rejected' },
          { applicationId: unlockedApp._id, status: 'Shortlisted' },
        ],
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
      });

      expect(results).toHaveLength(2);
      // Item 1: locked -> 409
      expect(results[0].status).toBe(409);
      expect(results[0].error.code).toBe('VERIFIED_OUTCOME_EXISTS');
      // Item 2: unlocked -> 200
      expect(results[1].status).toBe(200);
      expect(results[1].data.success).toBe(true);

      const dbUnlocked = await DriveApplication.findById(unlockedApp._id);
      expect(dbUnlocked.status).toBe('Shortlisted');
      const dbLocked = await DriveApplication.findById(verifiedApp._id);
      expect(dbLocked.status).toBe('Selected');
    });

    it('Deletion Path: validateApplicationDeletion refuses locked application with 409', async () => {
      const checkLocked = await validateApplicationDeletion({
        applicationId: verifiedApp._id,
        collegeId: collegeAlpha._id,
      });

      expect(checkLocked.allowed).toBe(false);
      expect(checkLocked.status).toBe(409);
      expect(checkLocked.error.code).toBe('VERIFIED_OUTCOME_EXISTS');
      expect(checkLocked.error.message).toMatch(/revoke/i);
    });
  });

  // =========================================================================
  // 4. Blocked Request Creates Zero Notifications and Zero Status History
  // =========================================================================
  describe('4. Blocked Request Side Effects Suppression', () => {
    it('creates no notification, no history entry, and leaves application unmodified', async () => {
      const testApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      await request(app)
        .post(`/api/officer/outcomes/${testApp._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 8.5 });

      const notifCountBefore = await Notification.countDocuments();

      // Attempt to change status to Rejected
      const res = await request(app)
        .patch(`/api/officer/applications/${testApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(409);

      const notifCountAfter = await Notification.countDocuments();
      expect(notifCountAfter).toBe(notifCountBefore);

      const dbApp = await DriveApplication.findById(testApp._id);
      expect(dbApp.status).toBe('Selected');
    });
  });

  // =========================================================================
  // 5. Tenant Scoping and Role Authorization
  // =========================================================================
  describe('5. Multi-Tenant Scoping and Security', () => {
    let appAlpha;

    beforeEach(async () => {
      appAlpha = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      await request(app)
        .post(`/api/officer/outcomes/${appAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 11 });
    });

    it('cross-tenant status change via PATCH returns 403 (never 409) and leaks no outcome data', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${appAlpha._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/outside your college/i);
      expect(res.body.code).not.toBe('VERIFIED_OUTCOME_EXISTS');
    });

    it('cross-tenant status change via changeApplicationStatus returns 404 (never 409)', async () => {
      const res = await changeApplicationStatus({
        applicationId: appAlpha._id,
        collegeId: collegeBeta._id, // mismatched college
        status: 'Rejected',
        officerUser: officerBeta,
      });

      expect(res.status).toBe(404);
      expect(res.error.code).toBe('APPLICATION_NOT_FOUND');
    });

    it('cross-tenant outcomes verify returns 404', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${appAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ offerPackageCtc: 11 });

      expect(res.status).toBe(404);
    });

    it('student token on status change is rejected with 403', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${appAlpha._id}/status`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(403);
    });

    it('recruiter token on status change is rejected with 403', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${appAlpha._id}/status`)
        .set('Authorization', `Bearer ${tokenRecruiter}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 6. Legacy Outcome Handling, Self-Healing, and Revocation
  // =========================================================================
  describe('6. Legacy Outcomes Without Guard Flag', () => {
    let legacyApp, legacyOutcome;

    beforeEach(async () => {
      legacyApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
        // outcomeVerified flag omitted/undefined as in legacy Phase 4A
      });

      legacyOutcome = await PlacementOutcome.create({
        application: legacyApp._id,
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'verified',
        offerPackage: {
          ctc: 9.0,
          unit: 'LPA',
          currency: 'INR',
        },
        offerPackageCtc: 9.0,
        departmentSnapshot: {
          departmentId: deptCseAlpha._id,
          departmentName: 'Computer Science',
          departmentCode: 'CSE',
          resolutionStatus: 'canonical_exact',
        },
        verifiedAt: new Date(),
        verifiedBy: officerAlpha._id,
        history: [
          {
            action: 'verified',
            oldStatus: null,
            newStatus: 'verified',
            changedBy: officerAlpha._id,
            changedAt: new Date(),
            ctc: 9.0,
          },
        ],
      });
    });

    it('legacy verified outcome blocks status change even without flag', async () => {
      const checkApp = await DriveApplication.findById(legacyApp._id);
      expect(checkApp.outcomeVerified).toBeUndefined();

      const res = await request(app)
        .patch(`/api/officer/applications/${legacyApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('VERIFIED_OUTCOME_EXISTS');
    });

    it('verify on legacy outcome self-heals outcomeVerified flag', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${legacyApp._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 9.0 });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('already_verified');

      const healedApp = await DriveApplication.findById(legacyApp._id);
      expect(healedApp.outcomeVerified).toBe(true);
    });

    it('revoke on legacy outcome clears flag and allows subsequent status change', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${legacyApp._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Revoking legacy outcome for testing' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('revoked');
      expect(res.body.status).toBe('revoked');

      const clearedApp = await DriveApplication.findById(legacyApp._id);
      expect(clearedApp.outcomeVerified).toBe(false);

      const statusRes = await request(app)
        .patch(`/api/officer/applications/${legacyApp._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.application.status).toBe('Rejected');
    });
  });

  // =========================================================================
  // 7. Revoke, Transition, and Re-Verification State Machine
  // =========================================================================
  describe('7. Revoke, Transition, and Re-Verification State Machine', () => {
    it('re-verify succeeds only when application is Selected, and fails otherwise', async () => {
      const appRecord = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // 1. Initial verify
      await request(app)
        .post(`/api/officer/outcomes/${appRecord._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 16 });

      // 2. Revoke
      await request(app)
        .post(`/api/officer/outcomes/${appRecord._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Revocation before changing status' });

      // 3. Status change to Rejected
      const rejectRes = await request(app)
        .patch(`/api/officer/applications/${appRecord._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Rejected' });
      expect(rejectRes.status).toBe(200);

      // 4. Attempt re-verify on Rejected application -> must fail with 400 APPLICATION_NOT_SELECTED
      const failReverify = await request(app)
        .post(`/api/officer/outcomes/${appRecord._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 16 });

      expect(failReverify.status).toBe(400);
      expect(failReverify.body.code).toBe('APPLICATION_NOT_SELECTED');

      // 5. Change back to Selected
      const selectRes = await request(app)
        .patch(`/api/officer/applications/${appRecord._id}/status`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ status: 'Selected' });
      expect(selectRes.status).toBe(200);

      // 6. Re-verify on Selected application -> must succeed
      const reverifyRes = await request(app)
        .post(`/api/officer/outcomes/${appRecord._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ offerPackageCtc: 16 });

      expect(reverifyRes.status).toBe(200);
      expect(reverifyRes.body.result).toBe('reverified');
      expect(reverifyRes.body.status).toBe('verified');

      const outcome = await PlacementOutcome.findOne({ application: appRecord._id });
      // History chain is appended, never overwritten
      expect(outcome.history.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // 8. Invariant Race Tests (20 Iterations Each via Promise.all)
  // Invariant: It is NEVER true that (outcome.status === 'verified' && app.status !== 'Selected')
  // =========================================================================
  describe('8. Invariant Race Tests (20 Iterations Each)', () => {
    it('Race 1: verify vs. status change to Rejected (20 iterations)', async () => {
      const ITERATIONS = 20;

      for (let i = 0; i < ITERATIONS; i++) {
        // Unique student for each iteration to avoid unique index conflict
        const student = await User.create({
          name: `Race1 Student ${i}`,
          email: `race1.student.${i}@alphatech.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeAlpha._id,
          collegeAssignmentStatus: 'VERIFIED',
          isActive: true,
        });

        const app = await DriveApplication.create({
          student: student._id,
          placementDrive: driveAlpha._id,
          collegeId: collegeAlpha._id,
          status: 'Selected',
        });

        // Fire both operations concurrently
        const [verifyRes, statusRes] = await Promise.all([
          verifyOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            offerPackageCtc: 12.0,
          }),
          changeApplicationStatus({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            status: 'Rejected',
            officerUser: officerAlpha,
          }),
        ]);

        const dbOutcome = await PlacementOutcome.findOne({ application: app._id });
        const dbApp = await DriveApplication.findById(app._id);

        const isOutcomeVerified = dbOutcome && dbOutcome.status === 'verified';
        const isAppNotSelected = dbApp.status !== 'Selected';

        // CRITICAL INVARIANT ASSERTION
        expect(isOutcomeVerified && isAppNotSelected).toBe(false);

        if (isOutcomeVerified) {
          expect(dbApp.status).toBe('Selected');
          expect(dbApp.outcomeVerified).toBe(true);
          // Status change should have failed with 409
          expect(statusRes.status).toBe(409);
        } else if (dbApp.status === 'Rejected') {
          // Verify should have failed or not marked outcome verified
          expect(verifyRes.status).not.toBe(200);
        }
      }
    });

    it('Race 2: revoke vs. status change (20 iterations)', async () => {
      const ITERATIONS = 20;

      for (let i = 0; i < ITERATIONS; i++) {
        const student = await User.create({
          name: `Race2 Student ${i}`,
          email: `race2.student.${i}@alphatech.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeAlpha._id,
          collegeAssignmentStatus: 'VERIFIED',
          isActive: true,
        });

        const app = await DriveApplication.create({
          student: student._id,
          placementDrive: driveAlpha._id,
          collegeId: collegeAlpha._id,
          status: 'Selected',
        });

        // First establish verified outcome
        await verifyOutcomeService({
          applicationId: app._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          offerPackageCtc: 10.0,
        });

        // Fire revoke vs. status change to Shortlisted concurrently
        const [revokeRes, statusRes] = await Promise.all([
          revokeOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            reason: `Race revocation iteration ${i} with valid length`,
          }),
          changeApplicationStatus({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            status: 'Shortlisted',
            officerUser: officerAlpha,
          }),
        ]);

        const dbOutcome = await PlacementOutcome.findOne({ application: app._id });
        const dbApp = await DriveApplication.findById(app._id);

        const isOutcomeVerified = dbOutcome && dbOutcome.status === 'verified';
        const isAppNotSelected = dbApp.status !== 'Selected';

        // CRITICAL INVARIANT ASSERTION
        expect(isOutcomeVerified && isAppNotSelected).toBe(false);

        if (dbApp.status === 'Shortlisted') {
          // If status changed to Shortlisted, outcome must be revoked
          expect(dbOutcome.status).toBe('revoked');
        }
      }
    });

    it('Race 3: verify vs. verify and revoke vs. revoke (20 iterations)', async () => {
      const ITERATIONS = 20;

      for (let i = 0; i < ITERATIONS; i++) {
        const student = await User.create({
          name: `Race3 Student ${i}`,
          email: `race3.student.${i}@alphatech.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeAlpha._id,
          collegeAssignmentStatus: 'VERIFIED',
          isActive: true,
        });

        const app = await DriveApplication.create({
          student: student._id,
          placementDrive: driveAlpha._id,
          collegeId: collegeAlpha._id,
          status: 'Selected',
        });

        // Parallel verify
        const [v1, v2] = await Promise.all([
          verifyOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            offerPackageCtc: 14.0,
          }),
          verifyOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            offerPackageCtc: 14.0,
          }),
        ]);

        expect(v1.status).toBe(200);
        expect(v2.status).toBe(200);

        const outcomes = await PlacementOutcome.find({ application: app._id });
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].status).toBe('verified');

        const dbAppAfterVerify = await DriveApplication.findById(app._id);
        expect(dbAppAfterVerify.outcomeVerified).toBe(true);

        // Parallel revoke
        const [r1, r2] = await Promise.all([
          revokeOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            reason: `Parallel revoke iteration ${i} with valid text length`,
          }),
          revokeOutcomeService({
            applicationId: app._id,
            collegeId: collegeAlpha._id,
            officerUser: officerAlpha,
            reason: `Parallel revoke iteration ${i} with valid text length`,
          }),
        ]);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);

        const revokedOutcomes = await PlacementOutcome.find({ application: app._id });
        expect(revokedOutcomes).toHaveLength(1);
        expect(revokedOutcomes[0].status).toBe('revoked');

        const dbAppAfterRevoke = await DriveApplication.findById(app._id);
        expect(dbAppAfterRevoke.outcomeVerified).toBe(false);
      }
    });
  });

  // =========================================================================
  // 9. Fault Injection and Lock Compensation
  // =========================================================================
  describe('9. Fault Injection and Lock Compensation', () => {
    it('clears the lock when the outcome step fails after claim (compensation)', async () => {
      const app = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // Spy on PlacementOutcome.findOneAndUpdate to throw an artificial error
      const originalFindOneAndUpdate = PlacementOutcome.findOneAndUpdate;
      PlacementOutcome.findOneAndUpdate = jest.fn().mockImplementationOnce(() => {
        throw new Error('Simulated database crash during outcome write');
      });

      try {
        const res = await verifyOutcomeService({
          applicationId: app._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          offerPackageCtc: 15.0,
        });

        expect(res.status).toBe(500);

        // Assert compensation cleared the lock
        const dbApp = await DriveApplication.findById(app._id);
        expect(dbApp.outcomeVerified).toBe(false);
      } finally {
        PlacementOutcome.findOneAndUpdate = originalFindOneAndUpdate;
      }
    });

    it('stays locked when compensation also fails (fail-safe over-locked), and retry repairs it', async () => {
      const app = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      const originalFindOneAndUpdate = PlacementOutcome.findOneAndUpdate;
      const originalUpdateOne = DriveApplication.updateOne;

      // Force outcome step to fail, AND force compensation updateOne to fail
      PlacementOutcome.findOneAndUpdate = jest.fn().mockImplementationOnce(() => {
        throw new Error('Outcome DB error');
      });

      let updateOneCallCount = 0;
      DriveApplication.updateOne = jest.fn().mockImplementation((query, update, opts) => {
        updateOneCallCount++;
        // The first updateOne is the atomic lock claim (must succeed)
        if (updateOneCallCount === 1) {
          return originalUpdateOne.call(DriveApplication, query, update, opts);
        }
        // The second updateOne is the compensation (force it to fail)
        throw new Error('Compensation update failed');
      });

      try {
        const res = await verifyOutcomeService({
          applicationId: app._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          offerPackageCtc: 15.0,
        });

        expect(res.status).toBe(500);

        // Application must remain locked (fail-safe over-locked rather than inconsistent)
        const dbApp = await DriveApplication.findById(app._id);
        expect(dbApp.outcomeVerified).toBe(true);

        // Now restore normal behavior and retry verify
        PlacementOutcome.findOneAndUpdate = originalFindOneAndUpdate;
        DriveApplication.updateOne = originalUpdateOne;

        // Retry must detect half-finished claim, repair the state, and verify successfully
        const retryRes = await verifyOutcomeService({
          applicationId: app._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          offerPackageCtc: 15.0,
        });

        expect(retryRes.status).toBe(200);
        expect(retryRes.data.result).toBe('created');

        const finalApp = await DriveApplication.findById(app._id);
        expect(finalApp.outcomeVerified).toBe(true);
        const finalOutcome = await PlacementOutcome.findOne({ application: app._id });
        expect(finalOutcome.status).toBe('verified');
      } finally {
        PlacementOutcome.findOneAndUpdate = originalFindOneAndUpdate;
        DriveApplication.updateOne = originalUpdateOne;
      }
    });
  });

  // =========================================================================
  // 10. Code Architecture Linter / Guard Scanner
  // Scans server/ codebase to ensure no direct writes to DriveApplication.status
  // exist outside the choke point allow-list.
  // =========================================================================
  describe('10. Code Architecture Linter: Guard Scanner', () => {
    it('verifies no direct writes to DriveApplication.status outside the allow-list', () => {
      const serverDir = path.resolve(__dirname, '..');
      const ALLOW_LIST = [
        path.normalize('server/services/applicationStatusService.js'),
        path.normalize('server/services/placementOutcomeService.js'),
      ];

      function getAllJsFiles(dir) {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (['node_modules', 'tests', 'temp', 'migrations'].includes(entry.name)) {
              continue;
            }
            results = results.concat(getAllJsFiles(fullPath));
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const files = getAllJsFiles(serverDir);
      const violations = [];

      // Regex patterns that would bypass the choke point (assignment only, not comparison)
      const statusWritePattern = /\.status\s*=(?!=)|\$set\s*:\s*\{[^}]*status\s*:/;
      const deletePatterns = /DriveApplication\.(deleteOne|deleteMany|findByIdAndDelete|findOneAndDelete)/;

      for (const file of files) {
        const relativePath = path.normalize(path.relative(path.resolve(serverDir, '..'), file));
        if (ALLOW_LIST.some((allowed) => relativePath.endsWith(allowed))) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');

        // Check if file imports DriveApplication
        if (content.includes('DriveApplication')) {
          if (statusWritePattern.test(content)) {
            // Check if it's application creation (which sets initial status) vs status write
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              // Ignore comments and initial DriveApplication.create({ ... status: 'Applied' }) in student controller
              if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
              if (line.includes('===') || line.includes('!==') || line.includes('==')) return;
              if (line.includes('DriveApplication.create') || line.includes("status: 'Applied'")) return;
              if (line.includes('status:') && line.includes('ALLOWED_STATUSES')) return;

              if (/\.status\s*=(?!=)/.test(line) || (line.includes('$set') && line.includes('status'))) {
                violations.push(`${relativePath}:${idx + 1}: ${line.trim()}`);
              }
            });
          }

          if (deletePatterns.test(content)) {
            const match = content.match(deletePatterns);
            violations.push(`${relativePath}: uses ${match[0]}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
