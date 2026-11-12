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
const Company = require('../models/Company');
const coord = require('../utils/departmentCoordination');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('Stage 3: Safe Department Deletion Controller Tests', () => {
  jest.setTimeout(30000);

  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, studentAlpha, studentBeta;
  let tokenOfficerAlpha, tokenOfficerBeta;
  let companyAlpha, driveAlpha, appAlpha, appBeta;

  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'stage3_deletion_test_jwt_secret_key_32!';
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

    // 2. Setup Officers
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

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);

    // 3. Setup Students
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

    // 4. Setup Company & Drive
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

    // 5. Setup Applications
    appAlpha = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    appBeta = await DriveApplication.create({
      student: studentBeta._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeBeta._id,
      status: 'Selected',
    });
  });

  // =========================================================================
  // TEST 1: SUCCESSFUL DELETION WITHOUT WRITERS OR DEPENDENCIES
  // =========================================================================
  test('1. Successful deletion when no writers or dependencies exist', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Aerospace Engineering',
      code: 'AERO',
      isActive: true,
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/permanently deleted/i);

    const inDb = await Department.findById(dept._id);
    expect(inDb).toBeNull();
  });

  // =========================================================================
  // TEST 2: NEW WRITER ACQUISITION REJECTED AFTER GATE CLAIM
  // =========================================================================
  test('2. New writer acquisition is rejected after deletion gate claim', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Biotechnology',
      code: 'BIOTECH',
      isActive: true,
    });

    // Claim the deletion gate
    const claimRes = await coord.claimDepartmentDeletion({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });
    expect(claimRes.success).toBe(true);

    // Attempt to acquire a writer token while gate is claimed (closing)
    const writeRes = await coord.acquireWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });

    expect(writeRes.success).toBe(false);
    expect(writeRes.code).toBe('WRITER_TOKEN_REJECTED');

    // Restore gate
    await coord.restoreDepartmentDeletion({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
      deletionToken: claimRes.deletionToken,
    });
  });

  // =========================================================================
  // TEST 3: DELETION WAITS WHILE ACTIVE WRITERS EXIST AND PROCEEDS WHEN RELEASED
  // =========================================================================
  test('3. Deletion waits while active writers exist and proceeds when they release', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Chemical Engineering',
      code: 'CHEM',
      isActive: true,
    });

    // Acquire writer token on department
    const writerRes = await coord.acquireWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });
    expect(writerRes.success).toBe(true);

    // Start delete request asynchronously and attach promise handler to trigger dispatch
    const deletePromise = new Promise((resolve, reject) => {
      request(app)
        .delete(`/api/officer/departments/${dept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .then(resolve)
        .catch(reject);
    });

    // Poll until deletion gate has been claimed (deletionState becomes closing)
    let claimed = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const doc = await Department.findById(dept._id);
      if (doc && doc.deletionState === 'closing') {
        claimed = true;
        expect(doc.activeWriterIds).toContain(writerRes.writerId);
        break;
      }
    }
    expect(claimed).toBe(true);

    // Release the writer token
    const releaseRes = await coord.releaseWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
      writerId: writerRes.writerId,
    });
    expect(releaseRes.success).toBe(true);

    // Await deletion response
    const res = await deletePromise;
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Department document is permanently deleted
    const inDb = await Department.findById(dept._id);
    expect(inDb).toBeNull();
  });

  // =========================================================================
  // TEST 4: TIMEOUT RETURNS HTTP 409 AND RESTORES GATE ONLY WHEN OWNED
  // =========================================================================
  test('4. Timeout returns HTTP 409 and restores the gate only when owned', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Civil Engineering',
      code: 'CIVIL',
      isActive: true,
    });

    // Acquire writer token and NEVER release it
    const writerRes = await coord.acquireWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });
    expect(writerRes.success).toBe(true);

    // DELETE request will drain wait for 5000 ms then timeout
    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ACTIVE_WRITERS_DRAIN_TIMEOUT');

    // Gate must be restored to open, deletionToken cleared
    const restoredDoc = await Department.findById(dept._id);
    expect(restoredDoc.deletionState).toBe('open');
    expect(restoredDoc.deletionToken).toBeNull();
    // Active writer remains present (no force-release)
    expect(restoredDoc.activeWriterIds).toContain(writerRes.writerId);
  });

  // =========================================================================
  // TEST 5: EXISTING ATTENDANCE DEPARTMENTID BLOCKS DELETION
  // =========================================================================
  test('5. Existing attendance dependency (departmentId) blocks deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
    });

    await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      departmentId: dept._id,
      departmentName: 'Computer Science and Engineering',
      departmentResolutionStatus: 'resolved_by_id',
      status: 'Present',
      markedBy: officerAlpha._id,
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.attendanceRecords).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 6: ATTENDANCE CANONICAL-NAME SNAPSHOT DEPENDENCY BLOCKS DELETION
  // =========================================================================
  test('6. Attendance canonical-name snapshot dependency blocks deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Data Science',
      code: 'DS',
      isActive: true,
    });

    // Attendance record has departmentId null (e.g., historical resolution), but matches canonical name
    await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      departmentId: null,
      departmentName: 'Data Science',
      departmentResolutionStatus: 'resolved_by_name',
      status: 'Present',
      markedBy: officerAlpha._id,
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.attendanceRecords).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 7: STUDENTPROFILE DEPARTMENTID DEPENDENCY BLOCKS DELETION
  // =========================================================================
  test('7. StudentProfile departmentId dependency blocks deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Electrical Engineering',
      code: 'EE',
      isActive: true,
    });

    // Profile with formal departmentId reference
    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'EE001',
      departmentId: dept._id,
      department: 'Electrical Engineering',
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.studentProfiles).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 7B: FREE-TEXT STUDENTPROFILE.DEPARTMENT DOES NOT BLOCK DELETION
  // =========================================================================
  test('7b. Free-text StudentProfile.department without departmentId does not block deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Environmental Engineering',
      code: 'ENV',
      isActive: true,
    });

    // Profile with free-text department string only, but departmentId is null/unlinked
    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ENV001',
      departmentId: null,
      department: 'Environmental Engineering',
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const inDb = await Department.findById(dept._id);
    expect(inDb).toBeNull();
  });

  // =========================================================================
  // TEST 8: PLACEMENTOUTCOME DEPARTMENTSNAPSHOT.DEPARTMENTID BLOCKS DELETION
  // =========================================================================
  test('8. PlacementOutcome departmentSnapshot ID dependency blocks deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Information Technology',
      code: 'IT',
      isActive: true,
    });

    await PlacementOutcome.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      status: 'verified',
      verifiedBy: officerAlpha._id,
      departmentSnapshot: {
        departmentId: dept._id,
        departmentName: 'Information Technology',
        departmentCode: 'IT',
        resolutionStatus: 'resolved_by_id',
      },
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.placementOutcomes).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 9: PLACEMENTOUTCOME CANONICAL-NAME SNAPSHOT BLOCKS DELETION
  // =========================================================================
  test('9. PlacementOutcome canonical-name snapshot dependency blocks deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Instrumentation Engineering',
      code: 'INST',
      isActive: true,
    });

    await PlacementOutcome.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      status: 'verified',
      verifiedBy: officerAlpha._id,
      departmentSnapshot: {
        departmentId: null,
        departmentName: 'Instrumentation Engineering',
        departmentCode: null,
        resolutionStatus: 'resolved_by_name',
      },
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.placementOutcomes).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 10: DEPENDENCY CONFLICT RESTORES THE DELETION GATE
  // =========================================================================
  test('10. Dependency conflict restores the deletion gate', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Marine Engineering',
      code: 'MARINE',
      isActive: true,
    });

    await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      departmentId: dept._id,
      departmentName: 'Marine Engineering',
      departmentResolutionStatus: 'resolved_by_id',
      status: 'Present',
      markedBy: officerAlpha._id,
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);

    // Gate must be restored to open
    const restoredDoc = await Department.findById(dept._id);
    expect(restoredDoc.deletionState).toBe('open');
    expect(restoredDoc.deletionToken).toBeNull();
    expect(restoredDoc.deletionStartedAt).toBeNull();
  });

  // =========================================================================
  // TEST 11: CONCURRENT DELETIONS CANNOT OVERWRITE THE FIRST DELETION TOKEN
  // =========================================================================
  test('11. A second concurrent deletion cannot overwrite the first deletion token', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Materials Science',
      code: 'MATSCI',
      isActive: true,
    });

    // Fire 2 concurrent deletions via Promise.all
    const [del1, del2] = await Promise.all([
      request(app)
        .delete(`/api/officer/departments/${dept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`),
      request(app)
        .delete(`/api/officer/departments/${dept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`),
    ]);

    const statuses = [del1.status, del2.status];
    expect(statuses).toContain(200);
    expect(statuses.some((s) => s === 404 || s === 409)).toBe(true);

    const inDb = await Department.findById(dept._id);
    expect(inDb).toBeNull();
  });

  // =========================================================================
  // TEST 12: OWNERSHIP LOSS PREVENTS DESTRUCTIVE DELETION
  // =========================================================================
  test('12. Ownership loss prevents destructive deletion', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Mathematics and Computing',
      code: 'MNC',
      isActive: true,
    });

    // Acquire a writer token so deletion enters the drain loop
    const writerRes = await coord.acquireWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });
    expect(writerRes.success).toBe(true);

    const deletePromise = new Promise((resolve, reject) => {
      request(app)
        .delete(`/api/officer/departments/${dept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .then(resolve)
        .catch(reject);
    });

    // Poll until delete has claimed the gate
    let claimed = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const doc = await Department.findById(dept._id);
      if (doc && doc.deletionState === 'closing') {
        claimed = true;
        break;
      }
    }
    expect(claimed).toBe(true);

    // Simulate ownership loss: another actor steals the deletion token
    await Department.updateOne(
      { _id: dept._id },
      { $set: { deletionToken: 'stolen-rogue-token-999' } }
    );

    // Release writer token so drain loop exits
    await coord.releaseWriterToken({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
      writerId: writerRes.writerId,
    });

    const res = await deletePromise;
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DELETION_OWNERSHIP_LOST');

    // Department MUST NOT be deleted
    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
    // Stolen token preserved (not cleared by the caller)
    expect(inDb.deletionToken).toBe('stolen-rogue-token-999');
  });

  // =========================================================================
  // TEST 13: RESTORATION NEVER CLEARS ANOTHER REQUEST'S TOKEN
  // =========================================================================
  test("13. Restoration never clears another request's token", async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Mechanical Engineering Alpha',
      code: 'MECH-A',
      isActive: true,
    });

    // Request A claims gate
    const claimA = await coord.claimDepartmentDeletion({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
    });
    expect(claimA.success).toBe(true);

    // Request B attempts to restore using a wrong token
    const restoreB = await coord.restoreDepartmentDeletion({
      departmentId: dept._id,
      collegeId: collegeAlpha._id,
      deletionToken: 'wrong-token-from-request-b',
    });

    expect(restoreB.success).toBe(false);
    expect(restoreB.code).toBe('RESTORATION_FAILED');

    // Original token from Request A is strictly intact
    const inDb = await Department.findById(dept._id);
    expect(inDb.deletionState).toBe('closing');
    expect(inDb.deletionToken).toBe(claimA.deletionToken);
  });

  // =========================================================================
  // TEST 14: DATABASE FAILURE TRIGGERS OWNERSHIP-CHECKED RESTORATION
  // =========================================================================
  test('14. Dependency-query/database failure triggers ownership-checked restoration', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Mining Engineering',
      code: 'MINE',
      isActive: true,
    });

    // Mock countDocuments on DriveAttendance to simulate an unexpected database exception
    const origCount = DriveAttendance.countDocuments;
    jest.spyOn(DriveAttendance, 'countDocuments').mockImplementationOnce(() => {
      throw new Error('Simulated database connection failure during dependency check');
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    // Error middleware caught the exception
    expect(res.status).toBe(500);

    // Gate must have been restored in error handler
    const restoredDoc = await Department.findById(dept._id);
    expect(restoredDoc.deletionState).toBe('open');
    expect(restoredDoc.deletionToken).toBeNull();

    DriveAttendance.countDocuments.mockRestore();
  });

  // =========================================================================
  // TEST 15: FAILED RESTORATION IS REPORTED AND LOGGED ACCURATELY
  // =========================================================================
  test('15. Failed restoration is reported and logged accurately', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Nuclear Engineering',
      code: 'NUCL',
      isActive: true,
    });

    // Create an attendance record to trigger restoration path
    await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      departmentId: dept._id,
      departmentName: 'Nuclear Engineering',
      departmentResolutionStatus: 'resolved_by_id',
      status: 'Present',
      markedBy: officerAlpha._id,
    });

    // Spy on restoreDepartmentDeletion and simulate a failure
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const origRestore = coord.restoreDepartmentDeletion;
    jest.spyOn(coord, 'restoreDepartmentDeletion').mockResolvedValueOnce({
      success: false,
      code: 'RESTORATION_FAILED',
      message: 'Simulated restoration failure',
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');

    // Verify critical error was logged with department details
    expect(errorSpy).toHaveBeenCalled();
    const logCall = errorSpy.mock.calls.find((c) =>
      c[0]?.includes('[CRITICAL] Department deletion gate restoration failed')
    );
    expect(logCall).toBeDefined();

    coord.restoreDepartmentDeletion.mockRestore();
    errorSpy.mockRestore();
  });

  // =========================================================================
  // TEST 16: CROSS-COLLEGE DEPENDENCIES DO NOT BLOCK DELETION IN ANOTHER COLLEGE
  // =========================================================================
  test('16. Cross-college dependencies do not block deletion in another college', async () => {
    // College Alpha has "Robotics"
    const deptAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Robotics Engineering',
      code: 'ROBOT',
      isActive: true,
    });

    // College Beta has an attendance record referencing "Robotics Engineering"
    await DriveAttendance.create({
      collegeId: collegeBeta._id, // College Beta!
      placementDrive: driveAlpha._id,
      student: studentBeta._id,
      application: appBeta._id,
      departmentId: null,
      departmentName: 'Robotics Engineering',
      departmentResolutionStatus: 'resolved_by_name',
      status: 'Present',
      markedBy: officerBeta._id,
    });

    // Officer Alpha deletes College Alpha's Robotics department
    const res = await request(app)
      .delete(`/api/officer/departments/${deptAlpha._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    // Must succeed because College Beta dependency must not leak into College Alpha check!
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const inDb = await Department.findById(deptAlpha._id);
    expect(inDb).toBeNull();
  });

  // =========================================================================
  // TEST 17: CROSS-COLLEGE DELETION ATTEMPTS CANNOT DELETE ANOTHER COLLEGE'S DEPARTMENT
  // =========================================================================
  test("17. Cross-college deletion attempts cannot delete another college's Department", async () => {
    const deptAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Software Systems',
      code: 'SS',
      isActive: true,
    });

    // Officer Beta attempts to delete Officer Alpha's department
    const res = await request(app)
      .delete(`/api/officer/departments/${deptAlpha._id}`)
      .set('Authorization', `Bearer ${tokenOfficerBeta}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Department in College Alpha is untouched
    const inDb = await Department.findById(deptAlpha._id);
    expect(inDb).not.toBeNull();
  });

  // =========================================================================
  // TEST 18: CONDITIONAL FINAL DELETE MATCHING NO DOCUMENT RETURNS CONFLICT
  // =========================================================================
  test('18. A conditional final delete that matches no document returns a conflict', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Textile Technology',
      code: 'TEXTILE',
      isActive: true,
    });

    // Mock findOneAndDelete on Department to simulate race condition where document disappeared
    const origFindOneAndDelete = Department.findOneAndDelete;
    jest.spyOn(Department, 'findOneAndDelete').mockResolvedValueOnce(null);

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DELETION_CONDITIONAL_DELETE_FAILED');

    Department.findOneAndDelete.mockRestore();
  });

  // =========================================================================
  // TEST 19: INACTIVE LEGACY DEPARTMENT WITH ZERO DEPENDENCIES PERMANENTLY DELETED
  // =========================================================================
  test('19. Inactive legacy department with zero dependencies can be permanently deleted', async () => {
    const legacyId = new mongoose.Types.ObjectId();
    await Department.collection.insertOne({
      _id: legacyId,
      collegeId: collegeAlpha._id,
      name: 'Master of Computer Application Legacy',
      code: 'MCA_LEGACY',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${legacyId}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/permanently deleted/i);

    const inDb = await Department.findById(legacyId);
    expect(inDb).toBeNull();

    // Verify code can now be used for a new department
    const postRes = await request(app)
      .post('/api/officer/departments')
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
      .send({
        name: 'Master of Computer Application Reborn',
        code: 'MCA_LEGACY',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
  });

  // =========================================================================
  // TEST 20: INACTIVE DEPARTMENT WITH ATTENDANCE DEPENDENCIES IS NOT DELETED
  // =========================================================================
  test('20. Inactive department with attendance dependencies is not deleted', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Inactive Attendance Dept',
      code: 'INACT_ATT',
      isActive: false,
    });

    await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      departmentId: dept._id,
      departmentName: dept.name,
      departmentResolutionStatus: 'resolved_by_id',
      status: 'Present',
      markedBy: officerAlpha._id,
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.attendanceRecords).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
    expect(inDb.deletionState).toBe('open');
    expect(inDb.deletionToken).toBeNull();
  });

  // =========================================================================
  // TEST 21: INACTIVE DEPARTMENT WITH STUDENTPROFILE DEPENDENCIES IS NOT DELETED
  // =========================================================================
  test('21. Inactive department with StudentProfile dependencies is not deleted', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Inactive Student Dept',
      code: 'INACT_STU',
      isActive: false,
    });

    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      departmentId: dept._id,
      department: dept.name,
      rollNumber: 'STU_INACT_001',
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.studentProfiles).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
    expect(inDb.deletionState).toBe('open');
    expect(inDb.deletionToken).toBeNull();
  });

  // =========================================================================
  // TEST 22: INACTIVE DEPARTMENT WITH PLACEMENTOUTCOME DEPENDENCIES IS NOT DELETED
  // =========================================================================
  test('22. Inactive department with PlacementOutcome dependencies is not deleted', async () => {
    const dept = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Inactive Outcome Dept',
      code: 'INACT_OUT',
      isActive: false,
    });

    await PlacementOutcome.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: appAlpha._id,
      company: companyAlpha._id,
      status: 'verified',
      departmentSnapshot: {
        departmentId: dept._id,
        departmentName: dept.name,
        departmentCode: dept.code,
        resolutionStatus: 'resolved_by_id',
      },
      verifiedBy: officerAlpha._id,
      verifiedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/officer/departments/${dept._id}`)
      .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
    expect(res.body.details.placementOutcomes).toBe(1);

    const inDb = await Department.findById(dept._id);
    expect(inDb).not.toBeNull();
    expect(inDb.deletionState).toBe('open');
    expect(inDb.deletionToken).toBeNull();
  });
});
