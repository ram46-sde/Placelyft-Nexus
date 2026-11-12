const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Department = require('../models/Department');
const College = require('../models/College');
const User = require('../models/User');
const DriveAttendance = require('../models/DriveAttendance');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const StudentProfile = require('../models/StudentProfile');
const PlacementOutcome = require('../models/PlacementOutcome');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('CPMS Stage 2: Department CRUD APIs Tests', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, studentAlpha, recruiterUser;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenStudentAlpha, tokenRecruiter;
  let deptCseAlpha, deptEceAlpha;
  let driveAlpha, applicationAlpha, attendanceAlpha;

  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dept_mgmt_crud_test_secret_32_chars_long!';
    await connectTestDb();
    await Department.createIndexes();
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

    studentAlpha = await User.create({
      name: 'Student Alpha',
      email: 'student.alpha@alphatech.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    recruiterUser = await User.create({
      name: 'Recruiter Bob',
      email: 'bob@techcorp.com',
      password: 'password123',
      role: 'recruiter',
      isActive: true,
    });

    tokenOfficerAlpha = generateToken(officerAlpha);
    tokenOfficerBeta = generateToken(officerBeta);
    tokenStudentAlpha = generateToken(studentAlpha);
    tokenRecruiter = generateToken(recruiterUser);

    // 3. Baseline Departments in College Alpha
    deptCseAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      aliases: ['CS', 'CompSci'],
      isActive: true,
      hodContact: {
        name: 'Dr. Alan Turing',
        email: 'hod.cse@alphatech.edu',
        phone: '+91 9876543210',
        officeLocation: 'Block A, Room 101',
      },
    });

    deptEceAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      aliases: ['Electronics'],
      isActive: true,
    });

    // 4. Drive & Attendance record for historical immutability check
    driveAlpha = await PlacementDrive.create({
      collegeId: collegeAlpha._id,
      company: new mongoose.Types.ObjectId(),
      jobRole: 'Software Engineer',
      jobDescription: 'Full-stack developer role with competitive compensation package.',
      salary: 1200000,
      driveDate: new Date(Date.now() + 86400000 * 5),
      registrationDeadline: new Date(Date.now() + 86400000 * 2),
      status: 'active',
      isActive: true,
      isArchived: false,
    });

    applicationAlpha = await DriveApplication.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      status: 'Applied',
    });

    attendanceAlpha = await DriveAttendance.create({
      collegeId: collegeAlpha._id,
      placementDrive: driveAlpha._id,
      student: studentAlpha._id,
      application: applicationAlpha._id,
      departmentId: deptCseAlpha._id,
      departmentName: deptCseAlpha.name,
      departmentResolutionStatus: 'resolved_by_name',
      status: 'Present',
      markedBy: officerAlpha._id,
      markedAt: new Date(),
      markedOnBehalfOf: 'HOD',
      history: [
        {
          action: 'STATUS_CHANGE',
          oldStatus: 'Pending',
          newStatus: 'Present',
          changedBy: officerAlpha._id,
          changedAt: new Date(),
          onBehalfOf: 'HOD',
        },
      ],
    });
  });

  // ─── 1. Department Creation ────────────────────────────────────────────────
  describe('1. POST /api/officer/departments (Creation)', () => {
    it('1. Authorized placement officer can create a department', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Mechanical Engineering',
          code: 'MECH',
          aliases: ['Mechanical', 'Mech Engg'],
          hodContact: {
            name: 'Dr. James Watt',
            email: 'hod.mech@alphatech.edu',
            phone: '+91 9123456780',
            officeLocation: 'Block B, Room 201',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.department).toBeDefined();
      expect(res.body.department.name).toBe('Mechanical Engineering');
      expect(res.body.department.code).toBe('MECH');
      expect(res.body.department.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(res.body.department.aliases).toEqual(['Mechanical', 'Mech Engg']);
      expect(res.body.department.hodContact.name).toBe('Dr. James Watt');
      expect(res.body.department.isActive).toBe(true);
      expect(res.body.department.isCustom).toBe(true);

      // Verify persistence in DB
      const persisted = await Department.findById(res.body.department._id);
      expect(persisted).not.toBeNull();
      expect(persisted.name).toBe('Mechanical Engineering');
    });

    it('2. Missing required name is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          code: 'CIVIL',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/name is required/i);
    });

    it('3. Missing required code is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Civil Engineering',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/code is required/i);
    });

    it('4. Duplicate department name is rejected within the same college', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Computer Science and Engineering', // exact duplicate of deptCseAlpha
          code: 'CS_NEW',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/name already exists in this college/i);
    });

    it('5. Duplicate department code is rejected within the same college', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Cyber Security Engineering',
          code: 'CSE', // duplicate code of deptCseAlpha
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/code already exists in this college/i);
    });

    it('6. Duplicate alias is rejected within the same college', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Information Technology',
          code: 'IT',
          aliases: ['CS'], // 'CS' already belongs to deptCseAlpha
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already used by department/i);
    });

    it('7. Case and whitespace variants are detected as duplicates', async () => {
      // 7a. Name case/whitespace variant
      const resName = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: '  computer science  and  engineering  ',
          code: 'CS_TEST',
        });

      expect(resName.status).toBe(400);
      expect(resName.body.message).toMatch(/name already exists/i);

      // 7b. Code case/whitespace variant
      const resCode = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Different Department',
          code: '  cse  ',
        });

      expect(resCode.status).toBe(400);
      expect(resCode.body.message).toMatch(/code already exists/i);
    });

    it("8. Officer cannot create a department using another college's ID from the request body", async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Biotechnology Engineering',
          code: 'BIOTECH',
          collegeId: collegeBeta._id.toString(), // Attacker attempts to forge college Beta
        });

      // Must be rejected with 400
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify no department was created in College Beta
      const inBeta = await Department.findOne({ code: 'BIOTECH', collegeId: collegeBeta._id });
      expect(inBeta).toBeNull();
    });
  });

  // ─── 2. Department Update ──────────────────────────────────────────────────
  describe('2. PUT /api/officer/departments/:id (Update)', () => {
    it("9. Officer can update their own college's department", async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Computer Science and Artificial Intelligence',
          code: 'CSAI',
          aliases: ['CS-AI', 'AI-CS'],
          hodContact: {
            name: 'Dr. John von Neumann',
            email: 'hod.csai@alphatech.edu',
            phone: '+91 9988776655',
            officeLocation: 'Block C, Room 303',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.department.name).toBe('Computer Science and Artificial Intelligence');
      expect(res.body.department.code).toBe('CSAI');
      expect(res.body.department.aliases).toEqual(['CS-AI', 'AI-CS']);
      expect(res.body.department.hodContact.name).toBe('Dr. John von Neumann');

      // Verify persistence in DB
      const updated = await Department.findById(deptCseAlpha._id);
      expect(updated.name).toBe('Computer Science and Artificial Intelligence');
      expect(updated.code).toBe('CSAI');
    });

    it("10. Officer cannot update another college's department (returns 404)", async () => {
      // Officer Beta tries to update Officer Alpha's department
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({
          name: 'Hijacked Department Name',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/department not found/i);

      // Verify DB was NOT mutated
      const unchanged = await Department.findById(deptCseAlpha._id);
      expect(unchanged.name).toBe('Computer Science and Engineering');
    });

    it('Attempt to modify protected fields like collegeId or _id returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          collegeId: collegeBeta._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot modify protected field/i);
    });
  });

  // ─── 3. Safe Permanent Deletion ───────────────────────────────────────────
  describe('3. DELETE /api/officer/departments/:id (Safe Permanent Deletion)', () => {
    it('1. Officer can delete a department with no references', async () => {
      // deptEceAlpha has no references (no attendance, no student profile, no placement outcome)
      const res = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/permanently deleted/i);
    });

    it('2. Deleted document no longer exists in MongoDB', async () => {
      await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      const inDb = await Department.findById(deptEceAlpha._id);
      expect(inDb).toBeNull();
    });

    it('3. Its code can be reused after successful deletion', async () => {
      // Delete ECE department
      await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      // Recreate a new department with the same code 'ECE'
      const recreateRes = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Electronics and Communication Engineering New',
          code: 'ECE',
        });

      expect(recreateRes.status).toBe(201);
      expect(recreateRes.body.success).toBe(true);
      expect(recreateRes.body.department.code).toBe('ECE');
    });

    it('4. Its name can be reused after successful deletion', async () => {
      // Delete ECE department
      await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      // Recreate with exact same name
      const recreateRes = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Electronics and Communication Engineering',
          code: 'ECE_NEW',
        });

      expect(recreateRes.status).toBe(201);
      expect(recreateRes.body.success).toBe(true);
      expect(recreateRes.body.department.name).toBe('Electronics and Communication Engineering');
    });

    it('5. Its aliases can be reused after successful deletion', async () => {
      // Create a dept with aliases 'ROBOT', 'MECH-ROBOT'
      const robotDept = await Department.create({
        collegeId: collegeAlpha._id,
        name: 'Robotics Engineering',
        code: 'ROBOT',
        aliases: ['ROBOT', 'MECH-ROBOT'],
        isActive: true,
      });

      // Delete it
      const delRes = await request(app)
        .delete(`/api/officer/departments/${robotDept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);
      expect(delRes.status).toBe(200);

      // Recreate another dept using the same alias 'MECH-ROBOT'
      const recreateRes = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Mechatronics Engineering',
          code: 'MTRX',
          aliases: ['MECH-ROBOT'],
        });

      expect(recreateRes.status).toBe(201);
      expect(recreateRes.body.success).toBe(true);
      expect(recreateRes.body.department.aliases).toContain('MECH-ROBOT');
    });

    it('6. Department with attendance history returns 409', async () => {
      // deptCseAlpha has attendanceAlpha referencing it
      const res = await request(app)
        .delete(`/api/officer/departments/${deptCseAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DEPARTMENT_DELETE_BLOCKED_DEPENDENT_RECORDS');
      expect(res.body.message).toMatch(/historical records cannot be deleted/i);
    });

    it('7. Historical attendance remains unchanged after blocked deletion', async () => {
      // Attempt to delete deptCseAlpha
      await request(app)
        .delete(`/api/officer/departments/${deptCseAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      // Verify attendanceAlpha record is completely preserved
      const attRecord = await DriveAttendance.findById(attendanceAlpha._id);
      expect(attRecord).not.toBeNull();
      expect(attRecord.departmentName).toBe('Computer Science and Engineering');
      expect(attRecord.departmentId.toString()).toBe(deptCseAlpha._id.toString());
      expect(attRecord.status).toBe('Present');
      expect(attRecord.history).toHaveLength(1);
    });

    it('8. Department with another dependent record returns 409 (StudentProfile & PlacementOutcome)', async () => {
      // 8a. Department with StudentProfile referencing departmentId
      const mechDept = await Department.create({
        collegeId: collegeAlpha._id,
        name: 'Mechanical Engineering',
        code: 'MECH',
        isActive: true,
      });

      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        departmentId: mechDept._id,
        department: 'Mechanical Engineering',
      });

      const resStudentDep = await request(app)
        .delete(`/api/officer/departments/${mechDept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(resStudentDep.status).toBe(409);
      expect(resStudentDep.body.message).toMatch(/student profile\(s\)/i);

      // 8b. Department with PlacementOutcome referencing departmentId
      const civilDept = await Department.create({
        collegeId: collegeAlpha._id,
        name: 'Civil Engineering',
        code: 'CIVIL',
        isActive: true,
      });

      await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha._id,
        student: studentAlpha._id,
        application: applicationAlpha._id,
        status: 'verified',
        offerPackage: { ctc: 850000 },
        departmentSnapshot: {
          departmentId: civilDept._id,
          departmentName: 'Civil Engineering',
          departmentCode: 'CIVIL',
          resolutionStatus: 'resolved_by_code',
        },
        verifiedBy: officerAlpha._id,
        history: [{
          action: 'verified',
          oldStatus: null,
          newStatus: 'verified',
          changedBy: officerAlpha._id,
          changedAt: new Date(),
        }],
      });

      const resOutcomeDep = await request(app)
        .delete(`/api/officer/departments/${civilDept._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(resOutcomeDep.status).toBe(409);
      expect(resOutcomeDep.body.message).toMatch(/placement outcome\(s\)/i);
    });

    it("9. Cross-college deletion returns 404", async () => {
      // Officer Beta tries to delete Officer Alpha's department
      const res = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify department still exists in MongoDB
      const dept = await Department.findById(deptEceAlpha._id);
      expect(dept).not.toBeNull();
    });

    it('12. Repeated deletion returns 404', async () => {
      // First deletion succeeds
      const firstRes = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);
      expect(firstRes.status).toBe(200);

      // Second deletion returns 404
      const secondRes = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);
      expect(secondRes.status).toBe(404);
    });
  });

  // ─── 4. Security & Role Authorization ──────────────────────────────────────
  describe('4. Security & Role Authorization Gates', () => {
    it('10. Non-officer receives 403 on DELETE', async () => {
      // Student attempt
      const resStudent = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(resStudent.status).toBe(403);

      // Recruiter attempt
      const resRecruiter = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`)
        .set('Authorization', `Bearer ${tokenRecruiter}`);

      expect(resRecruiter.status).toBe(403);
    });

    it('11. Unauthenticated request receives 401 on DELETE', async () => {
      const res = await request(app)
        .delete(`/api/officer/departments/${deptEceAlpha._id}`);

      expect(res.status).toBe(401);
    });
    it('13. Non-officer (Student or Recruiter) receives 403 Forbidden', async () => {
      // Student attempt
      const resStudent = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({ name: 'Hacked Dept', code: 'HACK' });

      expect(resStudent.status).toBe(403);

      // Recruiter attempt
      const resRecruiter = await request(app)
        .post('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenRecruiter}`)
        .send({ name: 'Hacked Dept', code: 'HACK' });

      expect(resRecruiter.status).toBe(403);
    });

    it('14. Unauthenticated request receives 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/officer/departments')
        .send({ name: 'Unauthorized Dept', code: 'UNAUTH' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. Backward Compatibility for Existing APIs ──────────────────────────
  describe('5. Backward Compatibility', () => {
    it('15. Existing HOD-contact API remains functional', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Prof. Ada Lovelace',
          email: 'ada.lovelace@alphatech.edu',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.department.hodContact.name).toBe('Prof. Ada Lovelace');
      expect(res.body.department.hodContact.email).toBe('ada.lovelace@alphatech.edu');
    });

    it('16. Existing aliases API remains functional', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          aliases: ['CS-Core', 'Computing'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.department.aliases).toEqual(['CS-Core', 'Computing']);
    });
  });
});

