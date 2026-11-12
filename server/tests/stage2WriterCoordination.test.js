const mongoose = require('mongoose');
const Department = require('../models/Department');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const DriveAttendance = require('../models/DriveAttendance');
const PlacementOutcome = require('../models/PlacementOutcome');
const Company = require('../models/Company');
const { markDriveAttendanceService } = require('../services/driveAttendanceService');
const {
  verifyOutcomeService,
  revokeOutcomeService,
} = require('../services/placementOutcomeService');
const coord = require('../utils/departmentCoordination');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('Stage 2: Writer Coordination Integration Tests', () => {
  jest.setTimeout(30000);

  let collegeAlpha, collegeBeta;
  let officerAlpha;
  let deptCseAlpha, deptEceAlpha;
  let studentAlice, studentBob, studentCharlie;
  let companyAlpha, driveAlpha;
  let appAlice, appBob, appCharlie;

  beforeAll(async () => {
    await connectTestDb();
    await Department.createIndexes();
    await DriveAttendance.createIndexes();
    await PlacementOutcome.createIndexes();
    await DriveApplication.createIndexes();
    await PlacementDrive.createIndexes();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Technology',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta State College',
      isActive: true,
    });

    // 2. Setup Officer
    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer.alpha@alphatech.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    // 3. Setup Departments
    deptCseAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
      deletionState: 'open',
      activeWriterIds: [],
    });

    deptEceAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Electronics and Communication',
      code: 'ECE',
      isActive: true,
      deletionState: 'open',
      activeWriterIds: [],
    });

    // 4. Setup Students and Profiles
    studentAlice = await User.create({
      name: 'Alice Smith',
      email: 'alice@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentBob = await User.create({
      name: 'Bob Jones',
      email: 'bob@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentCharlie = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    // Alice -> CSE
    await StudentProfile.create({
      user: studentAlice._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS001',
      departmentId: deptCseAlpha._id,
      department: 'Computer Science and Engineering',
    });

    // Bob -> CSE (shares same department as Alice)
    await StudentProfile.create({
      user: studentBob._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS002',
      departmentId: deptCseAlpha._id,
      department: 'Computer Science and Engineering',
    });

    // Charlie -> ECE
    await StudentProfile.create({
      user: studentCharlie._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'EC001',
      departmentId: deptEceAlpha._id,
      department: 'Electronics and Communication',
    });

    // 5. Setup Company & Drive
    companyAlpha = await Company.create({
      name: 'Tech Corp',
      location: 'Bangalore',
    });

    driveAlpha = await PlacementDrive.create({
      collegeId: collegeAlpha._id,
      company: companyAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Full stack development',
      driveDate: new Date('2026-12-15'),
      registrationDeadline: new Date('2026-12-10'),
      isActive: true,
      isArchived: false,
    });

    // 6. Setup Applications
    appAlice = await DriveApplication.create({
      student: studentAlice._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    appBob = await DriveApplication.create({
      student: studentBob._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    appCharlie = await DriveApplication.create({
      student: studentCharlie._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });
  });

  // =========================================================================
  // SUITE 1: DRIVE ATTENDANCE COORDINATION INTEGRATION
  // =========================================================================
  describe('1. Drive Attendance Coordination Integration', () => {
    test('all required tokens acquired before the first attendance write', async () => {
      const callSequence = [];

      const origAcquire = coord.acquireBatchWriterTokens;
      jest.spyOn(coord, 'acquireBatchWriterTokens').mockImplementation(async (params) => {
        callSequence.push('acquireBatchWriterTokens');
        return origAcquire(params);
      });

      const origFindOneAndUpdate = DriveAttendance.findOneAndUpdate;
      jest.spyOn(DriveAttendance, 'findOneAndUpdate').mockImplementation((...args) => {
        callSequence.push('attendance_write');
        return origFindOneAndUpdate.apply(DriveAttendance, args);
      });

      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [{ applicationId: appAlice._id, status: 'Present' }],
      });

      expect(res.status).toBe(200);
      expect(callSequence[0]).toBe('acquireBatchWriterTokens');
      expect(callSequence.includes('attendance_write')).toBe(true);

      coord.acquireBatchWriterTokens.mockRestore();
      DriveAttendance.findOneAndUpdate.mockRestore();
    });

    test('multiple students sharing a department acquire only one token for that department', async () => {
      const acquireSpy = jest.spyOn(coord, 'acquireBatchWriterTokens');

      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [
          { applicationId: appAlice._id, status: 'Present' },
          { applicationId: appBob._id, status: 'Present' },
        ],
      });

      expect(res.status).toBe(200);
      expect(acquireSpy).toHaveBeenCalledTimes(1);

      // Verify departmentIds passed to acquireBatchWriterTokens contains exactly 1 department ID
      const passedDeptIds = acquireSpy.mock.calls[0][0].departmentIds;
      expect(passedDeptIds).toHaveLength(1);
      expect(passedDeptIds[0].toString()).toBe(deptCseAlpha._id.toString());

      // Both attendance records successfully created
      const count = await DriveAttendance.countDocuments({
        application: { $in: [appAlice._id, appBob._id] },
      });
      expect(count).toBe(2);

      acquireSpy.mockRestore();
    });

    test('failure to acquire any required token results in zero attendance writes', async () => {
      // Put CSE department into closing state (deletion in progress)
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionState: 'closing', deletionToken: 'del-tok-123' } }
      );

      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [{ applicationId: appAlice._id, status: 'Present' }],
      });

      expect(res.status).toBe(409);
      expect(res.error.code).toBe('BATCH_WRITER_TOKEN_REJECTED');

      // CRITICAL: Verify ZERO attendance records were written
      const attendanceCount = await DriveAttendance.countDocuments();
      expect(attendanceCount).toBe(0);
    });

    test('previously acquired tokens are released if a later acquisition fails', async () => {
      // Make ECE closing, keep CSE open
      await Department.updateOne(
        { _id: deptEceAlpha._id },
        { $set: { deletionState: 'closing', deletionToken: 'del-tok-456' } }
      );

      // Batch with Alice (CSE) and Charlie (ECE)
      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [
          { applicationId: appAlice._id, status: 'Present' },
          { applicationId: appCharlie._id, status: 'Present' },
        ],
      });

      expect(res.status).toBe(409);

      // CSE token was acquired first, but MUST be rolled back because ECE failed
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      // Zero writes
      const count = await DriveAttendance.countDocuments();
      expect(count).toBe(0);
    });

    test('tokens are released after successful writes', async () => {
      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [
          { applicationId: appAlice._id, status: 'Present' },
          { applicationId: appCharlie._id, status: 'Absent' },
        ],
      });

      expect(res.status).toBe(200);

      // Verify tokens released in database
      const cseDoc = await Department.findById(deptCseAlpha._id);
      const eceDoc = await Department.findById(deptEceAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);
      expect(eceDoc.activeWriterIds).toEqual([]);

      // Response contains clean cleanup report
      expect(res.data.cleanup).toBeDefined();
      expect(res.data.cleanup.success).toBe(true);
      expect(res.data.cleanup.releasedCount).toBe(2);
    });

    test('tokens are released when an attendance write throws', async () => {
      // Mock findOneAndUpdate to throw on insert
      const origFindOneAndUpdate = DriveAttendance.findOneAndUpdate;
      jest.spyOn(DriveAttendance, 'findOneAndUpdate').mockImplementation(() => {
        throw new Error('Simulated database write error');
      });

      await expect(
        markDriveAttendanceService({
          driveId: driveAlpha._id,
          collegeId: collegeAlpha._id,
          officerUser: officerAlpha,
          entries: [{ applicationId: appAlice._id, status: 'Present' }],
        })
      ).rejects.toThrow('Simulated database write error');

      // CRITICAL: finally block must have released the token despite the thrown error
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      DriveAttendance.findOneAndUpdate.mockRestore();
    });

    test('partial cleanup failure is surfaced accurately', async () => {
      // Spy on releaseBatchWriterTokens to simulate a partial release failure
      jest.spyOn(coord, 'releaseBatchWriterTokens').mockResolvedValueOnce({
        success: false,
        releasedCount: 0,
        failedCount: 1,
        failures: [
          {
            departmentId: deptCseAlpha._id,
            code: 'RELEASE_FAILED',
            message: 'Simulated release failure',
          },
        ],
      });

      const res = await markDriveAttendanceService({
        driveId: driveAlpha._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        entries: [{ applicationId: appAlice._id, status: 'Present' }],
      });

      expect(res.status).toBe(200);
      expect(res.data.cleanup).toBeDefined();
      expect(res.data.cleanup.success).toBe(false);
      expect(res.data.cleanup.failedCount).toBe(1);
      expect(res.data.warning).toMatch(/could not be released/i);

      coord.releaseBatchWriterTokens.mockRestore();
    });
  });

  // =========================================================================
  // SUITE 2: PLACEMENT OUTCOME COORDINATION INTEGRATION
  // =========================================================================
  describe('2. Placement Outcome Coordination Integration', () => {
    test('token acquired before a department snapshot write and released after successful snapshot write', async () => {
      const acquireSpy = jest.spyOn(coord, 'acquireWriterToken');
      const releaseSpy = jest.spyOn(coord, 'releaseWriterToken');

      const res = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 12.5,
      });

      expect(res.status).toBe(200);
      expect(res.data.result).toBe('created');
      expect(res.data.departmentSnapshot.departmentName).toBe(
        'Computer Science and Engineering'
      );

      // Verify token was acquired for CSE
      expect(acquireSpy).toHaveBeenCalledTimes(1);
      expect(acquireSpy.mock.calls[0][0].departmentId.toString()).toBe(
        deptCseAlpha._id.toString()
      );

      // Verify token was released after write
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy.mock.calls[0][0].departmentId.toString()).toBe(
        deptCseAlpha._id.toString()
      );

      // DB check: activeWriterIds is empty
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      acquireSpy.mockRestore();
      releaseSpy.mockRestore();
    });

    test('token released when snapshot persistence fails', async () => {
      // Mock findOneAndUpdate on PlacementOutcome to throw
      const origFindOneAndUpdate = PlacementOutcome.findOneAndUpdate;
      jest.spyOn(PlacementOutcome, 'findOneAndUpdate').mockImplementation(() => {
        throw new Error('Simulated outcome database persistence error');
      });

      const res = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 15,
      });

      expect(res.status).toBe(500);
      expect(res.error.code).toBe('OUTCOME_STEP_FAILED');

      // CRITICAL: token was released in finally despite error
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      // In-memory/document lock compensated
      const app = await DriveApplication.findById(appAlice._id);
      expect(app.outcomeVerified).toBe(false);

      PlacementOutcome.findOneAndUpdate.mockRestore();
    });

    test('token acquisition failure prevents snapshot write and resets processing lock', async () => {
      // Put CSE department into closing state
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionState: 'closing', deletionToken: 'del-tok-789' } }
      );

      const res = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 14,
      });

      expect(res.status).toBe(409);
      expect(res.error.code).toBe('WRITER_TOKEN_REJECTED');

      // Zero outcome records written
      const count = await PlacementOutcome.countDocuments();
      expect(count).toBe(0);

      // CRITICAL: processing lock was reset on DriveApplication
      const app = await DriveApplication.findById(appAlice._id);
      expect(app.outcomeVerified).toBe(false);
    });

    test('an idempotent already-verified request does not acquire an unnecessary token', async () => {
      // First verification succeeds
      const firstRes = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 10,
      });
      expect(firstRes.status).toBe(200);

      // Now set department to closing state
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionState: 'closing', deletionToken: 'del-tok-closing' } }
      );

      const acquireSpy = jest.spyOn(coord, 'acquireWriterToken');

      // Second verification (same CTC) -> already_verified
      const secondRes = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 10,
      });

      // Must succeed with already_verified without acquiring any token!
      expect(secondRes.status).toBe(200);
      expect(secondRes.data.result).toBe('already_verified');
      expect(acquireSpy).not.toHaveBeenCalled();

      acquireSpy.mockRestore();
    });

    test('revoked-outcome reverification is covered and writes fresh department snapshot with coordination', async () => {
      // 1. Initial verification
      const verifyRes = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 10,
      });
      expect(verifyRes.status).toBe(200);

      // 2. Revocation
      const revokeRes = await revokeOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        reason: 'Offer rescinded due to candidate duplicate acceptance.',
      });
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.data.result).toBe('revoked');

      // 3. Reverification
      const acquireSpy = jest.spyOn(coord, 'acquireWriterToken');
      const releaseSpy = jest.spyOn(coord, 'releaseWriterToken');

      const reverifyRes = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 12,
      });

      expect(reverifyRes.status).toBe(200);
      expect(reverifyRes.data.result).toBe('reverified');
      expect(reverifyRes.data.offerPackage.ctc).toBe(12);

      // Reverification wrote fresh snapshot, so token MUST have been acquired and released
      expect(acquireSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledTimes(1);

      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      acquireSpy.mockRestore();
      releaseSpy.mockRestore();
    });

    test('reverification is blocked with 409 if department token acquisition fails', async () => {
      // 1. Initial verification & revoke
      await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 10,
      });
      await revokeOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        reason: 'Offer rescinded due to candidate duplicate acceptance.',
      });

      // 2. Now close department
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionState: 'closing', deletionToken: 'del-closing-999' } }
      );

      // 3. Attempt reverification
      const res = await verifyOutcomeService({
        applicationId: appAlice._id,
        collegeId: collegeAlpha._id,
        officerUser: officerAlpha,
        ctc: 14,
      });

      expect(res.status).toBe(409);
      expect(res.error.code).toBe('WRITER_TOKEN_REJECTED');

      // Outcome status remains revoked, not reverified
      const outcome = await PlacementOutcome.findOne({ application: appAlice._id });
      expect(outcome.status).toBe('revoked');

      // Processing lock reset on DriveApplication
      const app = await DriveApplication.findById(appAlice._id);
      expect(app.outcomeVerified).toBe(false);
    });
  });
});

