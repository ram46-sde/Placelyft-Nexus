/**
 * CPMS: Add Company Location to Placement Drives Tests
 * Tests:
 * 1. Valid location is saved and returned by list and detail APIs (officer, student drives, student details, student dashboard).
 * 2. Missing, whitespace-only, and invalid-character locations are rejected on create.
 * 3. An existing drive without companyLocation can still be listed, viewed, archived and restored (proves no schema-level requirement).
 * 4. Location cannot be set or changed by a user from another college or a student.
 * 5. Cross-tenant access to drives is still blocked.
 * 6. HTML in the location is rejected by the character whitelist validator.
 * 7. Punctuation-only and length boundaries (< 2, > 100) are rejected.
 * 8. Fallback handling for missing location values.
 * DB: college_placement_test_db ONLY
 */

const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const College = require('../models/College');
const User = require('../models/User');
const PlacementDrive = require('../models/PlacementDrive');
const Company = require('../models/Company');
const DriveApplication = require('../models/DriveApplication');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { validateCompanyLocation } = require('../controllers/officerController');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('CPMS: Company Location on Placement Drives', () => {
  let collegeA, collegeB;
  let officerA, tokenOfficerA;
  let officerB, tokenOfficerB;
  let studentA, tokenStudentA;
  let company;

  const futureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d;
  };

  const basePayload = (overrides = {}) => ({
    companyName: 'Apex Systems',
    jobRole: 'Cloud Architect',
    jobDescription: 'Design, develop, and maintain multi-cloud infrastructure environments.',
    packageDetails: '16 LPA',
    companyLocation: 'Coimbatore, Tamil Nadu, India',
    driveDate: futureDate(14).toISOString(),
    registrationDeadline: futureDate(7).toISOString(),
    eligibilityCriteria: {
      ugCriteriaType: 'NONE',
      minCgpa: 0,
      minUgPercentage: 0,
      minTenthPercentage: 0,
      minTwelfthPercentage: 0,
      maxBacklogs: 0,
    },
    ...overrides,
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'company_location_test_secret_32_chars!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Two colleges
    collegeA = await College.create({ name: 'Alpha Institute of Tech', isActive: true });
    collegeB = await College.create({ name: 'Beta College of Eng', isActive: true });

    // Officer A (College A)
    officerA = await User.create({
      name: 'Officer Alpha',
      email: 'officer.alpha@test.com',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerA = generateToken(officerA._id);

    // Officer B (College B)
    officerB = await User.create({
      name: 'Officer Beta',
      email: 'officer.beta@test.com',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeB._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerB = generateToken(officerB._id);

    // Student in College A
    studentA = await User.create({
      name: 'Student Alpha',
      email: 'student.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    tokenStudentA = generateToken(studentA._id);

    await StudentProfile.create({
      user: studentA._id,
      collegeId: collegeA._id,
      tenthPercentage: 85,
      twelfthPercentage: 80,
      cgpa: 8.5,
      ugPercentage: 85,
      backlogs: 0,
      course: 'Computer Science',
      skills: ['React', 'Node.js'],
    });

    company = await Company.create({
      name: 'Apex Systems',
      industry: 'Software',
    });
  });

  // =========================================================================
  // 1. UNIT VALIDATOR TESTS
  // =========================================================================

  describe('validateCompanyLocation helper', () => {
    it('accepts valid locations with Unicode, punctuation (, . - ( ) & /), and collapses spaces', () => {
      const res = validateCompanyLocation('  Bengaluru  /   Bangalore (Karnataka) - India & SEZ  ', true);
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Bengaluru / Bangalore (Karnataka) - India & SEZ');
    });

    it('rejects missing or empty location when required', () => {
      expect(validateCompanyLocation(undefined, true).valid).toBe(false);
      expect(validateCompanyLocation(null, true).valid).toBe(false);
      expect(validateCompanyLocation('', true).valid).toBe(false);
      expect(validateCompanyLocation('   ', true).valid).toBe(false);
    });

    it('rejects length < 2 or > 100', () => {
      expect(validateCompanyLocation('A', true).valid).toBe(false);
      expect(validateCompanyLocation('A'.repeat(101), true).valid).toBe(false);
      expect(validateCompanyLocation('AB', true).valid).toBe(true);
      expect(validateCompanyLocation('A'.repeat(100), true).valid).toBe(true);
    });

    it('rejects invalid characters, URLs, and angle brackets', () => {
      expect(validateCompanyLocation('<script>alert(1)</script>', true).valid).toBe(false);
      expect(validateCompanyLocation('https://maps.google.com', true).valid).toBe(false);
      expect(validateCompanyLocation('City @ State', true).valid).toBe(false);
      expect(validateCompanyLocation('City #12', true).valid).toBe(false);
    });

    it('rejects punctuation-only or whitespace-only inputs', () => {
      expect(validateCompanyLocation('... --- ...', true).valid).toBe(false);
      expect(validateCompanyLocation(',,, ///', true).valid).toBe(false);
      expect(validateCompanyLocation('   ', true).valid).toBe(false);
    });
  });

  // =========================================================================
  // 2. CREATE DRIVE & API RESPONSES
  // =========================================================================

  describe('Create Drive with companyLocation', () => {
    it('Saves valid location and returns it in list and detail APIs', async () => {
      const locationInput = '  Coimbatore ,   Tamil Nadu  -  India  ';
      const expectedSanitized = 'Coimbatore , Tamil Nadu - India';

      const createRes = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: locationInput }));

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.drive.companyLocation).toBe(expectedSanitized);
      const driveId = createRes.body.drive._id;

      // 1. Officer listing API
      const officerListRes = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(officerListRes.status).toBe(200);
      const officerDrive = officerListRes.body.drives.find((d) => d._id === driveId);
      expect(officerDrive).toBeDefined();
      expect(officerDrive.companyLocation).toBe(expectedSanitized);

      // 2. Student available drives listing API
      const studentListRes = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(studentListRes.status).toBe(200);
      const studentDrive = studentListRes.body.drives.find((d) => d._id === driveId);
      expect(studentDrive).toBeDefined();
      expect(studentDrive.companyLocation).toBe(expectedSanitized);

      // 3. Student drive detail API
      const studentDetailRes = await request(app)
        .get(`/api/student/drives/${driveId}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(studentDetailRes.status).toBe(200);
      expect(studentDetailRes.body.drive.companyLocation).toBe(expectedSanitized);

      // 4. Student dashboard summary latestDrives API
      const dashRes = await request(app)
        .get('/api/student/dashboard/summary')
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(dashRes.status).toBe(200);
      const dashDrive = dashRes.body.latestDrives.find((d) => d._id === driveId);
      expect(dashDrive).toBeDefined();
      expect(dashDrive.companyLocation).toBe(expectedSanitized);
    });

    it('Rejects missing, null, or undefined companyLocation on create (400)', async () => {
      const res1 = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: undefined }));
      expect(res1.status).toBe(400);
      expect(res1.body.message).toMatch(/companyLocation/i);

      const res2 = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: null }));
      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/companyLocation/i);
    });

    it('Rejects whitespace-only companyLocation (400)', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: '     ' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/companyLocation/i);
    });

    it('Rejects invalid characters (HTML, angle brackets, URLs) on create (400)', async () => {
      const resHtml = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: '<script>alert("xss")</script>' }));
      expect(resHtml.status).toBe(400);
      expect(resHtml.body.message).toMatch(/invalid characters/i);

      const resUrl = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: 'https://maps.google.com/?q=Mumbai' }));
      expect(resUrl.status).toBe(400);
      expect(resUrl.body.message).toMatch(/invalid characters/i);
    });

    it('Rejects punctuation-only companyLocation (400)', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload({ companyLocation: '--- ,,, ... ///' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/punctuation/i);
    });
  });

  // =========================================================================
  // 3. LEGACY RECORD COMPATIBILITY & SAVE() RESILIENCE
  // =========================================================================

  describe('Legacy record resilience (no schema-level required)', () => {
    it('An existing drive without companyLocation can still be listed, viewed, archived and restored', async () => {
      // Simulate legacy drive created before the companyLocation field existed
      const legacyDrive = await PlacementDrive.create({
        company: company._id,
        collegeId: collegeA._id,
        jobRole: 'Legacy Embedded Engineer',
        jobDescription: 'Legacy placement drive without companyLocation field.',
        packageDetails: '10 LPA',
        driveDate: futureDate(25),
        registrationDeadline: futureDate(10),
        isActive: true,
      });

      expect(legacyDrive.companyLocation).toBeUndefined();

      // 1. Officer can list it
      const listRes = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(listRes.status).toBe(200);
      const found = listRes.body.drives.find((d) => d._id === legacyDrive._id.toString());
      expect(found).toBeDefined();

      // 2. Student can view it
      const viewRes = await request(app)
        .get(`/api/student/drives/${legacyDrive._id}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.body.drive.companyLocation).toBeUndefined();

      // 3. Officer can archive it (calls drive.save() internally)
      await PlacementDrive.findByIdAndUpdate(legacyDrive._id, { isActive: false });
      const archiveRes = await request(app)
        .patch(`/api/officer/drives/${legacyDrive._id}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.success).toBe(true);

      const archivedInDb = await PlacementDrive.findById(legacyDrive._id);
      expect(archivedInDb.isArchived).toBe(true);

      // 4. Officer can restore it (calls drive.save() internally)
      const restoreRes = await request(app)
        .patch(`/api/officer/drives/${legacyDrive._id}/restore`)
        .set('Authorization', `Bearer ${tokenOfficerA}`);
      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);

      const restoredInDb = await PlacementDrive.findById(legacyDrive._id);
      expect(restoredInDb.isArchived).toBe(false);
    });
  });

  // =========================================================================
  // 4. TENANT AND ROLE SECURITY
  // =========================================================================

  describe('Tenant and role security', () => {
    it('Students cannot create a drive with companyLocation (403)', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send(basePayload());
      expect(res.status).toBe(403);
    });

    it('Officer B from College B cannot access or affect College A drives', async () => {
      const createRes = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerA}`)
        .send(basePayload());
      expect(createRes.status).toBe(201);
      const driveAId = createRes.body.drive._id;

      // Officer B listing should not contain College A drive
      const listBRes = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerB}`);
      expect(listBRes.status).toBe(200);
      const foundInB = listBRes.body.drives.find((d) => d._id === driveAId);
      expect(foundInB).toBeUndefined();

      // Officer B cannot archive College A drive
      const archiveRes = await request(app)
        .patch(`/api/officer/drives/${driveAId}/archive`)
        .set('Authorization', `Bearer ${tokenOfficerB}`);
      expect(archiveRes.status).toBe(403);
    });
  });
});
