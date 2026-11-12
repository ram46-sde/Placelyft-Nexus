const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const DriveAttendance = require('../models/DriveAttendance');
const PlacementOutcome = require('../models/PlacementOutcome');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

/**
 * Feature 02: Edit Placement Drive Details — Stage 1 Tests
 *
 * Verifies PUT /api/officer/drives/:id:
 * 1. Authentication & Role Authorization
 * 2. Multi-Tenant Scoping & Protection
 * 3. Drive Lifecycle Checks (active, closed, archived)
 * 4. Validation & Sanitization (job, dates, eligibility, locations)
 * 5. Protected & Immutable Fields Defense
 * 6. Partial Updates & Merging
 * 7. Existing Applicant Protection & Confirmation Workflow (HTTP 409)
 * 8. Company Reference Isolation (Never rename shared companies)
 * 9. Dependent Data Preservation (applications, attendance, outcomes)
 */
describe('Feature 02 Stage 1: PUT /api/officer/drives/:id (Backend Update API)', () => {
  let collegeAlpha;
  let collegeBeta;
  let officerAlpha;
  let officerBeta;
  let officerAlphaToken;
  let officerBetaToken;
  let studentUser;
  let studentToken;
  let recruiterUser;
  let recruiterToken;
  let sharedCompany;
  let driveAlpha;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'feature02_stage1_jwt_secret_key_at_least_32_characters!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Engineering College',
      contactEmail: 'admin@alpha.edu',
      address: '100 Alpha Way',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta Technology Institute',
      contactEmail: 'admin@beta.edu',
      address: '200 Beta Road',
      isActive: true,
    });

    // 2. Users & Tokens
    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    officerAlphaToken = generateToken(officerAlpha._id, officerAlpha.role);

    officerBeta = await User.create({
      name: 'Officer Beta',
      email: 'officer@beta.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    officerBetaToken = generateToken(officerBeta._id, officerBeta.role);

    studentUser = await User.create({
      name: 'Student One',
      email: 'student@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    studentToken = generateToken(studentUser._id, studentUser.role);

    recruiterUser = await User.create({
      name: 'Recruiter Bob',
      email: 'recruiter@techcorp.com',
      password: 'password123',
      role: 'recruiter',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    recruiterToken = generateToken(recruiterUser._id, recruiterUser.role);

    // 3. Shared Company
    sharedCompany = await Company.create({
      name: 'Global Tech Systems',
      industry: 'Software',
      website: 'https://globaltech.com',
      description: 'Enterprise cloud software provider',
      logoUrl: 'https://globaltech.com/logo.png',
    });

    // 4. Drive under College Alpha
    const driveDate = new Date();
    driveDate.setDate(driveDate.getDate() + 30);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 15);

    driveAlpha = await PlacementDrive.create({
      company: sharedCompany._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Full stack development role working on cloud platforms.',
      packageDetails: '12 LPA',
      companyLocation: 'Bangalore, India',
      driveDate,
      registrationDeadline: deadline,
      isActive: true,
      isArchived: false,
      eligibilityCriteria: {
        minTenthPercentage: 60,
        minTwelfthPercentage: 60,
        ugCriteriaType: 'CGPA',
        minCgpa: 7.0,
        minUgPercentage: 0,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech', 'MCA'],
        requiredSkills: ['JavaScript', 'Node.js'],
      },
    });
  });

  // ─── 1. Authentication & Role Authorization ──────────────────────────────────
  describe('1. Authentication & Role Authorization', () => {
    it('1.1 Unauthenticated request returns 401', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .send({ jobRole: 'Lead Architect' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('1.2 Student token returns 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ jobRole: 'Lead Architect' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('1.3 Recruiter token returns 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ jobRole: 'Lead Architect' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('1.4 Officer without valid college context is rejected with 403', async () => {
      const officerNoCollege = await User.create({
        name: 'Unassigned Officer',
        email: 'unassigned@officer.edu',
        password: 'password123',
        role: 'placement_officer',
        collegeAssignmentStatus: 'LEGACY_UNVERIFIED',
        isActive: true,
      });
      const unassignedToken = generateToken(officerNoCollege._id, officerNoCollege.role);

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${unassignedToken}`)
        .send({ jobRole: 'Lead Architect' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 2. Multi-Tenant Scoping & Ownership ─────────────────────────────────────
  describe('2. Multi-Tenant Scoping & Protection', () => {
    it('2.1 Officer from College Beta cannot update College Alpha drive (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerBetaToken}`)
        .send({ jobRole: 'Hacked Role' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/another institution/i);

      // Verify DB unchanged
      const fresh = await PlacementDrive.findById(driveAlpha._id);
      expect(fresh.jobRole).toBe('Software Engineer');
    });

    it('2.2 Client-supplied collegeId cannot change drive ownership (400 Forbidden)', async () => {
      const spoofedCollegeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          collegeId: spoofedCollegeId,
          jobRole: 'Valid Role Update',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected field 'collegeId'/i);

      // Verify drive remains owned by College Alpha
      const fresh = await PlacementDrive.findById(driveAlpha._id);
      expect(fresh.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(fresh.jobRole).toBe('Software Engineer');
    });
  });

  // ─── 3. Drive Lifecycle Checks ───────────────────────────────────────────────
  describe('3. Drive Lifecycle Checks', () => {
    it('3.1 Active drive can be updated successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Senior Software Engineer',
          packageDetails: '15 LPA',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.jobRole).toBe('Senior Software Engineer');
      expect(res.body.drive.packageDetails).toBe('15 LPA');
      expect(res.body.drive.status).toBe('active');
    });

    it('3.2 Closed drive can be updated successfully (200 OK)', async () => {
      // Manually close the drive
      driveAlpha.isActive = false;
      await driveAlpha.save();

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobDescription: 'Updated job description for closed drive that remains accurate for records.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.jobDescription).toBe(
        'Updated job description for closed drive that remains accurate for records.'
      );
      expect(res.body.drive.status).toBe('closed');
    });

    it('3.3 Archived drive cannot be updated (400 Bad Request with code DRIVE_ARCHIVED)', async () => {
      driveAlpha.isArchived = true;
      driveAlpha.isActive = false;
      driveAlpha.archivedAt = new Date();
      driveAlpha.archivedBy = officerAlpha._id;
      await driveAlpha.save();

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Cannot Edit Archived Drive',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DRIVE_ARCHIVED');
      expect(res.body.message).toMatch(/restore the drive/i);

      // Verify DB unchanged
      const fresh = await PlacementDrive.findById(driveAlpha._id);
      expect(fresh.jobRole).toBe('Software Engineer');
    });

    it('3.4 Attempts to modify archive metadata via update are rejected with 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          isArchived: true,
          archivedAt: new Date(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected field/i);
    });
  });

  // ─── 4. Validation & Sanitization ────────────────────────────────────────────
  describe('4. Validation & Sanitization', () => {
    it('4.1 Invalid drive ID format returns 400', async () => {
      const res = await request(app)
        .put('/api/officer/drives/not-a-valid-id')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ jobRole: 'New Role' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid drive id/i);
    });

    it('4.2 Nonexistent drive ID returns 404', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/officer/drives/${nonExistentId}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ jobRole: 'New Role' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('4.3 Empty or whitespace jobRole returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ jobRole: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/jobRole/i);
    });

    it('4.4 Job description shorter than 10 characters returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ jobDescription: 'Short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 10 characters/i);
    });

    it('4.5 Job description exceeding 5000 characters returns 400', async () => {
      const longDesc = 'A'.repeat(5001);
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ jobDescription: longDesc });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/exceed 5000 characters/i);
    });

    it('4.6 Invalid companyLocation with forbidden characters returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ companyLocation: 'Bangalore <script>alert(1)</script>' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid characters/i);
    });

    it('4.7 Registration deadline after driveDate returns 400', async () => {
      const futureDriveDate = new Date();
      futureDriveDate.setDate(futureDriveDate.getDate() + 10);
      const invalidDeadline = new Date();
      invalidDeadline.setDate(invalidDeadline.getDate() + 20); // 20 > 10

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          driveDate: futureDriveDate.toISOString(),
          registrationDeadline: invalidDeadline.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deadline cannot be after the drive date/i);
    });

    it('4.8 Partial date update: submitting deadline later than existing stored driveDate returns 400', async () => {
      // Existing driveDate is +30 days. Let's submit a deadline of +40 days without passing driveDate
      const laterDeadline = new Date();
      laterDeadline.setDate(laterDeadline.getDate() + 40);

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          registrationDeadline: laterDeadline.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deadline cannot be after the drive date/i);
    });

    it('4.9 Invalid eligibility percentages return 400', async () => {
      const res1 = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: { minTenthPercentage: 105 },
        });

      expect(res1.status).toBe(400);
      expect(res1.body.message).toMatch(/between 0 and 100/i);

      const res2 = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: { minTwelfthPercentage: -5 },
        });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/between 0 and 100/i);
    });

    it('4.10 Invalid UG grading criteria type returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: { ugCriteriaType: 'LETTER_GRADE' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be one of: CGPA, PERCENTAGE, NONE/i);
    });

    it('4.11 Contradictory criteria for CGPA vs Percentage returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: {
            ugCriteriaType: 'CGPA',
            minCgpa: 8.0,
            minUgPercentage: 75, // Contradictory!
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Contradictory criteria/i);
    });

    it('4.12 Negative or non-integer maxBacklogs returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: { maxBacklogs: 2.5 },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/non-negative integer/i);
    });

    it('4.13 Unknown field attempt is rejected to prevent mass assignment (400)', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Software Engineer II',
          maliciousAdminFlag: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Field 'maliciousAdminFlag' is not permitted/i);
    });

    it('4.14 Partial update preserves omitted fields', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Staff Software Engineer',
        });

      expect(res.status).toBe(200);
      expect(res.body.drive.jobRole).toBe('Staff Software Engineer');
      // Preserved existing fields
      expect(res.body.drive.packageDetails).toBe('12 LPA');
      expect(res.body.drive.companyLocation).toBe('Bangalore, India');
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(7.0);
      expect(res.body.drive.eligibilityCriteria.requiredCourses).toEqual(['B.Tech', 'MCA']);
    });
  });

  // ─── 5. Protected & Immutable Fields Defense ────────────────────────────────
  describe('5. Protected & Immutable Fields Defense', () => {
    it('5.1 Attempt to modify _id returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          _id: new mongoose.Types.ObjectId(),
          jobRole: 'Software Engineer',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/protected field '_id'/i);
    });

    it('5.2 Attempt to modify createdAt returns 400', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          createdAt: new Date('2020-01-01'),
          jobRole: 'Software Engineer',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/protected field 'createdAt'/i);
    });
  });

  // ─── 6. Existing Applicant Protection & Confirmation Workflow ────────────────
  describe('6. Existing Applicant Protection & Confirmation Workflow', () => {
    it('6.1 Changing eligibility with 0 applicants succeeds without confirmation', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: {
            minTenthPercentage: 70,
            minTwelfthPercentage: 70,
            ugCriteriaType: 'CGPA',
            minCgpa: 8.0,
            maxBacklogs: 0,
            requiredCourses: ['B.Tech'],
            requiredSkills: ['React', 'TypeScript'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(8.0);
    });

    it('6.2 Changing eligibility with existing applicants and NO confirmation returns 409 Conflict', async () => {
      // Create an applicant
      await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: {
            minCgpa: 8.5,
            ugCriteriaType: 'CGPA',
          },
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED');
      expect(res.body.applicantCount).toBe(1);
      expect(res.body.message).toMatch(/confirmEligibilityImpact: true/i);

      // Verify drive was NOT modified
      const fresh = await PlacementDrive.findById(driveAlpha._id);
      expect(fresh.eligibilityCriteria.minCgpa).toBe(7.0);
    });

    it('6.3 Changing eligibility with existing applicants and confirmEligibilityImpact: false returns 409 Conflict', async () => {
      await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: {
            minCgpa: 8.5,
            ugCriteriaType: 'CGPA',
          },
          confirmEligibilityImpact: false,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED');

      // Verify drive was NOT modified
      const fresh = await PlacementDrive.findById(driveAlpha._id);
      expect(fresh.eligibilityCriteria.minCgpa).toBe(7.0);
    });

    it('6.4 Changing eligibility with existing applicants and confirmEligibilityImpact: true succeeds (200 OK)', async () => {
      await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          eligibilityCriteria: {
            minCgpa: 8.5,
            ugCriteriaType: 'CGPA',
          },
          confirmEligibilityImpact: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(8.5);

      // Verify confirmEligibilityImpact is NOT persisted on PlacementDrive document
      const fresh = await PlacementDrive.findById(driveAlpha._id).lean();
      expect(fresh.confirmEligibilityImpact).toBeUndefined();
    });

    it('6.5 Unchanged eligibility values do NOT trigger 409 even when applicants exist', async () => {
      await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      // Submit identical eligibility values while updating jobRole
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Principal Cloud Engineer',
          eligibilityCriteria: {
            minTenthPercentage: 60,
            minTwelfthPercentage: 60,
            ugCriteriaType: 'CGPA',
            minCgpa: 7.0,
            maxBacklogs: 0,
            requiredCourses: ['B.Tech', 'MCA'],
            requiredSkills: ['Node.js', 'JavaScript'], // Same skills in different order
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.jobRole).toBe('Principal Cloud Engineer');
    });

    it('6.6 Non-eligibility updates (e.g. package, location, role) do NOT require confirmation when applicants exist', async () => {
      await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Applied',
      });

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          packageDetails: '18 LPA',
          companyLocation: 'Hyderabad, India',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drive.packageDetails).toBe('18 LPA');
      expect(res.body.drive.companyLocation).toBe('Hyderabad, India');
    });
  });

  // ─── 7. Company Reference Handling ───────────────────────────────────────────
  describe('7. Company Reference Handling', () => {
    it('7.1 Updating companyName resolves to an existing company without creating duplicates', async () => {
      // Create another company
      const otherCompany = await Company.create({
        name: 'Nexus Innovations',
        industry: 'FinTech',
        website: 'https://nexus.io',
      });

      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyName: 'Nexus Innovations',
        });

      expect(res.status).toBe(200);
      expect(res.body.drive.company._id.toString()).toBe(otherCompany._id.toString());
      expect(res.body.drive.company.name).toBe('Nexus Innovations');

      // Ensure no duplicate company document was created
      const count = await Company.countDocuments({ name: 'Nexus Innovations' });
      expect(count).toBe(1);
    });

    it('7.2 Updating companyName creates a new company if it does not exist', async () => {
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyName: 'Starlight Robotics',
          industry: 'Robotics',
          website: 'https://starlight.ai',
        });

      expect(res.status).toBe(200);
      expect(res.body.drive.company.name).toBe('Starlight Robotics');

      const created = await Company.findOne({ name: 'Starlight Robotics' });
      expect(created).toBeDefined();
      expect(created.industry).toBe('Robotics');
    });

    it('7.3 Updating company on one drive does NOT mutate shared Company records of other drives', async () => {
      // Create a second drive referencing sharedCompany
      const driveTwo = await PlacementDrive.create({
        company: sharedCompany._id,
        collegeId: collegeAlpha._id,
        jobRole: 'QA Engineer',
        jobDescription: 'Software test automation role.',
        driveDate: new Date(),
        registrationDeadline: new Date(),
        isActive: true,
      });

      // Update company on driveAlpha
      await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyName: 'Quantum Computing Ltd',
        });

      // Verify original sharedCompany document was NOT renamed
      const originalCompanyDoc = await Company.findById(sharedCompany._id);
      expect(originalCompanyDoc.name).toBe('Global Tech Systems');

      // Verify driveTwo still cleanly points to Global Tech Systems
      const freshDriveTwo = await PlacementDrive.findById(driveTwo._id).populate('company');
      expect(freshDriveTwo.company.name).toBe('Global Tech Systems');
      expect(freshDriveTwo.company._id.toString()).toBe(sharedCompany._id.toString());
    });
  });

  // ─── 8. Regression Protection for Dependent Records ───────────────────────────
  describe('8. Regression Protection for Dependent Records', () => {
    it('8.1 Existing applications, attendance, and placement outcomes remain completely intact', async () => {
      // 1. Create Application
      const application = await DriveApplication.create({
        student: studentUser._id,
        placementDrive: driveAlpha._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      });

      // 2. Create Attendance
      const attendance = await DriveAttendance.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha._id,
        student: studentUser._id,
        application: application._id,
        departmentName: 'Computer Science',
        departmentResolutionStatus: 'RESOLVED',
        status: 'Present',
        markedBy: officerAlpha._id,
        markedAt: new Date(),
      });

      // 3. Create PlacementOutcome
      const outcome = await PlacementOutcome.create({
        collegeId: collegeAlpha._id,
        placementDrive: driveAlpha._id,
        application: application._id,
        student: studentUser._id,
        status: 'verified',
        verifiedBy: officerAlpha._id,
        verifiedAt: new Date(),
        departmentSnapshot: {
          departmentName: 'Computer Science',
          resolutionStatus: 'RESOLVED',
        },
        offerPackage: {
          ctc: 12.0,
          unit: 'LPA',
          currency: 'INR',
        },
      });

      // 4. Update the PlacementDrive
      const res = await request(app)
        .put(`/api/officer/drives/${driveAlpha._id}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          jobRole: 'Software Engineer Lead',
          packageDetails: '14 LPA',
          companyLocation: 'Pune, India',
        });

      expect(res.status).toBe(200);

      // 5. Verify all dependent records are 100% intact
      const appFresh = await DriveApplication.findById(application._id);
      expect(appFresh).toBeDefined();
      expect(appFresh.status).toBe('Selected');
      expect(appFresh.placementDrive.toString()).toBe(driveAlpha._id.toString());

      const attFresh = await DriveAttendance.findById(attendance._id);
      expect(attFresh).toBeDefined();
      expect(attFresh.status).toBe('Present');
      expect(attFresh.placementDrive.toString()).toBe(driveAlpha._id.toString());

      const outFresh = await PlacementOutcome.findById(outcome._id);
      expect(outFresh).toBeDefined();
      expect(outFresh.status).toBe('verified');
      expect(outFresh.offerPackage.ctc).toBe(12.0);
      expect(outFresh.placementDrive.toString()).toBe(driveAlpha._id.toString());
    });
  });
});

