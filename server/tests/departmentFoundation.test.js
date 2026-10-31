const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Department = require('../models/Department');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { STANDARD_DEPARTMENTS } = require('../config/standardDepartments');
const {
  UNASSIGNED_LABEL,
  normalizeDepartmentKey,
  resolveDepartment,
  fetchCollegeDepartments,
} = require('../utils/departmentResolver');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('CPMS Phase 1: Department Foundation Tests', () => {
  let collegeAlpha, collegeBeta;
  let officerAlpha, officerBeta, studentAlpha, recruiterUser;
  let tokenOfficerAlpha, tokenOfficerBeta, tokenStudentAlpha, tokenRecruiter;
  let deptCseAlpha, deptEceAlpha, deptMechAlpha;
  let deptCseBeta;

  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_length_key',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dept_foundation_test_secret_32_chars_long!';
    await connectTestDb();
    // Explicitly build indexes in isolated test database
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

    // 3. Departments in College Alpha
    deptCseAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
    });

    deptEceAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      isActive: true,
    });

    deptMechAlpha = await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Mechanical Engineering',
      code: 'MECH',
      isActive: false, // Inactive department
    });

    // 4. Department in College Beta
    deptCseBeta = await Department.create({
      collegeId: collegeBeta._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
    });
  });

  describe('1. API Access & Multi-Tenant Authorization', () => {
    it('Officer Alpha lists only active departments of College Alpha', async () => {
      const res = await request(app)
        .get('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2); // Only CSE and ECE (active). MECH is inactive.

      const names = res.body.departments.map((d) => d.name);
      expect(names).toContain('Computer Science and Engineering');
      expect(names).toContain('Electronics and Communication Engineering');
      expect(names).not.toContain('Mechanical Engineering');

      // Verify no College Beta departments leak
      const betaIds = res.body.departments.map((d) => d._id);
      expect(betaIds).not.toContain(deptCseBeta._id.toString());
    });

    it('Cross-college GET is blocked (Beta officer cannot access Alpha departments)', async () => {
      const res = await request(app)
        .get('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenOfficerBeta}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.departments[0]._id.toString()).toBe(deptCseBeta._id.toString());
    });

    it('Cross-college HOD contact PUT is rejected with 404 (does not leak existence)', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ name: 'Hacked HOD' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found.');
    });

    it('Cross-college aliases PUT is rejected with 404', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ aliases: ['comp-sci'] });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found.');
    });

    it('Non-officer roles are rejected with 403', async () => {
      // Student
      const resStudent = await request(app)
        .get('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);
      expect(resStudent.status).toBe(403);

      // Recruiter
      const resRecruiter = await request(app)
        .get('/api/officer/departments')
        .set('Authorization', `Bearer ${tokenRecruiter}`);
      expect(resRecruiter.status).toBe(403);

      // Unauthenticated
      const resUnauth = await request(app).get('/api/officer/departments');
      expect(resUnauth.status).toBe(401);
    });

    it('Body collegeId parameter is ignored and tenant comes strictly from req.user', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          collegeId: collegeBeta._id, // Malicious override attempt
          name: 'Dr. Alan Turing',
          email: 'turing@alphatech.edu',
        });

      expect(res.status).toBe(200);
      const updated = await Department.findById(deptCseAlpha._id);
      expect(updated.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(updated.hodContact.name).toBe('Dr. Alan Turing');
    });

    it('Returns 400 for malformed department ObjectId format', async () => {
      const res = await request(app)
        .put('/api/officer/departments/invalid-id-123/hod-contact')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ name: 'Dr. Test' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid department ID format.');
    });
  });

  describe('2. HOD Contact Operations & Whitelist Guarantees', () => {
    it('Creates and updates HOD contact with all 4 fields', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Dr. Grace Hopper',
          email: 'GRACE.HOPPER@alphatech.edu',
          phone: '+1 (555) 019-2834',
          officeLocation: 'Computing Block, Room 302',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.department.hodContact.name).toBe('Dr. Grace Hopper');
      expect(res.body.department.hodContact.email).toBe('grace.hopper@alphatech.edu'); // Lowercased
      expect(res.body.department.hodContact.phone).toBe('+1 (555) 019-2834');
      expect(res.body.department.hodContact.officeLocation).toBe('Computing Block, Room 302');
    });

    it('Partial update preserves omitted fields', async () => {
      // First populate all 4 fields
      await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Dr. Grace Hopper',
          email: 'grace@alphatech.edu',
          phone: '+1 555-019-2834',
          officeLocation: 'Block A, 101',
        });

      // Update only phone
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          phone: '+1 555-999-8888',
        });

      expect(res.status).toBe(200);
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.hodContact.phone).toBe('+1 555-999-8888');
      expect(doc.hodContact.name).toBe('Dr. Grace Hopper'); // Preserved
      expect(doc.hodContact.email).toBe('grace@alphatech.edu'); // Preserved
      expect(doc.hodContact.officeLocation).toBe('Block A, 101'); // Preserved
    });

    it('Clearing fields via empty string or null succeeds', async () => {
      await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Dr. Grace Hopper',
          email: 'grace@alphatech.edu',
          phone: '+1 555-019-2834',
          officeLocation: 'Block A, 101',
        });

      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: '', // Clear
          officeLocation: null, // Clear
        });

      expect(res.status).toBe(200);
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.hodContact.name).toBeUndefined();
      expect(doc.hodContact.officeLocation).toBeUndefined();
      expect(doc.hodContact.email).toBe('grace@alphatech.edu'); // Intact
      expect(doc.hodContact.phone).toBe('+1 555-019-2834'); // Intact
    });

    it('Rejects invalid email format with field-level 400 error', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          email: 'not-an-email-address',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.email).toBeDefined();
    });

    it('Rejects invalid phone format (fewer than 7 digits or letters)', async () => {
      // Fewer than 7 digits
      const resShort = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ phone: '12345' });
      expect(resShort.status).toBe(400);
      expect(resShort.body.errors.phone).toBeDefined();

      // Letters in phone
      const resLetters = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ phone: '555-CALL-HOD' });
      expect(resLetters.status).toBe(400);
      expect(resLetters.body.errors.phone).toBeDefined();
    });

    it('Body cannot change department name, code or aliases through hod-contact endpoint', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/hod-contact`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          name: 'Hacked Department Name',
          code: 'HACK',
          aliases: ['malicious-alias'],
        });

      expect(res.status).toBe(200);
      const doc = await Department.findById(deptCseAlpha._id);
      // Department identity fields remain strictly unchanged
      expect(doc.name).toBe('Computer Science and Engineering');
      expect(doc.code).toBe('CSE');
      expect(doc.aliases).toEqual([]);
      // "name" was applied only to hodContact.name
      expect(doc.hodContact.name).toBe('Hacked Department Name');
    });
  });

  describe('3. Department Aliases Rules & Collision Prevention', () => {
    it('Saves valid aliases with normalization', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          aliases: ['Comp Sci', 'CS & Engg', 'CS-IT'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.department.aliases).toEqual(['Comp Sci', 'CS & Engg', 'CS-IT']);
    });

    it('Rejects duplicate aliases within the same department (normalized or exact)', async () => {
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          aliases: ['Comp Sci', '  comp sci  '], // Normalized duplicate
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Duplicate alias detected');
    });

    it('Rejects more than 10 aliases per department', async () => {
      const elevenAliases = [
        'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11',
      ];
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: elevenAliases });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 10 aliases');
    });

    it('Rejects alias matching this department own name or code', async () => {
      // Matching own code
      const resCode = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['  cse  '] });

      expect(resCode.status).toBe(400);
      expect(resCode.body.message).toContain("own name or code");

      // Matching own name
      const resName = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['Computer Science & Engineering'] });

      expect(resName.status).toBe(400);
      expect(resName.body.message).toContain("own name or code");
    });

    it('Rejects alias collision with another department name or code in the same college', async () => {
      // Collision with ECE name
      const resName = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['Electronics & Communication Engineering'] });

      expect(resName.status).toBe(400);
      expect(resName.body.message).toContain('conflicts with existing department name');

      // Collision with ECE code
      const resCode = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['ece'] });

      expect(resCode.status).toBe(400);
      expect(resCode.body.message).toContain('conflicts with existing department code');
    });

    it('Rejects alias collision with an INACTIVE department name/code in the same college', async () => {
      // MECH is inactive in College Alpha
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['mech'] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('conflicts with existing department code');
    });

    it('Rejects alias collision with another department existing alias in the same college', async () => {
      // Set alias on ECE
      await request(app)
        .put(`/api/officer/departments/${deptEceAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['Telecom & Engg'] });

      // Try setting same alias on CSE (using 'and' instead of '&')
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['telecom and engg'] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already used by department');
    });

    it('Allows identical alias in a DIFFERENT college', async () => {
      // Set alias on CSE in College Alpha
      await request(app)
        .put(`/api/officer/departments/${deptCseAlpha._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({ aliases: ['CS'] });

      // Set identical alias on CSE in College Beta -> Allowed!
      const res = await request(app)
        .put(`/api/officer/departments/${deptCseBeta._id}/aliases`)
        .set('Authorization', `Bearer ${tokenOfficerBeta}`)
        .send({ aliases: ['CS'] });

      expect(res.status).toBe(200);
      expect(res.body.department.aliases).toEqual(['CS']);
    });
  });

  describe('4. Legacy Document Compatibility', () => {
    it('Pre-existing Department document without new fields loads and saves cleanly', async () => {
      const legacyDept = await Department.create({
        collegeId: collegeAlpha._id,
        name: 'Civil Engineering',
        code: 'CIVIL',
      });

      // Reload
      const loaded = await Department.findById(legacyDept._id);
      expect(loaded).toBeDefined();
      expect(loaded.hodContact).toBeUndefined();
      expect(loaded.aliases).toEqual([]);

      // Save without modifications
      await loaded.save();

      // Add HOD contact to pre-existing document
      loaded.hodContact = { name: 'Dr. John Smeaton' };
      await loaded.save();

      const reloaded = await Department.findById(legacyDept._id);
      expect(reloaded.hodContact.name).toBe('Dr. John Smeaton');
    });
  });

  describe('5. Department Resolver Pure Function Tests', () => {
    let loadedDepartments;

    beforeEach(async () => {
      // Add aliases to Alpha departments
      deptCseAlpha.aliases = ['Comp Sci', 'CS', 'Software Engg'];
      await deptCseAlpha.save();

      deptEceAlpha.aliases = ['Electronics', 'Telecom'];
      await deptEceAlpha.save();

      loadedDepartments = await fetchCollegeDepartments(collegeAlpha._id);
    });

    it('Resolves by departmentId when matching an active department in the loaded list', () => {
      const student = { departmentId: deptCseAlpha._id, department: 'Random String' };
      const result = resolveDepartment(student, loadedDepartments);

      expect(result.status).toBe('resolved_by_id');
      expect(result.departmentId.toString()).toBe(deptCseAlpha._id.toString());
      expect(result.departmentName).toBe('Computer Science and Engineering');
      expect(result.departmentCode).toBe('CSE');
      expect(result.originalText).toBe('Random String');
    });

    it('Silently falls through when departmentId is from another college or inactive', () => {
      // departmentId from College Beta (not in Alpha loaded list), but free-text is 'CSE'
      const student = { departmentId: deptCseBeta._id, department: 'CSE' };
      const result = resolveDepartment(student, loadedDepartments);

      expect(result.status).toBe('resolved_by_code');
      expect(result.departmentId.toString()).toBe(deptCseAlpha._id.toString());
    });

    it('Resolves by department name (normalized)', () => {
      const student = { department: 'Computer Science & Engineering' };
      const result = resolveDepartment(student, loadedDepartments);

      expect(result.status).toBe('resolved_by_name');
      expect(result.departmentId.toString()).toBe(deptCseAlpha._id.toString());
      expect(result.departmentName).toBe('Computer Science and Engineering');
    });

    it('Resolves by department code (normalized)', () => {
      const student = { department: '  c.s.e.  ' }; // Dots, whitespace, lowercase
      const result = resolveDepartment(student, loadedDepartments);

      expect(result.status).toBe('resolved_by_code');
      expect(result.departmentId.toString()).toBe(deptCseAlpha._id.toString());
      expect(result.departmentCode).toBe('CSE');
    });

    it('Resolves by department alias (normalized)', () => {
      const student = { department: 'comp sci' };
      const result = resolveDepartment(student, loadedDepartments);

      expect(result.status).toBe('resolved_by_alias');
      expect(result.departmentId.toString()).toBe(deptCseAlpha._id.toString());
    });

    it('Returns ambiguous if multiple departments match at the same step', () => {
      // Create mock departments with duplicate aliases across two depts
      const ambiguousDepts = [
        { _id: new mongoose.Types.ObjectId(), name: 'Dept A', code: 'DA', aliases: ['tech'] },
        { _id: new mongoose.Types.ObjectId(), name: 'Dept B', code: 'DB', aliases: ['tech'] },
      ];

      const student = { department: 'tech' };
      const result = resolveDepartment(student, ambiguousDepts);

      expect(result.status).toBe('ambiguous');
      expect(result.departmentId).toBeNull();
      expect(result.departmentName).toBe(UNASSIGNED_LABEL);
    });

    it('Returns unassigned when no department matches or string is blank', () => {
      const studentEmpty = { department: '' };
      const resEmpty = resolveDepartment(studentEmpty, loadedDepartments);
      expect(resEmpty.status).toBe('unassigned');
      expect(resEmpty.departmentName).toBe(UNASSIGNED_LABEL);

      const studentUnknown = { department: 'Aeronautical Space Engineering' };
      const resUnknown = resolveDepartment(studentUnknown, loadedDepartments);
      expect(resUnknown.status).toBe('unassigned');
      expect(resUnknown.departmentName).toBe(UNASSIGNED_LABEL);
    });

    it('Never writes to the database during resolution', () => {
      const saveSpy = jest.spyOn(StudentProfile.prototype, 'save');
      const student = { department: 'Computer Science and Engineering' };

      resolveDepartment(student, loadedDepartments);
      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });
  });

  describe('6. Standard Department Catalog Integrity', () => {
    it('Preserves STANDARD_DEPARTMENTS catalog and autoIndex: false configuration', () => {
      expect(Department.schema.options.autoIndex).toBe(false);
      expect(Array.isArray(STANDARD_DEPARTMENTS)).toBe(true);
      expect(Object.isFrozen(STANDARD_DEPARTMENTS)).toBe(true);
      expect(STANDARD_DEPARTMENTS.some((d) => d.code === 'CSE')).toBe(true);
    });
  });
});
