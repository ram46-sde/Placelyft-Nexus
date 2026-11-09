const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Department = require('../models/Department');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const DriveAttendance = require('../models/DriveAttendance');
const PlacementOutcome = require('../models/PlacementOutcome');
const Notification = require('../models/Notification');
const Company = require('../models/Company');
const { validateOfferPackageCtc } = require('../services/placementOutcomeService');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('CPMS Phase 4A: Placement Outcome Backend Foundation Tests', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, unverifiedOfficer, studentAlpha, studentBeta, studentGamma, studentDelta, studentUnresolved, recruiterUser;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenUnverifiedOfficer, tokenStudentAlpha, tokenRecruiter;
  let deptCseAlpha, deptEceAlpha;
  let companyAlpha;
  let driveAlpha, driveBeta, archivedDriveAlpha;
  let selectedAppAlpha, appliedAppAlpha, shortlistedAppAlpha, rejectedAppAlpha;
  let selectedAppArchived, selectedAppBeta, unresolvedAppAlpha;

  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'outcomes_test_secret_32_chars_long!';
    await connectTestDb();
    // Build indexes in isolated test database
    await PlacementOutcome.createIndexes();
    await DriveAttendance.createIndexes();
    await Department.createIndexes();
    await DriveApplication.createIndexes();
    await PlacementDrive.createIndexes();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({ name: 'Alpha Institute of Tech', isActive: true });
    collegeBeta = await College.create({ name: 'Beta State College', isActive: true });

    // 2. Users
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
      name: 'Alice Smith',
      email: 'alice@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentBeta = await User.create({
      name: 'Bob Jones',
      email: 'bob@betacollege.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentUnresolved = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentGamma = await User.create({
      name: 'David Lee',
      email: 'david@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentDelta = await User.create({
      name: 'Emma Watson',
      email: 'emma@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    recruiterUser = await User.create({
      name: 'Recruiter Bob',
      email: 'recruiter@techcorp.com',
      password: 'password123',
      role: 'recruiter',
      isActive: true,
    });

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);
    tokenUnverifiedOfficer = generateToken(unverifiedOfficer);
    tokenStudentAlpha = generateToken(studentAlpha);
    tokenRecruiter = generateToken(recruiterUser);

    // 3. Departments in College Alpha
    deptCseAlpha = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      collegeId: collegeAlpha._id,
      isActive: true,
      aliases: ['Computer Science', 'CS'],
    });

    deptEceAlpha = await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      collegeId: collegeAlpha._id,
      isActive: true,
      aliases: ['Electronics', 'EC'],
    });

    // 4. Student Profiles
    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-001',
      department: 'Computer Science',
      departmentId: deptCseAlpha._id,
    });

    await StudentProfile.create({
      user: studentBeta._id,
      collegeId: collegeBeta._id,
      rollNumber: 'BETA-001',
      department: 'Mechanical',
    });

    await StudentProfile.create({
      user: studentUnresolved._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-999',
      department: 'Robotics and Nanotechnology', // unmapped department in College Alpha
    });

    await StudentProfile.create({
      user: studentGamma._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-002',
      department: 'Computer Science',
      departmentId: deptCseAlpha._id,
    });

    await StudentProfile.create({
      user: studentDelta._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ECE-001',
      department: 'Electronics',
      departmentId: deptEceAlpha._id,
    });

    // 5. Company & Placement Drives
    companyAlpha = await Company.create({
      name: 'Alpha Corp',
      companyLocation: 'Bangalore',
      website: 'https://alphacorp.com',
      industry: 'Software',
    });

    driveAlpha = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Full stack development role',
      package: 15,
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      eligibleBatch: ['2026'],
      isArchived: false,
    });

    archivedDriveAlpha = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Data Analyst',
      jobDescription: 'Analytics role',
      package: 10,
      driveDate: new Date(Date.now() - 86400000),
      registrationDeadline: new Date(Date.now() - 86400000),
      eligibleBatch: ['2026'],
      isArchived: true,
      isManuallyClosed: true,
    });

    driveBeta = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeBeta._id,
      jobRole: 'Backend Developer',
      jobDescription: 'Backend systems role',
      package: 12,
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      eligibleBatch: ['2026'],
      isArchived: false,
    });

    // 6. Applications (All (student, placementDrive) pairs are strictly unique)
    selectedAppAlpha = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    appliedAppAlpha = await DriveApplication.create({
      student: studentGamma._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    shortlistedAppAlpha = await DriveApplication.create({
      student: studentDelta._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
    });

    rejectedAppAlpha = await DriveApplication.create({
      student: studentGamma._id,
      placementDrive: archivedDriveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Rejected',
    });

    selectedAppArchived = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: archivedDriveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    selectedAppBeta = await DriveApplication.create({
      student: studentBeta._id,
      placementDrive: driveBeta._id,
      collegeId: collegeBeta._id,
      status: 'Selected',
    });

    unresolvedAppAlpha = await DriveApplication.create({
      student: studentUnresolved._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });
  });

  // =========================================================================
  // SUITE 1: VERIFICATION CORE, SELECTION CHECK & ARCHIVED DRIVES
  // =========================================================================
  describe('1. Verify Placement Outcome Core Functionality', () => {
    it('should verify a Selected application and return whitelisted response with result: "created"', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 14.5 });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('created');
      expect(res.body.status).toBe('verified');
      expect(res.body.applicationId).toBe(selectedAppAlpha._id.toString());
      expect(res.body.verifiedBy).toEqual({ name: 'Officer Alpha' });
      expect(res.body.offerPackage).toEqual({
        ctc: 14.5,
        unit: 'LPA',
        currency: 'INR',
      });
      expect(res.body.departmentSnapshot.departmentName).toBe('Computer Science and Engineering');
      expect(res.body.departmentSnapshot.departmentCode).toBe('CSE');
      expect(res.body.departmentSnapshot.resolutionStatus).toBe('resolved_by_id');
      expect(res.body.outcomeId).toBeDefined();

      // Verify in DB
      const dbOutcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbOutcome).not.toBeNull();
      expect(dbOutcome.history.length).toBe(1);
      expect(dbOutcome.history[0].action).toBe('verified');
      expect(dbOutcome.history[0].oldStatus).toBeNull();
      expect(dbOutcome.history[0].newStatus).toBe('verified');
      expect(dbOutcome.history[0].ctc).toBe(14.5);
    });

    it('should reject a non-Selected application (Applied, Shortlisted, Rejected) with 400 APPLICATION_NOT_SELECTED', async () => {
      const appliedRes = await request(app)
        .post(`/api/officer/outcomes/${appliedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 10 });

      expect(appliedRes.status).toBe(400);
      expect(appliedRes.body.code).toBe('APPLICATION_NOT_SELECTED');

      const shortlistedRes = await request(app)
        .post(`/api/officer/outcomes/${shortlistedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 10 });

      expect(shortlistedRes.status).toBe(400);
      expect(shortlistedRes.body.code).toBe('APPLICATION_NOT_SELECTED');

      const rejectedRes = await request(app)
        .post(`/api/officer/outcomes/${rejectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 10 });

      expect(rejectedRes.status).toBe(400);
      expect(rejectedRes.body.code).toBe('APPLICATION_NOT_SELECTED');

      // Assert no outcome document was created
      const count = await PlacementOutcome.countDocuments();
      expect(count).toBe(0);
    });

    it('should allow verification on an archived drive', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppArchived._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 9.75 });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('created');
      expect(res.body.status).toBe('verified');
      expect(res.body.offerPackage.ctc).toBe(9.75);
    });
  });

  // =========================================================================
  // SUITE 2: CTC VALIDATION RULES & NEVER AUTO-FILL FROM DRIVE
  // =========================================================================
  describe('2. CTC Validation Rules', () => {
    it('should accept valid CTC numbers including 0 (e.g. 0, 1, 12.5, 18.75, 200)', async () => {
      expect(validateOfferPackageCtc(0).valid).toBe(true);
      expect(validateOfferPackageCtc(0).parsedCtc).toBe(0);

      const res1 = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 200 });

      expect(res1.status).toBe(200);
      expect(res1.body.offerPackage.ctc).toBe(200);
    });

    it('should store null when CTC is omitted or sent as null (not specified)', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.offerPackage.ctc).toBeNull();

      const dbOutcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbOutcome.offerPackage.ctc).toBeNull();
      expect(dbOutcome.history[0].ctc).toBeNull();
    });

    it('should NEVER auto-fill CTC from the placement drive package when omitted', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: null });

      expect(res.status).toBe(200);
      expect(res.body.offerPackage.ctc).toBeNull();

      const dbOutcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbOutcome.offerPackage.ctc).toBeNull();
      expect(dbOutcome.history[0].ctc).toBeNull();
    });

    it('should reject invalid CTC values: negative, >200, string, NaN, Infinity, and >2 decimals with 400', async () => {
      // Direct unit-level rejection assertions for NaN and Infinity
      expect(validateOfferPackageCtc(NaN).valid).toBe(false);
      expect(validateOfferPackageCtc(Infinity).valid).toBe(false);
      expect(validateOfferPackageCtc(-Infinity).valid).toBe(false);
      expect(validateOfferPackageCtc(-0.01).valid).toBe(false);
      expect(validateOfferPackageCtc(-5).valid).toBe(false);
      expect(validateOfferPackageCtc(200.01).valid).toBe(false);
      expect(validateOfferPackageCtc('12.5').valid).toBe(false);
      expect(validateOfferPackageCtc(12.345).valid).toBe(false);

      // HTTP endpoint rejection tests
      const testCases = [
        { payload: { ctc: -5 }, desc: 'negative' },
        { payload: { ctc: 200.01 }, desc: 'over 200' },
        { payload: { ctc: 250 }, desc: 'greater than 200' },
        { payload: { ctc: '12.5' }, desc: 'string representation' },
        { payload: { ctc: 'NaN' }, desc: 'string NaN' },
        { payload: { ctc: 'Infinity' }, desc: 'string Infinity' },
        { payload: { ctc: 12.345 }, desc: 'more than 2 decimal places' },
      ];

      for (const tc of testCases) {
        const res = await request(app)
          .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send(tc.payload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_CTC');
      }

      const count = await PlacementOutcome.countDocuments();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // SUITE 3: DEPARTMENT RESOLUTION & SNAPSHOTTING
  // =========================================================================
  describe('3. Department Snapshot Resolution', () => {
    it('should record an unresolved or ambiguous student snapshot and still verify', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${unresolvedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 8.5 });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('created');
      expect(res.body.departmentSnapshot.departmentName).toBe('Unassigned / Other');
      expect(res.body.departmentSnapshot.departmentId).toBeNull();
      expect(res.body.departmentSnapshot.resolutionStatus).toBe('unassigned');
    });
  });

  // =========================================================================
  // SUITE 4: STATE MACHINE TRANSITIONS & HISTORY CHAIN INVARIANT
  // =========================================================================
  describe('4. State Machine & Audit History Chain Invariants', () => {
    it('should handle full lifecycle: created -> already_verified -> mismatch (409) -> revoke -> already_revoked -> reverify', async () => {
      // 1. Initial verification -> result: "created"
      const res1 = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      expect(res1.status).toBe(200);
      expect(res1.body.result).toBe('created');
      expect(res1.body.status).toBe('verified');

      // 2. Already verified with same CTC -> result: "already_verified" (no change)
      const res2 = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      expect(res2.status).toBe(200);
      expect(res2.body.result).toBe('already_verified');

      // 3. Already verified with omitted CTC -> result: "already_verified" (no change)
      const res3 = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({});

      expect(res3.status).toBe(200);
      expect(res3.body.result).toBe('already_verified');

      let dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.history.length).toBe(1); // No new history written

      // 4. Mismatch CTC -> 409 OUTCOME_PACKAGE_MISMATCH
      const resMismatch = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 15 });

      expect(resMismatch.status).toBe(409);
      expect(resMismatch.body.code).toBe('OUTCOME_PACKAGE_MISMATCH');

      dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.history.length).toBe(1); // Unchanged

      // 5. Revocation -> result: "revoked"
      const resRevoke = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Student offer was rescinded due to duplicate acceptance elsewhere.' });

      expect(resRevoke.status).toBe(200);
      expect(resRevoke.body.result).toBe('revoked');
      expect(resRevoke.body.status).toBe('revoked');

      dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.status).toBe('revoked');
      expect(dbDoc.history.length).toBe(2);
      expect(dbDoc.history[1].action).toBe('revoked');
      expect(dbDoc.history[1].oldStatus).toBe('verified');
      expect(dbDoc.history[1].newStatus).toBe('revoked');
      expect(dbDoc.history[1].reason).toBe(
        'Student offer was rescinded due to duplicate acceptance elsewhere.'
      );

      // 6. Already revoked -> result: "already_revoked" (no history written, reason ignored)
      const resAlreadyRevoked = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'A completely different reason that should be totally ignored.' });

      expect(resAlreadyRevoked.status).toBe(200);
      expect(resAlreadyRevoked.body.result).toBe('already_revoked');
      expect(resAlreadyRevoked.body.status).toBe('revoked');

      dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.history.length).toBe(2); // strictly no new history

      // 7. Re-verification after revocation -> result: "reverified" with new CTC and fresh snapshot
      const resReverify = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 16.5 });

      expect(resReverify.status).toBe(200);
      expect(resReverify.body.result).toBe('reverified');
      expect(resReverify.body.status).toBe('verified');
      expect(resReverify.body.offerPackage.ctc).toBe(16.5);

      dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.status).toBe('verified');
      expect(dbDoc.offerPackage.ctc).toBe(16.5);
      expect(dbDoc.history.length).toBe(3);
      expect(dbDoc.history[2].action).toBe('reverified');
      expect(dbDoc.history[2].oldStatus).toBe('revoked');
      expect(dbDoc.history[2].newStatus).toBe('verified');
      expect(dbDoc.history[2].ctc).toBe(16.5);

      // Verify History Chain Invariant
      expect(dbDoc.history[0].oldStatus).toBeNull();
      for (let i = 1; i < dbDoc.history.length; i++) {
        expect(dbDoc.history[i].oldStatus).toBe(dbDoc.history[i - 1].newStatus);
      }
    });

    it('should validate revocation reason length (10 to 500 chars) and whitespace trimming', async () => {
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 10 });

      // Reason under 10 chars
      const shortRes = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Short' });
      expect(shortRes.status).toBe(400);
      expect(shortRes.body.code).toBe('INVALID_REVOKE_REASON');

      // Reason whitespace-only under 10 chars
      const padShortRes = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: '   Short   ' });
      expect(padShortRes.status).toBe(400);
      expect(padShortRes.body.code).toBe('INVALID_REVOKE_REASON');

      // Reason over 500 chars
      const longReason = 'A'.repeat(501);
      const longRes = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: longReason });
      expect(longRes.status).toBe(400);
      expect(longRes.body.code).toBe('INVALID_REVOKE_REASON');

      // Valid whitespace padded reason
      const validPad = '   This is a valid revocation reason that will be trimmed.   ';
      const validRes = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: validPad });
      expect(validRes.status).toBe(200);
      expect(validRes.body.result).toBe('revoked');

      const dbDoc = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbDoc.history[1].reason).toBe(validPad.trim());
    });
  });

  // =========================================================================
  // SUITE 5: HISTORY ENDPOINT & CHRONOLOGICAL AUDIT
  // =========================================================================
  describe('5. GET /api/officer/outcomes/:applicationId/history', () => {
    it('should return chronological audit history with officer name only for changedBy', async () => {
      // 1. Verify
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      // 2. Revoke
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Offer rejected by candidate due to higher studies.' });

      // 3. Reverified
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 14 });

      // Retrieve history
      const res = await request(app)
        .get(`/api/officer/outcomes/${selectedAppAlpha._id}/history`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.outcomeId).toBeDefined();
      expect(res.body.applicationId).toBe(selectedAppAlpha._id.toString());
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.history.length).toBe(3);

      expect(res.body.history[0].action).toBe('verified');
      expect(res.body.history[0].oldStatus).toBeNull();
      expect(res.body.history[0].newStatus).toBe('verified');
      expect(res.body.history[0].changedBy).toEqual({ name: 'Officer Alpha' });
      expect(res.body.history[0].ctc).toBe(12);

      expect(res.body.history[1].action).toBe('revoked');
      expect(res.body.history[1].oldStatus).toBe('verified');
      expect(res.body.history[1].newStatus).toBe('revoked');
      expect(res.body.history[1].changedBy).toEqual({ name: 'Officer Alpha' });
      expect(res.body.history[1].reason).toBe('Offer rejected by candidate due to higher studies.');

      expect(res.body.history[2].action).toBe('reverified');
      expect(res.body.history[2].oldStatus).toBe('revoked');
      expect(res.body.history[2].newStatus).toBe('verified');
      expect(res.body.history[2].changedBy).toEqual({ name: 'Officer Alpha' });
      expect(res.body.history[2].ctc).toBe(14);
    });

    it('should return identical 404 OUTCOME_NOT_FOUND when outcome does not exist', async () => {
      const nonExistentAppId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/officer/outcomes/${nonExistentAppId}/history`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('OUTCOME_NOT_FOUND');
    });
  });

  // =========================================================================
  // SUITE 6: CONCURRENCY & GENUINE PARALLELISM (Promise.all)
  // =========================================================================
  describe('6. Concurrency & Parallel Mutations', () => {
    it('10 parallel verify requests produce exactly 1 record and 1 history entry', async () => {
      const promises = Array.from({ length: 10 }).map(() =>
        request(app)
          .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ ctc: 11 })
      );

      const results = await Promise.all(promises);

      // All 10 must succeed (either created or already_verified)
      results.forEach((r) => {
        expect(r.status).toBe(200);
        expect(['created', 'already_verified'].includes(r.body.result)).toBe(true);
      });

      // Exactly one document must exist in DB
      const outcomes = await PlacementOutcome.find({ application: selectedAppAlpha._id });
      expect(outcomes.length).toBe(1);

      // Exactly one history entry must be in the history array
      expect(outcomes[0].history.length).toBe(1);
      expect(outcomes[0].history[0].action).toBe('verified');
      expect(outcomes[0].history[0].oldStatus).toBeNull();
      expect(outcomes[0].history[0].newStatus).toBe('verified');
    });

    it('parallel verify vs. revoke leaves a valid state and intact history chain', async () => {
      // First create verified outcome
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      // Run parallel verify (with same ctc 12) and revoke requests
      const verifyReqs = Array.from({ length: 5 }).map(() =>
        request(app)
          .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ ctc: 12 })
      );

      const revokeReqs = Array.from({ length: 5 }).map(() =>
        request(app)
          .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ reason: 'Concurrent revocation execution test valid reason.' })
      );

      const results = await Promise.all([...verifyReqs, ...revokeReqs]);

      results.forEach((r) => {
        expect([200, 409].includes(r.status)).toBe(true);
      });

      const outcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(['verified', 'revoked'].includes(outcome.status)).toBe(true);

      // Validate history chain invariant: oldStatus[i] === newStatus[i - 1]
      expect(outcome.history.length).toBeGreaterThanOrEqual(1);
      expect(outcome.history[0].oldStatus).toBeNull();
      for (let i = 1; i < outcome.history.length; i++) {
        expect(outcome.history[i].oldStatus).toBe(outcome.history[i - 1].newStatus);
      }
    });

    it('parallel revokes produce exactly 1 new history entry', async () => {
      // Verify first
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 15 });

      // Run 5 parallel revokes
      const promises = Array.from({ length: 5 }).map(() =>
        request(app)
          .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ reason: 'Parallel revoke verification reason exceeds 10 chars.' })
      );

      const results = await Promise.all(promises);

      results.forEach((r) => {
        expect(r.status).toBe(200);
        expect(['revoked', 'already_revoked'].includes(r.body.result)).toBe(true);
      });

      const outcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(outcome.status).toBe('revoked');
      // Exactly 2 history entries: 1 verified + 1 revoked
      expect(outcome.history.length).toBe(2);
      expect(outcome.history[1].action).toBe('revoked');
    });
  });

  // =========================================================================
  // SUITE 7: AUTHORIZATION, TENANT ISOLATION & BODY FIELDS
  // =========================================================================
  describe('7. Authorization, Tenant Scoping & Body Tampering Security', () => {
    it('cross-tenant verify, revoke, and history all return 404 without leaking existence', async () => {
      // Officer Beta tries to access College Alpha application
      const verifyCross = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ ctc: 10 });

      expect(verifyCross.status).toBe(404);
      expect(verifyCross.body.code).toBe('APPLICATION_NOT_FOUND');

      // Verify outcome in College Alpha first
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 10 });

      // Officer Beta tries to revoke College Alpha outcome
      const revokeCross = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ reason: 'Attempting unauthorized cross tenant revocation.' });

      expect(revokeCross.status).toBe(404);
      expect(revokeCross.body.code).toBe('OUTCOME_NOT_FOUND');

      // Officer Beta tries to get College Alpha history
      const historyCross = await request(app)
        .get(`/api/officer/outcomes/${selectedAppAlpha._id}/history`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);

      expect(historyCross.status).toBe(404);
      expect(historyCross.body.code).toBe('OUTCOME_NOT_FOUND');
    });

    it('student and recruiter roles are rejected with 403 Forbidden', async () => {
      // Student
      const studentVerify = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({ ctc: 10 });
      expect(studentVerify.status).toBe(403);

      const studentRevoke = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({ reason: 'Student trying to revoke.' });
      expect(studentRevoke.status).toBe(403);

      const studentHistory = await request(app)
        .get(`/api/officer/outcomes/${selectedAppAlpha._id}/history`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(studentHistory.status).toBe(403);

      // Recruiter
      const recruiterVerify = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenRecruiter}`)
        .send({ ctc: 10 });
      expect(recruiterVerify.status).toBe(403);

      const recruiterRevoke = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenRecruiter}`)
        .send({ reason: 'Recruiter trying to revoke.' });
      expect(recruiterRevoke.status).toBe(403);

      const recruiterHistory = await request(app)
        .get(`/api/officer/outcomes/${selectedAppAlpha._id}/history`)
        .set('Authorization', `Bearer ${tokenRecruiter}`);
      expect(recruiterHistory.status).toBe(403);
    });

    it('unverified placement officer is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenUnverifiedOfficer}`)
        .send({ ctc: 10 });

      expect(res.status).toBe(403);
    });

    it('body-supplied identity and metadata fields are strictly ignored', async () => {
      const maliciousBody = {
        ctc: 12,
        collegeId: collegeBeta._id,
        student: studentBeta._id,
        placementDrive: driveBeta._id,
        verifiedBy: officerBeta._id,
        status: 'revoked',
        history: [{ action: 'tampered', changedBy: officerBeta._id }],
      };

      const res = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send(maliciousBody);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('verified');

      const dbOutcome = await PlacementOutcome.findOne({ application: selectedAppAlpha._id });
      expect(dbOutcome.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(dbOutcome.student.toString()).toBe(studentAlpha._id.toString());
      expect(dbOutcome.placementDrive.toString()).toBe(driveAlpha._id.toString());
      expect(dbOutcome.verifiedBy.toString()).toBe(officerAlpha._id.toString());
      expect(dbOutcome.status).toBe('verified');
      expect(dbOutcome.history[0].action).toBe('verified');
    });
  });

  // =========================================================================
  // SUITE 8: ZERO NOTIFICATION DOCS & STRICT FORBIDDEN KEYS WHITELIST
  // =========================================================================
  describe('8. Notification Delivery & Whitelist Sanitization', () => {
    it('OUTCOME_VERIFIED notification created on verify, NO notifications on revoke, NO STATUS_UPDATE', async () => {
      const initialNotifCount = await Notification.countDocuments();
      expect(initialNotifCount).toBe(0);

      // Verify
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      let postVerifyNotifCount = await Notification.countDocuments();
      expect(postVerifyNotifCount).toBe(1);
      const notif = await Notification.findOne();
      expect(notif.type).toBe('OUTCOME_VERIFIED');
      expect(notif.eventKey).toMatch(/^outcome_verified:/);

      // Ensure no STATUS_UPDATE was emitted
      const statusUpdateCount = await Notification.countDocuments({ type: 'STATUS_UPDATE' });
      expect(statusUpdateCount).toBe(0);

      // Revoke creates NO notifications
      await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/revoke`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ reason: 'Verifying notification zero creation check.' });

      let postRevokeNotifCount = await Notification.countDocuments();
      expect(postRevokeNotifCount).toBe(1); // Still 1; no new notification on revoke
    });

    it('responses contain no forbidden keys (student email, phone, CGPA, resume, password)', async () => {
      const verifyRes = await request(app)
        .post(`/api/officer/outcomes/${selectedAppAlpha._id}/verify`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ ctc: 12 });

      const forbiddenKeys = ['email', 'studentEmail', 'phone', 'cgpa', 'resume', 'password', 'salt', 'hash'];

      const checkForbidden = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          expect(forbiddenKeys.includes(key.toLowerCase())).toBe(false);
          checkForbidden(obj[key]);
        }
      };

      checkForbidden(verifyRes.body);

      const historyRes = await request(app)
        .get(`/api/officer/outcomes/${selectedAppAlpha._id}/history`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      checkForbidden(historyRes.body);
    });
  });

  // =========================================================================
  // SUITE 9: DRIVE DELETION SAFEGUARD (DRIVE_DEPENDENTS REGISTRY)
  // =========================================================================
  describe('9. Drive Deletion Dependent Safeguards', () => {
    it('deletion is blocked (409) by an outcome without an application (direct insert) on an archived drive', async () => {
      // Create empty archived drive with zero applications and zero attendance
      const emptyArchivedDrive = await PlacementDrive.create({
        company: companyAlpha._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Orphan Outcome Test Role',
        jobDescription: 'Orphan role description',
        package: 8,
        driveDate: new Date(Date.now() - 86400000),
        registrationDeadline: new Date(Date.now() - 86400000),
        eligibleBatch: ['2026'],
        isArchived: true,
        isManuallyClosed: true,
      });

      // Direct insert of PlacementOutcome without an application
      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: emptyArchivedDrive._id,
        application: new mongoose.Types.ObjectId(), // orphan application id
        student: studentAlpha._id,
        status: 'verified',
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
        departmentSnapshot: {
          departmentId: deptCseAlpha._id,
          departmentName: 'Computer Science and Engineering',
          departmentCode: 'CSE',
          resolutionStatus: 'resolved_by_id',
        },
        offerPackage: { ctc: 8, unit: 'LPA', currency: 'INR' },
        history: [
          {
            action: 'verified',
            oldStatus: null,
            newStatus: 'verified',
            changedBy: officerAlpha._id,
            changedAt: new Date(),
          },
        ],
      });

      // Try permanent deletion of the drive
      const deleteRes = await request(app)
        .delete(`/api/officer/drives/${emptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.code).toBe('DRIVE_DELETE_BLOCKED_DEPENDENT_RECORDS');
      expect(deleteRes.body.message).toContain('placement outcome');
    });

    it('a revoked-only outcome also blocks permanent deletion (409)', async () => {
      const emptyArchivedDrive = await PlacementDrive.create({
        company: companyAlpha._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Revoked Outcome Test Role',
        jobDescription: 'Revoked role description',
        package: 8,
        driveDate: new Date(Date.now() - 86400000),
        registrationDeadline: new Date(Date.now() - 86400000),
        eligibleBatch: ['2026'],
        isArchived: true,
        isManuallyClosed: true,
      });

      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: emptyArchivedDrive._id,
        application: new mongoose.Types.ObjectId(),
        student: studentAlpha._id,
        status: 'revoked',
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
        departmentSnapshot: {
          departmentId: deptCseAlpha._id,
          departmentName: 'Computer Science and Engineering',
          departmentCode: 'CSE',
          resolutionStatus: 'resolved_by_id',
        },
        offerPackage: { ctc: 8, unit: 'LPA', currency: 'INR' },
        history: [
          {
            action: 'verified',
            oldStatus: null,
            newStatus: 'verified',
            changedBy: officerAlpha._id,
            changedAt: new Date(),
          },
          {
            action: 'revoked',
            oldStatus: 'verified',
            newStatus: 'revoked',
            changedBy: officerAlpha._id,
            changedAt: new Date(),
            reason: 'Revocation blocking deletion check.',
          },
        ],
      });

      const deleteRes = await request(app)
        .delete(`/api/officer/drives/${emptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.code).toBe('DRIVE_DELETE_BLOCKED_DEPENDENT_RECORDS');
    });

    it('allows permanent deletion for an archived drive with zero dependent records', async () => {
      const trulyEmptyArchivedDrive = await PlacementDrive.create({
        company: companyAlpha._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Truly Empty Drive',
        jobDescription: 'Truly empty description',
        package: 10,
        driveDate: new Date(Date.now() - 86400000),
        registrationDeadline: new Date(Date.now() - 86400000),
        eligibleBatch: ['2026'],
        isArchived: true,
        isManuallyClosed: true,
      });

      const deleteRes = await request(app)
        .delete(`/api/officer/drives/${trulyEmptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toBe('Placement drive permanently deleted.');

      const inDb = await PlacementDrive.findById(trulyEmptyArchivedDrive._id);
      expect(inDb).toBeNull();
    });
  });
});
