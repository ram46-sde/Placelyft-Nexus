const mongoose = require('mongoose');
const Department = require('../models/Department');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const User = require('../models/User');
const { STANDARD_DEPARTMENTS } = require('../config/standardDepartments');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Milestone 2C - Department Model & Additive Schema Tests', () => {
  let collegeAId;
  let collegeBId;

  beforeAll(async () => {
    await connectTestDb();
    // Explicitly build indexes in the isolated test database to validate constraints
    await Department.createIndexes();
    collegeAId = new mongoose.Types.ObjectId();
    collegeBId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Standard Department Catalog (Catalog-only Safety)', () => {
    it('should export frozen array of standard department suggestions', () => {
      expect(Array.isArray(STANDARD_DEPARTMENTS)).toBe(true);
      expect(Object.isFrozen(STANDARD_DEPARTMENTS)).toBe(true);
      expect(STANDARD_DEPARTMENTS.length).toBeGreaterThanOrEqual(10);

      const cse = STANDARD_DEPARTMENTS.find((d) => d.code === 'CSE');
      expect(cse).toBeDefined();
      expect(cse.name).toBe('Computer Science and Engineering');
    });

    it('should prevent runtime mutation of standard department suggestions', () => {
      expect(() => {
        STANDARD_DEPARTMENTS.push({ code: 'HACK', name: 'Unauthorized' });
      }).toThrow();
    });
  });

  describe('Department Schema & AutoIndex Safety', () => {
    it('should have autoIndex explicitly set to false to protect live databases', () => {
      expect(Department.schema.options.autoIndex).toBe(false);
    });

    it('should validate required fields (collegeId, name, code)', async () => {
      const dept = new Department({});
      let err;
      try {
        await dept.validate();
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.errors.collegeId).toBeDefined();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.code).toBeDefined();
    });

    it('should trim name and code, and uppercase code automatically', async () => {
      const dept = await Department.create({
        collegeId: collegeAId,
        name: '   Information Technology   ',
        code: '   it   ',
      });

      expect(dept.name).toBe('Information Technology');
      expect(dept.code).toBe('IT');
      expect(dept.isCustom).toBe(false);
      expect(dept.isActive).toBe(true);
    });
  });

  describe('Same-College and Cross-College Uniqueness Constraints', () => {
    it('should reject duplicate department name in the same college (case-insensitively)', async () => {
      await Department.create({
        collegeId: collegeAId,
        name: 'Computer Science and Engineering',
        code: 'CSE',
      });

      let duplicateError;
      try {
        await Department.create({
          collegeId: collegeAId,
          name: 'computer science and engineering', // Case variant
          code: 'CSE_ALT',
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000);
    });

    it('should allow identical department name in different colleges', async () => {
      const deptCollegeA = await Department.create({
        collegeId: collegeAId,
        name: 'Computer Science and Engineering',
        code: 'CSE',
      });

      const deptCollegeB = await Department.create({
        collegeId: collegeBId,
        name: 'Computer Science and Engineering',
        code: 'CSE_B',
      });

      expect(deptCollegeA._id).toBeDefined();
      expect(deptCollegeB._id).toBeDefined();
      expect(deptCollegeA.name).toBe(deptCollegeB.name);
      expect(deptCollegeA.collegeId.toString()).not.toBe(deptCollegeB.collegeId.toString());
    });

    it('should reject duplicate department code in the same college', async () => {
      await Department.create({
        collegeId: collegeAId,
        name: 'Computer Science',
        code: 'CS',
      });

      let duplicateError;
      try {
        await Department.create({
          collegeId: collegeAId,
          name: 'Cyber Security',
          code: 'cs', // Case-insensitive normalized uppercase collides with CS
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000);
    });

    it('should allow identical department code in different colleges', async () => {
      const deptCollegeA = await Department.create({
        collegeId: collegeAId,
        name: 'Mechanical Engineering',
        code: 'MECH',
      });

      const deptCollegeB = await Department.create({
        collegeId: collegeBId,
        name: 'Mechanical Engineering',
        code: 'MECH',
      });

      expect(deptCollegeA.code).toBe('MECH');
      expect(deptCollegeB.code).toBe('MECH');
      expect(deptCollegeA.collegeId.toString()).not.toBe(deptCollegeB.collegeId.toString());
    });
  });

  describe('Deactivation Safety (Soft Deactivation)', () => {
    it('should support deactivation without deleting document or relationships', async () => {
      const dept = await Department.create({
        collegeId: collegeAId,
        name: 'Civil Engineering',
        code: 'CIVIL',
      });

      dept.isActive = false;
      await dept.save();

      const retrieved = await Department.findById(dept._id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.isActive).toBe(false);
      expect(retrieved.name).toBe('Civil Engineering');
      expect(retrieved.collegeId.toString()).toBe(collegeAId.toString());
    });
  });

  describe('Additive Schema Fields Validation', () => {
    it('User: should accept collegeAssignmentStatus with PENDING_APPROVAL default and enforce enum', async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = new User({
        _id: userId,
        name: 'Test Student',
        email: 'test_student_additive@college.edu',
        password: 'password123',
        collegeId: collegeAId,
      });

      expect(user.collegeAssignmentStatus).toBe('PENDING_APPROVAL');

      // Valid enum values
      user.collegeAssignmentStatus = 'VERIFIED';
      await expect(user.validate()).resolves.toBeUndefined();

      user.collegeAssignmentStatus = 'LEGACY_UNVERIFIED';
      await expect(user.validate()).resolves.toBeUndefined();

      // Invalid enum value rejected
      user.collegeAssignmentStatus = 'INVALID_STATUS';
      let err;
      try {
        await user.validate();
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors.collegeAssignmentStatus).toBeDefined();
    });

    it('StudentProfile: should accept collegeId, departmentId, and legacyDepartment without breaking legacy department string', async () => {
      const userId = new mongoose.Types.ObjectId();
      const deptId = new mongoose.Types.ObjectId();

      const profile = new StudentProfile({
        user: userId,
        department: 'Computer Science',
        collegeId: collegeAId,
        departmentId: deptId,
        legacyDepartment: 'Computer Science',
        course: 'B.Tech',
        batch: '2025',
      });

      await expect(profile.validate()).resolves.toBeUndefined();
      expect(profile.collegeId.toString()).toBe(collegeAId.toString());
      expect(profile.departmentId.toString()).toBe(deptId.toString());
      expect(profile.legacyDepartment).toBe('Computer Science');
      expect(profile.department).toBe('Computer Science');
    });

    it('DriveApplication: should accept collegeId additive field', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const driveId = new mongoose.Types.ObjectId();

      const application = new DriveApplication({
        student: studentId,
        placementDrive: driveId,
        collegeId: collegeAId,
      });

      await expect(application.validate()).resolves.toBeUndefined();
      expect(application.collegeId.toString()).toBe(collegeAId.toString());
    });
  });
});
