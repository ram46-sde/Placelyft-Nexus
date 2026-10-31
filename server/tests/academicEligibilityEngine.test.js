const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const PlacementDrive = require('../models/PlacementDrive');
const Company = require('../models/Company');
const DriveApplication = require('../models/DriveApplication');
const generateToken = require('../utils/generateToken');
const { resolveUgBasis, checkEligibility } = require('../utils/eligibilityEngine');
const {
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
  getApprovedTestUri,
  validateTestConnectionConfig,
} = require('./testDb');

describe('Feature 3: Academic Eligibility Engine, Models, and APIs', () => {
  let collegeAlpha;
  let collegeBeta;
  let officerAlpha;
  let tokenOfficerAlpha;
  let studentAlpha;
  let tokenStudentAlpha;
  let studentBeta;
  let tokenStudentBeta;
  let testCompany;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';

    // Explicit database safety assertion
    const testUri = getApprovedTestUri();
    const { dbName } = validateTestConnectionConfig(testUri);
    console.log(`[TEST SETUP] Resolved Mongo URI: ${testUri} | Database: ${dbName}`);
    expect(dbName).toBe('college_placement_test_db');

    await connectTestDb();
    expect(mongoose.connection.name).toBe('college_placement_test_db');
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Technology',
      contactEmail: 'admin@alpha.edu',
    });

    collegeBeta = await College.create({
      name: 'Beta State University',
      contactEmail: 'admin@beta.edu',
    });

    // 2. Company
    testCompany = await Company.create({
      name: 'Acme Cloud Solutions',
      industry: 'Software',
    });

    // 3. Officer Alpha
    officerAlpha = await User.create({
      name: 'Officer Adams',
      email: 'officer@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficerAlpha = generateToken(officerAlpha._id, officerAlpha.role);

    // 4. Student Alpha
    studentAlpha = await User.create({
      name: 'Alice Johnson',
      email: 'alice@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenStudentAlpha = generateToken(studentAlpha._id, studentAlpha.role);

    // 5. Student Beta
    studentBeta = await User.create({
      name: 'Bob Smith',
      email: 'bob@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenStudentBeta = generateToken(studentBeta._id, studentBeta.role);
  });

  // =========================================================================
  // SECTION 1: Pure Unit Tests for resolveUgBasis
  // =========================================================================
  describe('1. Pure Unit Tests: resolveUgBasis', () => {
    test('resolves explicit CGPA, PERCENTAGE, and NONE (case-insensitive and trimmed)', () => {
      expect(resolveUgBasis({ ugCriteriaType: 'CGPA' })).toBe('CGPA');
      expect(resolveUgBasis({ ugCriteriaType: 'percentage' })).toBe('PERCENTAGE');
      expect(resolveUgBasis({ ugCriteriaType: ' None ' })).toBe('NONE');
    });

    test('falls back to CGPA on legacy criteria with minCgpa > 0 and missing ugCriteriaType', () => {
      expect(resolveUgBasis({ minCgpa: 7.5 })).toBe('CGPA');
      expect(resolveUgBasis({ minCgpa: 0.1 })).toBe('CGPA');
    });

    test('falls back to NONE on legacy criteria with minCgpa <= 0 or missing', () => {
      expect(resolveUgBasis({ minCgpa: 0 })).toBe('NONE');
      expect(resolveUgBasis({})).toBe('NONE');
      expect(resolveUgBasis(null)).toBe('NONE');
      expect(resolveUgBasis(undefined)).toBe('NONE');
    });

    test('handles invalid ugCriteriaType strings by falling back to legacy check', () => {
      expect(resolveUgBasis({ ugCriteriaType: 'UNKNOWN', minCgpa: 8.0 })).toBe('CGPA');
      expect(resolveUgBasis({ ugCriteriaType: 'UNKNOWN', minCgpa: 0 })).toBe('NONE');
    });

    test('functions identically on plain POJO / .lean() objects', () => {
      const leanDoc = JSON.parse(JSON.stringify({ minCgpa: 6.5, ugCriteriaType: undefined }));
      expect(resolveUgBasis(leanDoc)).toBe('CGPA');
    });
  });

  // =========================================================================
  // SECTION 2: Pure Unit Tests for checkEligibility
  // =========================================================================
  describe('2. Pure Unit Tests: checkEligibility', () => {
    test('returns fail-closed when profile is null or undefined', () => {
      const res = checkEligibility(null, { minCgpa: 7.0 });
      expect(res.isEligible).toBe(false);
      expect(res.reasons[0]).toContain('profile is incomplete');
    });

    // 10th Standard Percentage
    describe('10th Standard Percentage', () => {
      const criteria = { minTenthPercentage: 80, ugCriteriaType: 'NONE' };

      test('passes at exact cutoff boundary', () => {
        const profile = { tenthPercentage: 80 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(true);
      });

      test('fails when profile is just below cutoff (79.99%)', () => {
        const profile = { tenthPercentage: 79.99 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('10th Standard percentage (79.99%) is below the required minimum of 80%.');
      });

      test('fails closed when 10th percentage is missing/null/undefined in profile', () => {
        expect(checkEligibility({}, criteria).isEligible).toBe(false);
        expect(checkEligibility({ tenthPercentage: null }, criteria).reasons[0]).toContain(
          '10th Standard percentage is missing in your profile. Required minimum is 80%.'
        );
      });

      test('fails closed when 10th percentage is NaN, Infinity, negative, or > 100', () => {
        expect(checkEligibility({ tenthPercentage: NaN }, criteria).isEligible).toBe(false);
        expect(checkEligibility({ tenthPercentage: -5 }, criteria).isEligible).toBe(false);
        expect(checkEligibility({ tenthPercentage: 105 }, criteria).isEligible).toBe(false);
      });
    });

    // 12th Standard / Diploma Percentage
    describe('12th Standard / Diploma Percentage', () => {
      const criteria = { minTwelfthPercentage: 75, ugCriteriaType: 'NONE' };

      test('passes at exact cutoff boundary', () => {
        const profile = { twelfthPercentage: 75 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(true);
      });

      test('fails when profile is below cutoff', () => {
        const profile = { twelfthPercentage: 74.5 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('12th Standard / Diploma percentage (74.5%) is below the required minimum of 75%.');
      });

      test('fails closed when 12th percentage is missing in profile', () => {
        const res = checkEligibility({ tenthPercentage: 90 }, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons[0]).toContain(
          '12th Standard / Diploma percentage is missing in your profile. Required minimum is 75%.'
        );
      });
    });

    // Undergraduate Basis - CGPA
    describe('UG Requirement: CGPA Basis', () => {
      const criteria = { ugCriteriaType: 'CGPA', minCgpa: 7.5 };

      test('passes when student meets CGPA requirement', () => {
        const profile = { cgpa: 7.5 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(true);
      });

      test('fails when student CGPA is below requirement', () => {
        const profile = { cgpa: 7.49 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('Undergraduate CGPA (7.49) is below the required minimum of 7.5.');
      });

      test('fails closed when student CGPA is missing', () => {
        const profile = { ugPercentage: 95 }; // High percentage must NOT satisfy CGPA basis!
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('Undergraduate CGPA is missing in your profile. Required minimum is 7.5.');
      });
    });

    // Undergraduate Basis - PERCENTAGE
    describe('UG Requirement: PERCENTAGE Basis', () => {
      const criteria = { ugCriteriaType: 'PERCENTAGE', minUgPercentage: 70 };

      test('passes when student meets UG percentage requirement', () => {
        const profile = { ugPercentage: 70 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(true);
      });

      test('fails when student UG percentage is below requirement', () => {
        const profile = { ugPercentage: 69.9 };
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('Undergraduate percentage (69.9%) is below the required minimum of 70%.');
      });

      test('fails closed when student UG percentage is missing (even if CGPA is 10.0)', () => {
        const profile = { cgpa: 10.0 }; // High CGPA must NOT satisfy percentage basis without conversion!
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(false);
        expect(res.reasons).toContain('Undergraduate percentage is missing in your profile. Required minimum is 70%.');
      });
    });

    // Undergraduate Basis - NONE
    describe('UG Requirement: NONE Basis', () => {
      const criteria = { ugCriteriaType: 'NONE', minCgpa: 0, minUgPercentage: 0 };

      test('passes even if student has no CGPA and no UG percentage', () => {
        const profile = {};
        const res = checkEligibility(profile, criteria);
        expect(res.isEligible).toBe(true);
      });
    });

    // Legacy Drive Fallback
    describe('Legacy PlacementDrive Support', () => {
      test('legacy drive criteria without ugCriteriaType enforces minCgpa > 0 as CGPA basis', () => {
        const legacyCriteria = { minCgpa: 7.0 }; // ugCriteriaType is undefined
        const ineligibleProfile = { cgpa: 6.5 };
        const eligibleProfile = { cgpa: 7.2 };

        expect(checkEligibility(ineligibleProfile, legacyCriteria).isEligible).toBe(false);
        expect(checkEligibility(eligibleProfile, legacyCriteria).isEligible).toBe(true);
      });

      test('legacy drive criteria with minCgpa = 0 treats UG basis as NONE', () => {
        const legacyCriteria = { minCgpa: 0 };
        expect(checkEligibility({}, legacyCriteria).isEligible).toBe(true);
      });
    });
  });

  // =========================================================================
  // SECTION 3: Student Profile API Tests (PUT /api/student/profile)
  // =========================================================================
  describe('3. Student Profile API: Academic Fields Validation', () => {
    test('successfully saves valid tenthPercentage, twelfthPercentage, and ugPercentage', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          rollNumber: '21CS001',
          department: 'Computer Science',
          course: 'B.Tech',
          batch: '2025',
          cgpa: 8.5,
          tenthPercentage: 88.5,
          twelfthPercentage: 86.0,
          ugPercentage: 81.25,
          backlogs: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.tenthPercentage).toBe(88.5);
      expect(res.body.profile.twelfthPercentage).toBe(86.0);
      expect(res.body.profile.ugPercentage).toBe(81.25);
      expect(res.body.profile.cgpa).toBe(8.5);
    });

    test('rejects percentage < 0 with HTTP 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          tenthPercentage: -1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('10th Standard percentage must be a valid number between 0 and 100.');
    });

    test('rejects percentage > 100 with HTTP 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          twelfthPercentage: 100.1,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('12th Standard / Diploma percentage must be a valid number between 0 and 100.');
    });

    test('rejects non-numeric string or scientific exponential strings with HTTP 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          ugPercentage: '85e2',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Undergraduate percentage must be a valid number between 0 and 100.');
    });

    test('clears academic percentage to null when sent as null or empty string', async () => {
      // First set values
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        tenthPercentage: 85,
        twelfthPercentage: 85,
      });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          tenthPercentage: null,
          twelfthPercentage: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.tenthPercentage).toBeNull();
      expect(res.body.profile.twelfthPercentage).toBeNull();
    });

    test('omitted fields remain unchanged', async () => {
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        tenthPercentage: 92,
        twelfthPercentage: 91,
      });

      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`)
        .send({
          cgpa: 9.0, // tenthPercentage and twelfthPercentage omitted
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.tenthPercentage).toBe(92);
      expect(res.body.profile.twelfthPercentage).toBe(91);
      expect(res.body.profile.cgpa).toBe(9.0);
    });
  });

  // =========================================================================
  // SECTION 4: Placement Officer Create Drive API (POST /api/officer/drives)
  // =========================================================================
  describe('4. Placement Officer Create Drive API: Validation & Threshold Enforcement', () => {
    const baseDriveData = {
      companyName: 'Acme Cloud Solutions',
      jobRole: 'Cloud Engineer',
      companyLocation: 'Pune, Maharashtra, India',
      jobDescription: 'Build backend microservices and cloud infrastructure.',
      driveDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      registrationDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    };

    test('creates drive with CGPA basis and valid positive threshold', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            minTenthPercentage: 75,
            minTwelfthPercentage: 70,
            ugCriteriaType: 'CGPA',
            minCgpa: 7.5,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.eligibilityCriteria.ugCriteriaType).toBe('CGPA');
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(7.5);
      expect(res.body.drive.eligibilityCriteria.minUgPercentage).toBe(0);
      expect(res.body.drive.effectiveUgCriteriaType).toBe('CGPA');
    });

    test('creates drive with PERCENTAGE basis and valid positive threshold', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            minTenthPercentage: 70,
            minTwelfthPercentage: 65,
            ugCriteriaType: 'PERCENTAGE',
            minUgPercentage: 68.5,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.eligibilityCriteria.ugCriteriaType).toBe('PERCENTAGE');
      expect(res.body.drive.eligibilityCriteria.minUgPercentage).toBe(68.5);
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(0);
      expect(res.body.drive.effectiveUgCriteriaType).toBe('PERCENTAGE');
    });

    test('creates drive with NONE basis and drops inactive UG thresholds', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            minTenthPercentage: 60,
            ugCriteriaType: 'NONE',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.eligibilityCriteria.ugCriteriaType).toBe('NONE');
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(0);
      expect(res.body.drive.eligibilityCriteria.minUgPercentage).toBe(0);
      expect(res.body.drive.effectiveUgCriteriaType).toBe('NONE');
    });

    test('rejects new drive creation without explicit ugCriteriaType', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            minTenthPercentage: 70,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('ugCriteriaType is required and must be one of: CGPA, PERCENTAGE, NONE.');
    });

    test('rejects invalid ugCriteriaType enum value', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            ugCriteriaType: 'INVALID_TYPE',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('ugCriteriaType must be one of: CGPA, PERCENTAGE, NONE.');
    });

    test('rejects CGPA basis when minCgpa is missing or 0', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            ugCriteriaType: 'CGPA',
            minCgpa: 0,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('minCgpa must be a positive number between 0 and 10.');
    });

    test('rejects PERCENTAGE basis when minUgPercentage is missing or 0', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            ugCriteriaType: 'PERCENTAGE',
            minUgPercentage: 0,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('minUgPercentage must be a positive number between 0 and 100.');
    });

    test('rejects contradictory criteria (e.g. NONE with positive CGPA or percentage)', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            ugCriteriaType: 'NONE',
            minCgpa: 7.5,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Contradictory criteria');
    });

    test('rejects contradictory criteria (e.g. CGPA basis with positive minUgPercentage)', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`)
        .send({
          ...baseDriveData,
          eligibilityCriteria: {
            ugCriteriaType: 'CGPA',
            minCgpa: 8.0,
            minUgPercentage: 75,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Contradictory criteria');
    });
  });

  // =========================================================================
  // SECTION 5: Student Drives Listing & Single Drive API
  // =========================================================================
  describe('5. Student Drives Listing & Details API', () => {
    let driveWithPercentages;
    let legacyDrive;

    beforeEach(async () => {
      // 1. Drive with Feature 3 criteria
      driveWithPercentages = await PlacementDrive.create({
        company: testCompany._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Full Stack Engineer',
        jobDescription: 'Node and React development',
        driveDate: new Date(Date.now() + 86400000 * 5),
        registrationDeadline: new Date(Date.now() + 86400000 * 2),
        isActive: true,
        eligibilityCriteria: {
          minTenthPercentage: 75,
          minTwelfthPercentage: 75,
          ugCriteriaType: 'PERCENTAGE',
          minUgPercentage: 70,
        },
      });

      // 2. Legacy Drive (without ugCriteriaType, with minCgpa > 0)
      legacyDrive = await PlacementDrive.create({
        company: testCompany._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Legacy Analyst',
        jobDescription: 'Legacy drive for testing backward compatibility',
        driveDate: new Date(Date.now() + 86400000 * 6),
        registrationDeadline: new Date(Date.now() + 86400000 * 3),
        isActive: true,
        eligibilityCriteria: {
          minCgpa: 7.0,
        },
      });
    });

    test('GET /api/student/drives returns drives with effectiveUgCriteriaType and correct eligibility', async () => {
      // Setup student profile meeting only the legacy drive, but failing the percentage drive due to missing 10th
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        cgpa: 8.0,
        // tenthPercentage and twelfthPercentage missing!
      });

      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drives.length).toBe(2);

      const f3Drive = res.body.drives.find((d) => d._id.toString() === driveWithPercentages._id.toString());
      expect(f3Drive.effectiveUgCriteriaType).toBe('PERCENTAGE');
      expect(f3Drive.eligibility.isEligible).toBe(false);
      expect(f3Drive.eligibility.reasons.some((r) => r.includes('10th Standard percentage is missing'))).toBe(true);

      const legDrive = res.body.drives.find((d) => d._id.toString() === legacyDrive._id.toString());
      expect(legDrive.effectiveUgCriteriaType).toBe('CGPA');
      expect(legDrive.eligibility.isEligible).toBe(true);
    });

    test('GET /api/student/drives/:id returns single drive with effectiveUgCriteriaType', async () => {
      const res = await request(app)
        .get(`/api/student/drives/${driveWithPercentages._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.effectiveUgCriteriaType).toBe('PERCENTAGE');
    });
  });

  // =========================================================================
  // SECTION 6: Direct API Application Protection & Tenant Isolation
  // =========================================================================
  describe('6. Direct API Application Protection & Tenant Isolation', () => {
    let driveAlpha;
    let driveBeta;

    beforeEach(async () => {
      driveAlpha = await PlacementDrive.create({
        company: testCompany._id,
        collegeId: collegeAlpha._id,
        jobRole: 'Software Engineer Alpha',
        jobDescription: 'Alpha campus drive',
        driveDate: new Date(Date.now() + 86400000 * 5),
        registrationDeadline: new Date(Date.now() + 86400000 * 2),
        isActive: true,
        eligibilityCriteria: {
          minTenthPercentage: 80,
          minTwelfthPercentage: 80,
          ugCriteriaType: 'PERCENTAGE',
          minUgPercentage: 75,
        },
      });

      driveBeta = await PlacementDrive.create({
        company: testCompany._id,
        collegeId: collegeBeta._id,
        jobRole: 'Software Engineer Beta',
        jobDescription: 'Beta campus drive',
        driveDate: new Date(Date.now() + 86400000 * 5),
        registrationDeadline: new Date(Date.now() + 86400000 * 2),
        isActive: true,
        eligibilityCriteria: {
          ugCriteriaType: 'NONE',
        },
      });
    });

    test('direct POST /api/student/applications/:driveId returns HTTP 403 when student does not meet criteria', async () => {
      // Ineligible student (only 70% in 10th, required is 80%)
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        tenthPercentage: 70,
        twelfthPercentage: 85,
        ugPercentage: 80,
      });

      const res = await request(app)
        .post(`/api/student/applications/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('You are not eligible to apply for this drive.');
      expect(res.body.reasons).toBeDefined();
    });

    test('direct POST /api/student/applications/:driveId succeeds when student meets all criteria', async () => {
      // Eligible student
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
        tenthPercentage: 85,
        twelfthPercentage: 85,
        ugPercentage: 80,
      });

      const res = await request(app)
        .post(`/api/student/applications/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application).toBeDefined();
    });

    test('tenant isolation: student from College Alpha cannot apply to drive in College Beta', async () => {
      await StudentProfile.create({
        user: studentAlpha._id,
        collegeId: collegeAlpha._id,
      });

      const res = await request(app)
        .post(`/api/student/applications/${driveBeta._id}`)
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unauthorized access to this placement drive.');
    });

    test('tenant isolation: student from College Alpha cannot see drives in College Beta', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${tokenStudentAlpha}`);

      expect(res.status).toBe(200);
      const driveIds = res.body.drives.map((d) => d._id.toString());
      expect(driveIds).toContain(driveAlpha._id.toString());
      expect(driveIds).not.toContain(driveBeta._id.toString());
    });

    test('tenant isolation: officer from College Alpha cannot see drives in College Beta', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${tokenOfficerAlpha}`);

      expect(res.status).toBe(200);
      const driveIds = res.body.drives.map((d) => d._id.toString());
      expect(driveIds).toContain(driveAlpha._id.toString());
      expect(driveIds).not.toContain(driveBeta._id.toString());
    });
  });
});
