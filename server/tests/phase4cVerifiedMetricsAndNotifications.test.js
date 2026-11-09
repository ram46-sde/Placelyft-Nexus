const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const PlacementOutcome = require('../models/PlacementOutcome');
const Notification = require('../models/Notification');
const { getPlacementMetricsService } = require('../services/placementMetricsService');
const { getStudentOutcomesService } = require('../services/studentOutcomesService');
const { dispatchOutcomeVerifiedNotification, verifyOutcomeService, revokeOutcomeService } = require('../services/placementOutcomeService');

describe('CPMS Phase 4C: Verified Placement Metrics and OUTCOME_VERIFIED Notifications', () => {
  jest.setTimeout(30000);

  let collegeAlpha, collegeBeta, collegeEmpty;
  let officerAlpha, officerBeta;
  let tokenOfficerAlpha, tokenOfficerBeta;
  let student1, student2, student3, studentBeta;
  let tokenStudent1, tokenStudent2, tokenStudentBeta;
  let companyAlpha, companyBeta;
  let driveAlpha1, driveAlpha2, driveAlpha3, driveBeta;

  const createAuthToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role, collegeId: user.collegeId },
      process.env.JWT_SECRET || 'phase4c_jwt_secret_at_least_32_chars_long!',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'phase4c_jwt_secret_at_least_32_chars_long!';
    await connectTestDb();
    await Notification.createIndexes();
    await PlacementOutcome.createIndexes();
    await DriveApplication.createIndexes();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    jest.restoreAllMocks();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Technology',
      contactEmail: 'admin@alpha.edu',
      address: '100 Alpha Road',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta State University',
      contactEmail: 'admin@beta.edu',
      address: '200 Beta Way',
      isActive: true,
    });

    collegeEmpty = await College.create({
      name: 'Empty College of Arts',
      contactEmail: 'admin@empty.edu',
      address: '300 Empty Lane',
      isActive: true,
    });

    // 2. Officers
    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenOfficerAlpha = createAuthToken(officerAlpha);

    officerBeta = await User.create({
      name: 'Officer Beta',
      email: 'officer@beta.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenOfficerBeta = createAuthToken(officerBeta);

    // 3. Students
    student1 = await User.create({
      name: 'Student One',
      email: 'student1@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudent1 = createAuthToken(student1);

    student2 = await User.create({
      name: 'Student Two',
      email: 'student2@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudent2 = createAuthToken(student2);

    student3 = await User.create({
      name: 'Student Three',
      email: 'student3@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentBeta = await User.create({
      name: 'Student Beta',
      email: 'student@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudentBeta = createAuthToken(studentBeta);

    // Student Profiles
    await StudentProfile.create({ user: student1._id, collegeId: collegeAlpha._id, batch: '2026' });
    await StudentProfile.create({ user: student2._id, collegeId: collegeAlpha._id, batch: '2026' });
    await StudentProfile.create({ user: student3._id, collegeId: collegeAlpha._id, batch: '2025' });
    await StudentProfile.create({ user: studentBeta._id, collegeId: collegeBeta._id, batch: '2026' });

    // 4. Companies & Placement Drives
    companyAlpha = await Company.create({ name: 'Alpha Solutions', industry: 'IT' });
    companyBeta = await Company.create({ name: 'Beta Titan Corp', industry: 'Fintech' });

    driveAlpha1 = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Backend engineer role with NodeJS and MongoDB',
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      isActive: true,
    });

    driveAlpha2 = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Full Stack Engineer',
      jobDescription: 'Full stack development role',
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      isActive: true,
    });

    driveAlpha3 = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'DevOps Engineer',
      jobDescription: 'Cloud infrastructure role',
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      isActive: true,
    });

    driveBeta = await PlacementDrive.create({
      company: companyBeta._id,
      collegeId: collegeBeta._id,
      jobRole: 'Principal Architect',
      jobDescription: 'Lead architect position at Beta Corp',
      packageDetails: '100 LPA',
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      isActive: true,
    });
  });

  // =========================================================================
  // SUITE 1: METRICS SERVICE & INDEPENDENT ORACLE VALIDATION
  // =========================================================================
  describe('1. Metrics Service Against Independent Plain JS Oracle', () => {
    it('returns zeros and null for an empty college', async () => {
      const res = await getPlacementMetricsService({ collegeId: collegeEmpty._id });
      expect(res).toEqual({
        verifiedSelections: 0,
        verifiedOffers: 0,
        highestPackage: null,
        needsVerification: 0,
      });

      // Also verify via GET /api/officer/metrics
      const emptyOfficer = await User.create({
        name: 'Empty Officer',
        email: 'officer@empty.edu',
        password: 'password123',
        role: 'placement_officer',
        collegeId: collegeEmpty._id,
        collegeAssignmentStatus: 'VERIFIED',
      });
      const emptyToken = createAuthToken(emptyOfficer);

      const httpRes = await request(app)
        .get('/api/officer/metrics')
        .set('Authorization', `Bearer ${emptyToken}`);

      expect(httpRes.status).toBe(200);
      expect(httpRes.body.verifiedSelections).toBe(0);
      expect(httpRes.body.verifiedOffers).toBe(0);
      expect(httpRes.body.highestPackage).toBeNull();
      expect(httpRes.body.needsVerification).toBe(0);
    });

    it('computes metrics strictly matching independent oracle: 1 student with 3 verified offers = 1 selection and 3 offers', async () => {
      // Setup: student1 gets 3 Selected applications on 3 distinct drives
      const app1 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha1._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      const app2 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha2._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      const app3 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha3._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });

      // Create 3 verified outcomes with CTCs: 12, 18.5, and null (missing)
      const outcomesFixture = [
        { application: app1._id, student: student1._id, drive: driveAlpha1._id, status: 'verified', ctc: 12 },
        { application: app2._id, student: student1._id, drive: driveAlpha2._id, status: 'verified', ctc: 18.5 },
        { application: app3._id, student: student1._id, drive: driveAlpha3._id, status: 'verified', ctc: null },
      ];

      for (const f of outcomesFixture) {
        await PlacementOutcome.create({
          collegeId: collegeAlpha._id,
          placementDrive: f.drive,
          application: f.application,
          student: f.student,
          status: f.status,
          departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
          offerPackage: { ctc: f.ctc, unit: 'LPA', currency: 'INR' },
          verifiedBy: officerAlpha._id,
          verifiedAt: new Date(),
          history: [{ action: 'verified', oldStatus: null, newStatus: 'verified', changedBy: officerAlpha._id, changedAt: new Date(), ctc: f.ctc }],
        });
      }

      // Independent plain JS oracle computation
      const oracleVerifiedOutcomes = outcomesFixture.filter((o) => o.status === 'verified');
      const oracleOffers = oracleVerifiedOutcomes.length;
      const oracleSelections = new Set(oracleVerifiedOutcomes.map((o) => o.student.toString())).size;
      const validCtcs = oracleVerifiedOutcomes.map((o) => o.ctc).filter((c) => typeof c === 'number' && c > 0);
      const oracleMaxCtc = validCtcs.length > 0 ? Math.max(...validCtcs) : null;
      const oracleHighestPackage = oracleMaxCtc !== null ? { ctc: oracleMaxCtc, unit: 'LPA' } : null;

      const metrics = await getPlacementMetricsService({ collegeId: collegeAlpha._id });
      expect(metrics.verifiedSelections).toBe(oracleSelections); // 1 distinct student
      expect(metrics.verifiedOffers).toBe(oracleOffers);         // 3 offers
      expect(metrics.highestPackage).toEqual(oracleHighestPackage); // { ctc: 18.5, unit: 'LPA' }
      expect(metrics.needsVerification).toBe(0);
    });

    it('excludes revoked outcomes and unverified Selected applications from verified counts, and counts them in Needs Verification', async () => {
      // 1. Student1: verified outcome with CTC 15
      const app1 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha1._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha1._id,
        application: app1._id,
        student: student1._id,
        status: 'verified',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: 15, unit: 'LPA', currency: 'INR' },
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
      });

      // 2. Student2: Revoked outcome with high CTC 40 (must NOT be counted in verified or highestPackage, but appears in Needs Verification)
      const app2 = await DriveApplication.create({ student: student2._id, placementDrive: driveAlpha2._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: false });
      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha2._id,
        application: app2._id,
        student: student2._id,
        status: 'revoked',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: null, unit: 'LPA', currency: 'INR' },
        history: [{ action: 'revoked', oldStatus: 'verified', newStatus: 'revoked', changedBy: officerAlpha._id, changedAt: new Date(), reason: 'Offer rescinded' }],
      });

      // 3. Student3: Legacy Selected application (no outcome record, no outcomeVerified flag)
      await DriveApplication.create({
        student: student3._id,
        placementDrive: driveAlpha3._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // 4. Non-selected applications (Applied, Shortlisted, Rejected) - must NOT be in Needs Verification
      await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha2._id, collegeId: collegeAlpha._id, status: 'Shortlisted' });
      await DriveApplication.create({ student: student2._id, placementDrive: driveAlpha1._id, collegeId: collegeAlpha._id, status: 'Rejected' });

      // Run Metrics
      const metrics = await getPlacementMetricsService({ collegeId: collegeAlpha._id });

      // Assertions
      expect(metrics.verifiedSelections).toBe(1); // Only Student1
      expect(metrics.verifiedOffers).toBe(1);     // Only App1
      expect(metrics.highestPackage).toEqual({ ctc: 15, unit: 'LPA' }); // Ignores revoked 40
      expect(metrics.needsVerification).toBe(2);  // App2 (revoked) + App3 (legacy Selected without outcome)
    });

    it('cross-tenant isolation: another college with a higher CTC and more outcomes never affects this college', async () => {
      // College Alpha: 1 verified outcome of 10 LPA
      const appAlpha = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha1._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha1._id,
        application: appAlpha._id,
        student: student1._id,
        status: 'verified',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: 10, unit: 'LPA', currency: 'INR' },
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
      });

      // College Beta: 10 verified outcomes with astronomical CTC 95 LPA
      for (let i = 0; i < 5; i++) {
        const dummyUser = await User.create({ name: `Beta St ${i}`, email: `betast${i}@beta.edu`, password: 'password123', role: 'student', collegeId: collegeBeta._id });
        const appB = await DriveApplication.create({ student: dummyUser._id, placementDrive: driveBeta._id, collegeId: collegeBeta._id, status: 'Selected', outcomeVerified: true });
        await PlacementOutcome.create({
          collegeId: collegeBeta._id,
          placementDrive: driveBeta._id,
          application: appB._id,
          student: dummyUser._id,
          status: 'verified',
          departmentSnapshot: { departmentName: 'IT', resolutionStatus: 'resolved' },
          offerPackage: { ctc: 95, unit: 'LPA', currency: 'INR' },
          verifiedBy: officerBeta._id,
          verifiedAt: new Date(),
        });
      }

      // Query College Alpha via HTTP
      const resAlpha = await request(app)
        .get('/api/officer/metrics')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(resAlpha.status).toBe(200);
      expect(resAlpha.body.verifiedSelections).toBe(1);
      expect(resAlpha.body.verifiedOffers).toBe(1);
      expect(resAlpha.body.highestPackage).toEqual({ ctc: 10, unit: 'LPA' });
      expect(resAlpha.body.needsVerification).toBe(0);

      // Query College Beta via HTTP
      const resBeta = await request(app)
        .get('/api/officer/metrics')
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);

      expect(resBeta.status).toBe(200);
      expect(resBeta.body.verifiedSelections).toBe(5);
      expect(resBeta.body.verifiedOffers).toBe(5);
      expect(resBeta.body.highestPackage).toEqual({ ctc: 95, unit: 'LPA' });
    });
  });

  // =========================================================================
  // SUITE 2: STUDENT OUTCOMES WHITELIST & REASON/OFFICER DATA ISOLATION
  // =========================================================================
  describe('2. Student Outcomes Whitelist & Data Isolation', () => {
    it('returns only the authenticated student records and whitelisted fields', async () => {
      // Student1 has 1 verified outcome and 1 revoked outcome (which should appear in pendingSelections)
      const app1 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha1._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      const app2 = await DriveApplication.create({ student: student1._id, placementDrive: driveAlpha2._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: false });

      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha1._id,
        application: app1._id,
        student: student1._id,
        status: 'verified',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: 14.5, unit: 'LPA', currency: 'INR' },
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date('2026-10-01T10:00:00Z'),
      });

      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha2._id,
        application: app2._id,
        student: student1._id,
        status: 'revoked',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: null, unit: 'LPA', currency: 'INR' },
        verifiedBy: officerAlpha._id,
        history: [{ action: 'revoked', oldStatus: 'verified', newStatus: 'revoked', changedBy: officerAlpha._id, changedAt: new Date(), reason: 'Super secret confidential revocation reason.' }],
      });

      // Student2 (different student) has a verified outcome
      const appStudent2 = await DriveApplication.create({ student: student2._id, placementDrive: driveAlpha3._id, collegeId: collegeAlpha._id, status: 'Selected', outcomeVerified: true });
      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha3._id,
        application: appStudent2._id,
        student: student2._id,
        status: 'verified',
        departmentSnapshot: { departmentName: 'CSE', resolutionStatus: 'resolved' },
        offerPackage: { ctc: 25, unit: 'LPA', currency: 'INR' },
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
      });

      // HTTP call by student1
      const res = await request(app)
        .get('/api/student/dashboard/outcomes')
        .set('Authorization', `Bearer ${tokenStudent1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 1. Verified outcomes: only 1 (app1), contains company, role, verifiedAt, ctc
      expect(res.body.verifiedOutcomes).toHaveLength(1);
      const v = res.body.verifiedOutcomes[0];
      expect(v.company).toBe('Alpha Solutions');
      expect(v.role).toBe('Software Engineer');
      expect(v.verifiedAt).toBe('2026-10-01T10:00:00.000Z');
      expect(v.ctc).toBe(14.5);

      // Assert forbidden keys do NOT exist anywhere in verifiedOutcomes
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('Super secret confidential revocation reason');
      expect(serialized).not.toContain('officer');
      expect(serialized).not.toContain('Officer Alpha');
      expect(serialized).not.toContain('history');
      expect(serialized).not.toContain('Student Two');
      expect(serialized).not.toContain('student2@alpha.edu');

      // 2. Pending selections: revoked app2 appears as pending selection, never as verified
      expect(res.body.pendingSelections).toHaveLength(1);
      const p = res.body.pendingSelections[0];
      expect(p.applicationId).toBe(app2._id.toString());
      expect(p.company).toBe('Alpha Solutions');
      expect(p.role).toBe('Full Stack Engineer');

      // Also assert that student dashboard summary includes both additively
      const summaryRes = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${tokenStudent1}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.verifiedOutcomes).toHaveLength(1);
      expect(summaryRes.body.pendingSelections).toHaveLength(1);
      expect(summaryRes.body.selectedApplications).toBe(2);
    });

    it('cross-tenant: student from College Beta receives 0 records from College Alpha', async () => {
      const res = await request(app)
        .get('/api/student/dashboard/outcomes')
        .set('Authorization', `Bearer ${tokenStudentBeta}`);

      expect(res.status).toBe(200);
      expect(res.body.verifiedOutcomes).toEqual([]);
      expect(res.body.pendingSelections).toEqual([]);
    });
  });

  // =========================================================================
  // SUITE 3: OUTCOME_VERIFIED NOTIFICATIONS, DEDUPLICATION & FAILURE ISOLATION
  // =========================================================================
  describe('3. OUTCOME_VERIFIED Notifications & Idempotency', () => {
    it('first verify creates one notification; repeat verify creates none', async () => {
      const appAlpha = await DriveApplication.create({
        student: student1._id,
        placementDrive: driveAlpha1._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // First verify
      const verify1 = await verifyOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 12,
      });

      expect(verify1.status).toBe(200);
      expect(verify1.data.result).toBe('created');
      expect(verify1.data.notificationCreated).toBe(true);

      const notifs1 = await Notification.find({ recipient: student1._id });
      expect(notifs1).toHaveLength(1);
      const notifDoc = notifs1[0];
      expect(notifDoc.type).toBe('OUTCOME_VERIFIED');
      expect(notifDoc.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(notifDoc.recipient.toString()).toBe(student1._id.toString());
      expect(notifDoc.eventKey).toMatch(/^outcome_verified:/);
      expect(notifDoc.message).toContain('Alpha Solutions (Software Engineer) was verified on');
      // Must not contain CTC, officer name, or revocation data
      expect(notifDoc.message).not.toContain('12');
      expect(notifDoc.message).not.toContain('Officer');

      // Second verify (idempotent repeat verify)
      const verify2 = await verifyOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 12,
      });

      expect(verify2.status).toBe(200);
      expect(verify2.data.result).toBe('already_verified');
      expect(verify2.data.notificationCreated).toBe(false);

      const notifs2 = await Notification.find({ recipient: student1._id });
      expect(notifs2).toHaveLength(1); // No duplicate notification created
    });

    it('revoke creates NO notification, and verify -> revoke -> verify creates two distinct notifications', async () => {
      const appAlpha = await DriveApplication.create({
        student: student1._id,
        placementDrive: driveAlpha1._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // 1. Verify 1
      const v1 = await verifyOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 10,
      });
      expect(v1.status).toBe(200);
      expect(v1.data.result).toBe('created');

      expect(await Notification.countDocuments({ recipient: student1._id })).toBe(1);

      // 2. Revoke
      const r = await revokeOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        reason: 'Revocation for contract change verification',
      });
      expect(r.status).toBe(200);
      expect(r.data.result).toBe('revoked');

      // Count must still be 1 (Revoke creates zero notifications)
      expect(await Notification.countDocuments({ recipient: student1._id })).toBe(1);

      // 3. Verify 2 (reverify)
      const v2 = await verifyOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 14,
      });
      expect(v2.status).toBe(200);
      expect(v2.data.result).toBe('reverified');
      expect(v2.data.notificationCreated).toBe(true);

      const notifs = await Notification.find({ recipient: student1._id }).sort({ createdAt: 1 });
      expect(notifs).toHaveLength(2);
      expect(notifs[0].eventKey).not.toBe(notifs[1].eventKey); // Distinct eventKeys
      expect(notifs[0].type).toBe('OUTCOME_VERIFIED');
      expect(notifs[1].type).toBe('OUTCOME_VERIFIED');

      // Verify neither verify nor revoke ever emitted STATUS_UPDATE
      const statusUpdates = await Notification.countDocuments({ type: 'STATUS_UPDATE' });
      expect(statusUpdates).toBe(0);
    });

    it('10 parallel verify requests produce exactly 1 notification', async () => {
      const appParallel = await DriveApplication.create({
        student: student2._id,
        placementDrive: driveAlpha2._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      const promises = Array.from({ length: 10 }).map(() =>
        verifyOutcomeService({
          applicationId: appParallel._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          ctc: 20,
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.status === 200);
      expect(successful.length).toBe(10);

      // Exactly 1 outcome created in DB
      const outcomeCount = await PlacementOutcome.countDocuments({ application: appParallel._id });
      expect(outcomeCount).toBe(1);

      // Exactly 1 notification created in DB
      const notifCount = await Notification.countDocuments({ recipient: student2._id, type: 'OUTCOME_VERIFIED' });
      expect(notifCount).toBe(1);
    });

    it('calling dispatchOutcomeVerifiedNotification twice with the same event creates one, and duplicate-key is not logged as failure', async () => {
      const outcomeId = new mongoose.Types.ObjectId();
      const eventId = new mongoose.Types.ObjectId();
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const params = {
        outcomeId,
        eventId,
        studentId: student1._id,
        collegeId: collegeAlpha._id,
        placementDriveId: driveAlpha1._id,
        applicationId: new mongoose.Types.ObjectId(),
        verifiedAt: new Date(),
      };

      // Call 1
      const res1 = await dispatchOutcomeVerifiedNotification(params);
      expect(res1.success).toBe(true);
      expect(res1.notificationCreated).toBe(true);

      // Call 2 with identical eventId
      const res2 = await dispatchOutcomeVerifiedNotification(params);
      expect(res2.success).toBe(true);
      expect(res2.notificationCreated).toBe(true);
      expect(res2.duplicate).toBe(true);

      // Verify no failure was logged
      expect(spyError).not.toHaveBeenCalled();

      // Only 1 document in DB
      const count = await Notification.countDocuments({ eventKey: `outcome_verified:${outcomeId}:${eventId}` });
      expect(count).toBe(1);

      spyError.mockRestore();
    });

    it('forced notification failure leaves the outcome verified and logs [Notification Dispatch Failure] without throwing', async () => {
      const appAlpha = await DriveApplication.create({
        student: student3._id,
        placementDrive: driveAlpha3._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const spyNotifCreate = jest.spyOn(Notification, 'create').mockRejectedValueOnce(
        new Error('Simulated notification database connection drop')
      );

      const res = await verifyOutcomeService({
        applicationId: appAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 16,
      });

      // Must succeed with status 200 and outcome verified
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('verified');
      expect(res.data.result).toBe('created');
      expect(res.data.notificationCreated).toBe(false);

      // Verify outcome exists in DB
      const dbOutcome = await PlacementOutcome.findOne({ application: appAlpha._id });
      expect(dbOutcome).not.toBeNull();
      expect(dbOutcome.status).toBe('verified');

      // Verify failure was logged with sanitized metadata only
      expect(spyError).toHaveBeenCalled();
      const lastErrorCall = spyError.mock.calls.find((call) => call[0] === '[Notification Dispatch Failure]:');
      expect(lastErrorCall).toBeDefined();
      const loggedMeta = lastErrorCall[1];
      expect(loggedMeta.outcomeId).toBe(dbOutcome._id.toString());
      expect(loggedMeta.collegeId).toBe(collegeAlpha._id.toString());
      expect(loggedMeta.type).toBe('OUTCOME_VERIFIED');
      expect(loggedMeta.errorMessage).toContain('Simulated notification database connection drop');
      // No PII or tokens
      expect(JSON.stringify(loggedMeta)).not.toContain('student3@alpha.edu');

      spyError.mockRestore();
      spyNotifCreate.mockRestore();
    });

    it('recipient and collegeId come strictly from the outcome/application database records, never client input', async () => {
      const appAlpha = await DriveApplication.create({
        student: student1._id,
        placementDrive: driveAlpha1._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // Malicious payload attempting to redirect notification to studentBeta and collegeBeta
      const maliciousPayload = {
        ctc: 15,
        recipient: studentBeta._id.toString(),
        collegeId: collegeBeta._id.toString(),
        student: studentBeta._id.toString(),
      };

      const res = await request(app)
        .post(`/api/officer/outcomes/${appAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send(maliciousPayload);

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({ application: appAlpha._id });
      expect(notif).not.toBeNull();
      expect(notif.recipient.toString()).toBe(student1._id.toString()); // Intact student1
      expect(notif.collegeId.toString()).toBe(collegeAlpha._id.toString()); // Intact collegeAlpha
      expect(notif.recipient.toString()).not.toBe(studentBeta._id.toString());
    });
  });

  // =========================================================================
  // SUITE 4: NOTIFICATIONS API ENDPOINTS, UNREAD COUNTS & MARK-AS-READ
  // =========================================================================
  describe('4. Notification API Unread Count and Mark-as-read', () => {
    it('GET /api/student/notifications returns unreadCount and marks read correctly', async () => {
      // Create 2 notifications for student1 (1 read, 1 unread)
      await Notification.create({
        recipient: student1._id,
        collegeId: collegeAlpha._id,
        title: 'Status Update',
        message: 'Your status is Selected',
        type: 'STATUS_UPDATE',
        isRead: true,
      });

      const unreadNotif = await Notification.create({
        recipient: student1._id,
        collegeId: collegeAlpha._id,
        title: 'Outcome Verified',
        message: 'Your outcome was verified',
        type: 'OUTCOME_VERIFIED',
        isRead: false,
      });

      // 1. Fetch notifications
      const getRes = await request(app)
        .get('/api/student/notifications')
        .set('Authorization', `Bearer ${tokenStudent1}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.count).toBe(2);
      expect(getRes.body.unreadCount).toBe(1);

      // 2. Mark single as read
      const markRes = await request(app)
        .patch(`/api/student/notifications/${unreadNotif._id}/read`)
        .set('Authorization', `Bearer ${tokenStudent1}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.notification.isRead).toBe(true);

      // 3. Verify unread count is now 0
      const getRes2 = await request(app)
        .get('/api/student/notifications')
        .set('Authorization', `Bearer ${tokenStudent1}`);

      expect(getRes2.body.unreadCount).toBe(0);
    });
  });
});
