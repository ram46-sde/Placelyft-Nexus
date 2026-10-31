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
const Company = require('../models/Company');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('CPMS Phase 2: Department-wise Drive Attendance Tests', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, unverifiedOfficer, studentAlpha, studentBeta, studentGamma, studentDelta, recruiterUser;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenUnverifiedOfficer, tokenStudentAlpha, tokenRecruiter;
  let deptCseAlpha, deptEceAlpha;
  let companyAlpha;
  let driveAlpha, driveBeta, archivedDriveAlpha;
  let appAlpha1, appAlpha2, appAlpha3, appBeta1;

  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'attendance_test_secret_32_chars_long!';
    await connectTestDb();
    // Build indexes in isolated test database
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
      email: 'bob@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentGamma = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentDelta = await User.create({
      name: 'David Cross',
      email: 'david@betacollege.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    recruiterUser = await User.create({
      name: 'Recruiter Rick',
      email: 'rick@techcorp.com',
      password: 'password123',
      role: 'recruiter',
      isActive: true,
    });

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);
    tokenUnverifiedOfficer = generateToken(unverifiedOfficer);
    tokenStudentAlpha = generateToken(studentAlpha);
    tokenRecruiter = generateToken(recruiterUser);

    // 3. Departments
    deptCseAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      aliases: ['CS', 'CompSci'],
      isActive: true,
    });

    deptEceAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Electronics and Communication',
      code: 'ECE',
      aliases: ['EC'],
      isActive: true,
    });

    // 4. Student Profiles
    // Alice: CSE by departmentId
    await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS001',
      departmentId: deptCseAlpha._id,
      department: 'Computer Science',
      cgpa: 8.5,
    });

    // Bob: ECE by free-text alias
    await StudentProfile.create({
      user: studentBeta._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'EC002',
      department: 'EC',
      cgpa: 7.8,
    });

    // Charlie: Unassigned / unknown department
    await StudentProfile.create({
      user: studentGamma._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'UNK003',
      department: 'Astrophysics & Robotics',
      cgpa: 9.0,
    });

    // David: Beta college student
    await StudentProfile.create({
      user: studentDelta._id,
      collegeId: collegeBeta._id,
      rollNumber: 'BETA001',
      department: 'Mechanical',
      cgpa: 7.2,
    });

    // 5. Company & Drives
    companyAlpha = await Company.create({
      name: 'Acme Corp',
      location: 'Bangalore',
      website: 'https://acme.com',
    });

    driveAlpha = await PlacementDrive.create({
      collegeId: collegeAlpha._id,
      company: companyAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Full stack development',
      companyLocation: 'Bangalore',
      driveDate: new Date('2026-12-15'),
      registrationDeadline: new Date('2026-12-10'),
      isActive: true,
      isArchived: false,
    });

    archivedDriveAlpha = await PlacementDrive.create({
      collegeId: collegeAlpha._id,
      company: companyAlpha._id,
      jobRole: 'Data Analyst',
      jobDescription: 'Analytics role',
      companyLocation: 'Bangalore',
      driveDate: new Date('2026-12-20'),
      registrationDeadline: new Date('2026-12-18'),
      isActive: false,
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: officerAlpha._id,
    });

    driveBeta = await PlacementDrive.create({
      collegeId: collegeBeta._id,
      company: companyAlpha._id,
      jobRole: 'QA Engineer',
      jobDescription: 'Automation testing',
      companyLocation: 'Hyderabad',
      driveDate: new Date('2026-12-25'),
      registrationDeadline: new Date('2026-12-22'),
      isActive: true,
      isArchived: false,
    });

    // 6. Applications
    appAlpha1 = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    appAlpha2 = await DriveApplication.create({
      student: studentBeta._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
    });

    appAlpha3 = await DriveApplication.create({
      student: studentGamma._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    appBeta1 = await DriveApplication.create({
      student: studentDelta._id,
      placementDrive: driveBeta._id,
      collegeId: collegeBeta._id,
      status: 'Applied',
    });
  });

  describe('1. GET /api/officer/drives/:id/attendance (Listing & Department Grouping)', () => {
    it('groups applicants by resolver and assigns unmarked applicants to Pending without DB writes', async () => {
      const initialAttendanceCount = await DriveAttendance.countDocuments();

      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toEqual({
        totalApplicants: 3,
        present: 0,
        absent: 0,
        pending: 3,
      });

      // Assert zero database writes during GET
      const afterAttendanceCount = await DriveAttendance.countDocuments();
      expect(afterAttendanceCount).toBe(initialAttendanceCount);

      // Verify department groups: CSE, ECE, and Unassigned / Other
      const depts = res.body.departments;
      expect(depts.length).toBe(3);

      const cseGroup = depts.find((d) => d.departmentName === deptCseAlpha.name);
      expect(cseGroup).toBeDefined();
      expect(cseGroup.totals).toEqual({ total: 1, present: 0, absent: 0, pending: 1 });
      expect(cseGroup.applicants[0].studentName).toBe('Alice Smith');
      expect(cseGroup.applicants[0].rollNumber).toBe('CS001');
      expect(cseGroup.applicants[0].status).toBe('Pending');

      const eceGroup = depts.find((d) => d.departmentName === deptEceAlpha.name);
      expect(eceGroup).toBeDefined();
      expect(eceGroup.totals).toEqual({ total: 1, present: 0, absent: 0, pending: 1 });
      expect(eceGroup.applicants[0].studentName).toBe('Bob Jones');
      expect(eceGroup.applicants[0].status).toBe('Pending');

      const unassignedGroup = depts.find((d) => d.departmentName === 'Unassigned / Other');
      expect(unassignedGroup).toBeDefined();
      expect(unassignedGroup.totals).toEqual({ total: 1, present: 0, absent: 0, pending: 1 });
      expect(unassignedGroup.applicants[0].studentName).toBe('Charlie Brown');
      expect(unassignedGroup.applicants[0].status).toBe('Pending');
    });

    it('works for archived drives (read-only access to attendance history)', async () => {
      // Create an application on archived drive
      const archivedApp = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: archivedDriveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      // Seed an attendance record directly
      await DriveAttendance.create({
        collegeId: collegeAlpha._id,
        placementDrive: archivedDriveAlpha._id,
        student: studentAlpha._id,
        application: archivedApp._id,
        departmentName: 'Computer Science and Engineering',
        departmentResolutionStatus: 'resolved_by_id',
        status: 'Present',
        markedBy: officerAlpha._id,
        markedAt: new Date(),
        markedOnBehalfOf: 'HOD',
        history: [
          {
            action: 'MARK_ATTENDANCE',
            oldStatus: 'Pending',
            newStatus: 'Present',
            changedBy: officerAlpha._id,
            changedAt: new Date(),
            onBehalfOf: 'HOD',
          },
        ],
      });

      const res = await request(app)
        .get(`/api/officer/drives/${archivedDriveAlpha._id}/attendance?includeHistory=true`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.drive.isArchived).toBe(true);
      expect(res.body.summary.present).toBe(1);

      const applicant = res.body.departments[0].applicants[0];
      expect(applicant.status).toBe('Present');
      expect(applicant.history.length).toBe(1);
      expect(applicant.history[0].newStatus).toBe('Present');
    });

    it('excludes withdrawn/cancelled-type applications from attendance roster', async () => {
      const studentWithdrawn = await User.create({
        name: 'Withdrawn Student',
        email: 'withdrawn@alphatech.edu',
        password: 'password123',
        role: 'student',
        collegeId: collegeAlpha._id,
        collegeAssignmentStatus: 'VERIFIED',
        isActive: true,
      });

      // Insert directly using raw MongoDB driver to simulate a Withdrawn application
      await mongoose.connection.db.collection('driveapplications').insertOne({
        student: studentWithdrawn._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Withdrawn',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      // Withdrawn application must not appear in total count (remains 3 active applications)
      expect(res.body.summary.totalApplicants).toBe(3);
    });

    it('guarantees zero leakage of forbidden sensitive keys', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance?includeHistory=true`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      const jsonString = JSON.stringify(res.body);

      // Verify forbidden personal attributes are strictly absent
      expect(jsonString).not.toMatch(/"email"/i);
      expect(jsonString).not.toMatch(/"password"/i);
      expect(jsonString).not.toMatch(/"phone"/i);
      expect(jsonString).not.toMatch(/"cgpa"/i);
      expect(jsonString).not.toMatch(/"resume"/i);
    });
  });

  describe('2. POST /api/officer/drives/:id/attendance/mark (Core Mutations & Concurrency)', () => {
    it('marks attendance (Present, Absent, Pending->Present->Absent) and builds audit history chain', async () => {
      // 1. Initial mark: Present
      const mark1 = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Present' }],
        });

      expect(mark1.status).toBe(200);
      expect(mark1.body.results[0]).toEqual({
        applicationId: appAlpha1._id.toString(),
        result: 'created',
        status: 'Present',
      });

      let record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.status).toBe('Present');
      expect(record.departmentName).toBe(deptCseAlpha.name);
      expect(record.markedOnBehalfOf).toBe('HOD');
      expect(record.history.length).toBe(1);
      expect(record.history[0].oldStatus).toBe('Pending');
      expect(record.history[0].newStatus).toBe('Present');
      expect(record.history[0].onBehalfOf).toBe('HOD');

      // 2. Second mark: Absent
      const mark2 = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Absent' }],
        });

      expect(mark2.status).toBe(200);
      expect(mark2.body.results[0]).toEqual({
        applicationId: appAlpha1._id.toString(),
        result: 'changed',
        status: 'Absent',
      });

      record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.status).toBe('Absent');
      expect(record.history.length).toBe(2);
      expect(record.history[1].oldStatus).toBe('Present');
      expect(record.history[1].newStatus).toBe('Absent');

      // 3. Identical re-mark: Absent (should result in 'unchanged' without new history)
      const mark3 = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Absent' }],
        });

      expect(mark3.status).toBe(200);
      expect(mark3.body.results[0]).toEqual({
        applicationId: appAlpha1._id.toString(),
        result: 'unchanged',
        status: 'Absent',
      });

      record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.history.length).toBe(2); // History length did not change
    });

    it('enforces history chain invariant (oldStatus equals previous newStatus, length monotonically non-decreasing)', async () => {
      const transitions = ['Present', 'Absent', 'Pending', 'Present'];

      for (const st of transitions) {
        await request(app)
          .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({
            entries: [{ applicationId: appAlpha1._id, status: st }],
          });
      }

      const record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.history.length).toBe(4);

      for (let i = 1; i < record.history.length; i++) {
        const prev = record.history[i - 1];
        const curr = record.history[i];
        expect(curr.oldStatus).toBe(prev.newStatus);
      }
    });

    it('handles 10 parallel first-mark requests producing exactly 1 record and 1 history entry', async () => {
      const parallelRequests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
            .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
            .send({
              entries: [{ applicationId: appAlpha2._id, status: 'Present' }],
            })
        );

      const responses = await Promise.all(parallelRequests);
      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Verify DB state: exactly ONE document in collection
      const docs = await DriveAttendance.find({ application: appAlpha2._id });
      expect(docs.length).toBe(1);
      expect(docs[0].status).toBe('Present');
      expect(docs[0].history.length).toBe(1);
    });

    it('concurrent identical status updates do not create duplicate history entries', async () => {
      // 1. Initial mark to Present
      await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ entries: [{ applicationId: appAlpha1._id, status: 'Present' }] });

      let record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.history.length).toBe(1);

      // 2. Fire 5 concurrent requests all setting status to 'Present' (identical to current)
      const identicalRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
            .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
            .send({ entries: [{ applicationId: appAlpha1._id, status: 'Present' }] })
        );

      const responses = await Promise.all(identicalRequests);
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.results[0].result).toBe('unchanged');
      });

      // Verify history was not duplicated
      record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.history.length).toBe(1);
    });

    it('handles parallel conflicting marks (Present vs Absent): valid final state and history chain', async () => {
      const conflictingRequests = [
        request(app)
          .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ entries: [{ applicationId: appAlpha3._id, status: 'Present' }] }),
        request(app)
          .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ entries: [{ applicationId: appAlpha3._id, status: 'Absent' }] }),
        request(app)
          .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
          .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
          .send({ entries: [{ applicationId: appAlpha3._id, status: 'Present' }] }),
      ];

      const responses = await Promise.all(conflictingRequests);
      responses.forEach((res) => expect(res.status).toBe(200));

      const docs = await DriveAttendance.find({ application: appAlpha3._id });
      expect(docs.length).toBe(1);
      expect(['Present', 'Absent']).toContain(docs[0].status);

      // Verify chain invariant on history
      const history = docs[0].history;
      for (let i = 1; i < history.length; i++) {
        expect(history[i].oldStatus).toBe(history[i - 1].newStatus);
      }
    });

    it('pending on an unmarked applicant creates nothing (noop)', async () => {
      const res = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Pending' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0]).toEqual({
        applicationId: appAlpha1._id.toString(),
        result: 'noop',
        status: 'Pending',
      });

      const count = await DriveAttendance.countDocuments({ application: appAlpha1._id });
      expect(count).toBe(0);
    });

    it('rejects entire batch if one entry is invalid (all-or-nothing validation)', async () => {
      const fakeAppId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [
            { applicationId: appAlpha1._id, status: 'Present' },
            { applicationId: fakeAppId, status: 'Present' }, // Non-existent
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_APPLICATION_IN_BATCH');

      // Verify appAlpha1 was NOT marked
      const count = await DriveAttendance.countDocuments({ application: appAlpha1._id });
      expect(count).toBe(0);
    });

    it('rejects batch containing duplicate applicationIds with 400', async () => {
      const res = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [
            { applicationId: appAlpha1._id, status: 'Present' },
            { applicationId: appAlpha1._id, status: 'Absent' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/duplicate applicationId/i);
    });

    it('rejects batch exceeding 200 entries cap with 400', async () => {
      const largeBatch = Array(201)
        .fill(null)
        .map(() => ({
          applicationId: new mongoose.Types.ObjectId(),
          status: 'Present',
        }));

      const res = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ entries: largeBatch });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds maximum limit of 200/i);
    });

    it('returns identical response for non-existent app or app from another drive/college', async () => {
      // App belonging to Beta college drive
      const resCrossDrive = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appBeta1._id, status: 'Present' }],
        });

      // Completely non-existent app
      const resNonExistent = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: new mongoose.Types.ObjectId(), status: 'Present' }],
        });

      expect(resCrossDrive.status).toBe(400);
      expect(resNonExistent.status).toBe(400);
      expect(resCrossDrive.body).toEqual(resNonExistent.body);
    });

    it('ignores client-supplied collegeId, markedBy, history, student, onBehalfOf', async () => {
      const fakeOfficerId = new mongoose.Types.ObjectId();
      const fakeStudentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          collegeId: collegeBeta._id, // Attempt tenant hijack
          markedBy: fakeOfficerId,
          markedOnBehalfOf: 'SUPER_USER',
          history: [{ action: 'HACK', oldStatus: 'Present', newStatus: 'Absent' }],
          student: fakeStudentId,
          entries: [{ applicationId: appAlpha1._id, status: 'Present' }],
        });

      expect(res.status).toBe(200);

      const record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(record.markedBy.toString()).toBe(officerAlpha._id.toString());
      expect(record.markedOnBehalfOf).toBe('HOD');
      expect(record.student.toString()).toBe(studentAlpha._id.toString());
      expect(record.history[0].action).toBe('MARK_ATTENDANCE');
    });

    it('blocks marking on archived drive with 409 DRIVE_ARCHIVED', async () => {
      const appOnArchived = await DriveApplication.create({
        student: studentAlpha._id,
        placementDrive: archivedDriveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .post(`/api/officer/drives/${archivedDriveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appOnArchived._id, status: 'Present' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DRIVE_ARCHIVED');
    });

    it('department snapshot is not refreshed when department is later renamed or aliased', async () => {
      // 1. Initial mark
      await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Present' }],
        });

      let record = await DriveAttendance.findOne({ application: appAlpha1._id });
      expect(record.departmentName).toBe('Computer Science and Engineering');

      // 2. Rename department in DB
      deptCseAlpha.name = 'School of Advanced Computing and AI';
      await deptCseAlpha.save();

      // 3. Mark again (Absent)
      await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Absent' }],
        });

      record = await DriveAttendance.findOne({ application: appAlpha1._id });
      // Snapshot must NOT be refreshed
      expect(record.departmentName).toBe('Computer Science and Engineering');
    });
  });

  describe('3. Authorization & Tenant Security Gates', () => {
    it('cross-college GET and marking are rejected with 404 (does not leak existence)', async () => {
      // Officer Beta tries to access Drive Alpha
      const getRes = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.message).toMatch(/placement drive not found/i);

      const postRes = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Present' }],
        });

      expect(postRes.status).toBe(404);
      expect(postRes.body.message).toMatch(/placement drive not found/i);
    });

    it('student and recruiter roles are rejected with 403', async () => {
      const resStudent = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(resStudent.status).toBe(403);

      const resRecruiter = await request(app)
        .post(`/api/officer/drives/${driveAlpha._id}/attendance/mark`)
        .set('Authorization', `Bearer ${tokenRecruiter}`)
        .send({
          entries: [{ applicationId: appAlpha1._id, status: 'Present' }],
        });
      expect(resRecruiter.status).toBe(403);
    });

    it('unverified placement officer is rejected with 403', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/attendance`)
        .set('Authorization', `Bearer ${tokenUnverifiedOfficer}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/unverified college status/i);
    });
  });

  describe('4. Deletion Safeguard & Dependent Protection', () => {
    it('permanent delete is blocked with 409 if any attendance record exists', async () => {
      // Create an empty drive that is archived
      const emptyArchivedDrive = await PlacementDrive.create({
        collegeId: collegeAlpha._id,
        company: companyAlpha._id,
        jobRole: 'Intern',
        jobDescription: 'Internship',
        companyLocation: 'Bangalore',
        driveDate: new Date('2026-12-10'),
        registrationDeadline: new Date('2026-12-05'),
        isActive: false,
        isArchived: true,
      });

      // Put an attendance record on it
      await DriveAttendance.create({
        collegeId: collegeAlpha._id,
        placementDrive: emptyArchivedDrive._id,
        student: studentAlpha._id,
        application: new mongoose.Types.ObjectId(),
        departmentName: 'Computer Science and Engineering',
        departmentResolutionStatus: 'resolved_by_id',
        status: 'Pending',
        markedBy: officerAlpha._id,
        markedAt: new Date(),
        markedOnBehalfOf: 'HOD',
      });

      const res = await request(app)
        .delete(`/api/officer/drives/${emptyArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DRIVE_DELETE_BLOCKED_DEPENDENT_RECORDS');
      expect(res.body.message).toMatch(/attendance record/i);
      expect(res.body.message).toMatch(/recommend keeping the drive archived/i);
    });

    it('allows permanent delete for an archived drive with zero dependent records', async () => {
      const cleanArchivedDrive = await PlacementDrive.create({
        collegeId: collegeAlpha._id,
        company: companyAlpha._id,
        jobRole: 'Temporary Role',
        jobDescription: 'No applicants',
        companyLocation: 'Bangalore',
        driveDate: new Date('2026-12-10'),
        registrationDeadline: new Date('2026-12-05'),
        isActive: false,
        isArchived: true,
      });

      const res = await request(app)
        .delete(`/api/officer/drives/${cleanArchivedDrive._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/permanently deleted/i);
    });
  });
});
