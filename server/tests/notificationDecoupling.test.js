const request = require('supertest');
const mongoose = require('mongoose');
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
} = require('../services/applicationStatusService');
const {
  verifyOutcomeService,
} = require('../services/placementOutcomeService');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('CPMS Phase 4B.1: Status Decoupling from Notification Failure', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta;
  let studentAlpha, studentBeta;
  let tokenOfficerAlpha, tokenOfficerBeta;
  let companyAlpha;
  let driveAlpha;
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
    jest.restoreAllMocks();

    collegeAlpha = await College.create({
      name: 'Alpha Engineering College',
      contactEmail: 'admin@alphatech.edu',
      address: '100 Tech Lane',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta University',
      contactEmail: 'admin@betacollege.edu',
      address: '200 University Ave',
      isActive: true,
    });

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

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);

    deptCseAlpha = await Department.create({
      name: 'Computer Science',
      code: 'CSE',
      collegeId: collegeAlpha._id,
      isActive: true,
    });

    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS-001',
      department: 'Computer Science',
      departmentId: deptCseAlpha._id,
    });

    companyAlpha = await Company.create({
      name: 'Global Tech Corp',
      companyLocation: 'Bangalore',
      industry: 'Software',
    });

    driveAlpha = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Backend Developer',
      package: 14,
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      eligibleBatch: ['2026'],
      isArchived: false,
    });
  });

  // =========================================================================
  // MANDATORY REGRESSION TESTS (MUST FAIL ON OLD ROLLBACK CODE, PASS ON NEW)
  // =========================================================================

  it('Critical race: A changes Interviewing to Selected and blocks in notification stub; B verifies outcome; A notification fails; status remains Selected and outcomeVerified true', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Interviewing',
    });

    const notifDeferred = createDeferred();
    const notifEnteredDeferred = createDeferred();

    jest.spyOn(Notification, 'create').mockImplementationOnce(() => {
      notifEnteredDeferred.resolve();
      return notifDeferred.promise;
    });

    // 1. Launch Request A (changes Interviewing -> Selected)
    const promiseA = changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
      officerUser: officerAlpha,
    });

    // Wait until Request A's status write has committed and entered notification creation
    await notifEnteredDeferred.promise;

    // Verify DB status is Selected right now
    const midApp = await DriveApplication.findById(appRecord._id);
    expect(midApp.status).toBe('Selected');

    // 2. Perform Request B: verify the outcome
    const resB = await verifyOutcomeService({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      offerPackageCtc: 14.0,
    });

    expect(resB.status).toBe(200);
    expect(resB.data.result).toBe('created');

    // Verify application is locked by outcome verification
    const lockedApp = await DriveApplication.findById(appRecord._id);
    expect(lockedApp.outcomeVerified).toBe(true);

    // 3. Reject Request A's notification
    notifDeferred.reject(new Error('Simulated notification network crash'));

    const resultA = await promiseA;

    // 4. Assert invariants: status MUST remain Selected, outcomeVerified true, outcome verified
    const finalApp = await DriveApplication.findById(appRecord._id);
    expect(finalApp.status).toBe('Selected');
    expect(finalApp.outcomeVerified).toBe(true);

    const outcome = await PlacementOutcome.findOne({ application: appRecord._id });
    expect(outcome).not.toBeNull();
    expect(outcome.status).toBe('verified');

    // On new code, resultA should succeed with notificationCreated: false
    expect(resultA.status).toBe(200);
    expect(resultA.data.notificationCreated).toBe(false);
  });

  it('ABA lost update: A changes Applied to Shortlisted and blocks; B changes to Interviewing; C changes to Shortlisted; A notification fails; status remains Shortlisted from C without rollback to Applied', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    const notifDeferred = createDeferred();
    const notifEnteredDeferred = createDeferred();

    jest.spyOn(Notification, 'create').mockImplementationOnce(() => {
      notifEnteredDeferred.resolve();
      return notifDeferred.promise;
    });

    // 1. Launch Request A (Applied -> Shortlisted)
    const promiseA = changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });

    // Wait until A commits status write and pauses in notification stub
    await notifEnteredDeferred.promise;

    // 2. Request B changes Shortlisted -> Interviewing
    const resB = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Interviewing',
      officerUser: officerAlpha,
    });
    expect(resB.status).toBe(200);

    // 3. Request C changes Interviewing -> Shortlisted
    const resC = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });
    expect(resC.status).toBe(200);

    // 4. Reject Request A's notification
    notifDeferred.reject(new Error('Notification DB failure for A'));

    const resultA = await promiseA;

    // 5. Final status MUST be Shortlisted (from C), NOT rolled back to Applied
    const finalApp = await DriveApplication.findById(appRecord._id);
    expect(finalApp.status).toBe('Shortlisted');
    expect(resultA.status).toBe(200);
    expect(resultA.data.notificationCreated).toBe(false);
  });

  it('Duplicate submit: two identical requests, one with failing notification; status persists with no rollback', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    // Request 1 fails notification
    jest.spyOn(Notification, 'create').mockRejectedValueOnce(
      new Error('Notification insert failed')
    );

    const res1 = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });

    expect(res1.status).toBe(200);
    expect(res1.data.success).toBe(true);
    expect(res1.data.notificationCreated).toBe(false);

    const dbApp = await DriveApplication.findById(appRecord._id);
    expect(dbApp.status).toBe('Shortlisted');

    // Request 2 (duplicate/same status) returns 200 idempotent
    const res2 = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });

    expect(res2.status).toBe(200);
    expect(res2.data.success).toBe(true);
    expect(res2.data.message).toMatch(/already Shortlisted/i);
  });

  // =========================================================================
  // OTHER MANDATORY SPECIFICATION TESTS
  // =========================================================================

  it('Notification failure: status persists, outcomeVerified unchanged, returns success with notificationCreated: false and no false rollback message', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    jest.spyOn(Notification, 'create').mockRejectedValueOnce(
      new Error('Temporary notification service outage')
    );

    const res = await request(app)
      .patch(`/api/officer/applications/${appRecord._id}/status`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
      .send({ status: 'Shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notificationCreated).toBe(false);
    expect(res.body.message).not.toMatch(/rolled back/i);
    expect(res.body.application.status).toBe('Shortlisted');

    const dbApp = await DriveApplication.findById(appRecord._id);
    expect(dbApp.status).toBe('Shortlisted');
    expect(dbApp.outcomeVerified).toBeUndefined();
  });

  it('A throw while building notification payload leaves status persisted and returns success with notificationCreated: false', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    // Simulate error during notification payload construction (after write commits, during property access in try block)
    const origFindOneAndUpdate = DriveApplication.findOneAndUpdate;
    jest.spyOn(DriveApplication, 'findOneAndUpdate').mockReturnValueOnce({
      populate: () => ({
        populate: async () => {
          const doc = await origFindOneAndUpdate.call(
            DriveApplication,
            { _id: appRecord._id, collegeId: collegeAlpha._id, outcomeVerified: { $ne: true } },
            { $set: { status: 'Interviewing' } },
            { new: true }
          );
          Object.defineProperty(doc, 'placementDrive', {
            get() {
              throw new Error('Simulated payload construction serialization failure');
            },
          });
          return doc;
        },
      }),
    });

    const res = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Interviewing',
      officerUser: officerAlpha,
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.notificationCreated).toBe(false);

    const dbApp = await DriveApplication.findById(appRecord._id);
    expect(dbApp.status).toBe('Interviewing');
  });

  it('Logs [Notification Dispatch Failure] with expected fields without logging student name, email, or token', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const simulatedError = new Error('Database disk full');
    simulatedError.code = 'ENOSPC';

    jest.spyOn(Notification, 'create').mockRejectedValueOnce(simulatedError);

    await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });

    expect(errorSpy).toHaveBeenCalled();
    const logCall = errorSpy.mock.calls.find((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('[Notification Dispatch Failure]'))
    );

    expect(logCall).toBeDefined();
    const logOutput = logCall.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');

    expect(logOutput).toContain('[Notification Dispatch Failure]');
    expect(logOutput).toContain(appRecord._id.toString());
    expect(logOutput).toContain(collegeAlpha._id.toString());
    expect(logOutput).toContain('STATUS_UPDATE');

    // MUST NOT log student sensitive info or full error object
    expect(logOutput).not.toContain(studentAlpha.name);
    expect(logOutput).not.toContain(studentAlpha.email);
    expect(logOutput).not.toContain(tokenOfficerAlpha);

    errorSpy.mockRestore();
  });

  it('Notification success path: unchanged behavior, notificationCreated: true', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    const res = await request(app)
      .patch(`/api/officer/applications/${appRecord._id}/status`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
      .send({ status: 'Shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notificationCreated).toBe(true);
    expect(res.body.application.status).toBe('Shortlisted');

    const notif = await Notification.findOne({
      recipient: studentAlpha._id,
      application: appRecord._id,
    });
    expect(notif).not.toBeNull();
    expect(notif.message).toContain('Shortlisted');
  });

  it('Blocked request (verified outcome) still creates no notification and no history entry', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    await verifyOutcomeService({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      offerPackageCtc: 12.0,
    });

    const notifCountBefore = await Notification.countDocuments();

    const res = await request(app)
      .patch(`/api/officer/applications/${appRecord._id}/status`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
      .send({ status: 'Rejected' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VERIFIED_OUTCOME_EXISTS');

    const notifCountAfter = await Notification.countDocuments();
    expect(notifCountAfter).toBe(notifCountBefore);

    const dbApp = await DriveApplication.findById(appRecord._id);
    expect(dbApp.status).toBe('Selected');
  });

  it('Invariant loop of 20 iterations with failing notifications: never (verified outcome AND status is not Selected)', async () => {
    const ITERATIONS = 20;

    for (let i = 0; i < ITERATIONS; i++) {
      const student = await User.create({
        name: `Inv Student ${i}`,
        email: `inv.student.${i}@alphatech.edu`,
        password: 'password123',
        role: 'student',
        collegeId: collegeAlpha._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });

      const appRec = await DriveApplication.create({
        student: student._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Interviewing',
      });

      // Force notification failure on this iteration
      jest.spyOn(Notification, 'create').mockRejectedValueOnce(
        new Error(`Notification failure iteration ${i}`)
      );

      // Race: Request 1 updates to Selected, Request 2 attempts verify
      await Promise.all([
        changeApplicationStatus({
          applicationId: appRec._id,
          collegeId: collegeAlpha._id,
          status: 'Selected',
          officerUser: officerAlpha,
        }),
        verifyOutcomeService({
          applicationId: appRec._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          offerPackageCtc: 10.0,
        }),
      ]);

      const dbOutcome = await PlacementOutcome.findOne({ application: appRec._id });
      const dbApp = await DriveApplication.findById(appRec._id);

      const isOutcomeVerified = Boolean(dbOutcome && dbOutcome.status === 'verified');
      const isAppNotSelected = Boolean(dbApp.status !== 'Selected');

      // CORE INVARIANT
      expect(isOutcomeVerified && isAppNotSelected).toBe(false);
    }
  });

  it('Tenant isolation: cross-college status update returns 403 / 404', async () => {
    const appBeta = await DriveApplication.create({
      student: studentBeta._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeBeta._id,
      status: 'Applied',
    });

    const res = await request(app)
      .patch(`/api/officer/applications/${appBeta._id}/status`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
      .send({ status: 'Shortlisted' });

    expect([403, 404]).toContain(res.status);
    expect(res.body.code).not.toBe('VERIFIED_OUTCOME_EXISTS');
  });

  it('Idempotency contract holds: setting same status returns 200 with no-op message', async () => {
    const appRecord = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
    });

    const res = await changeApplicationStatus({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
      officerUser: officerAlpha,
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.message).toBe('Application status is already Shortlisted.');
  });
});
