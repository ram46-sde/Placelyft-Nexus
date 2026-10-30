const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const StudentProfile = require('../models/StudentProfile');
const DriveApplication = require('../models/DriveApplication');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Day 2 — Stage 1: Placement Officer Backend Workflow & Tenant Isolation', () => {
  let collegeAlpha;
  let collegeBeta;
  let company;
  let driveAlpha;
  let driveBeta;
  let officerAlpha;
  let officerBeta;
  let officerNoCollege;
  let officerLegacyUnverified;
  let officerDeactivated;
  let recruiterUser;
  let superAdminUser;
  let studentAlpha;
  let studentBeta;
  let applicationAlpha;
  let profileAlpha;

  let officerAlphaToken;
  let officerBetaToken;
  let officerNoCollegeToken;
  let officerLegacyUnverifiedToken;
  let officerDeactivatedToken;
  let recruiterToken;
  let superAdminToken;
  let studentAlphaToken;
  let studentBetaToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    delete process.env.COLLEGE_ID;
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Engineering College',
      contactEmail: 'admin@alpha.edu',
      address: '100 Alpha Boulevard',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta Institute of Technology',
      contactEmail: 'admin@beta.edu',
      address: '200 Beta Avenue',
      isActive: true,
    });

    process.env.COLLEGE_ID = collegeAlpha._id.toString();

    // 2. Company
    company = await Company.create({
      name: 'Nexus Cloud Systems',
      industry: 'Enterprise Software',
      website: 'https://nexus.example.com',
      description: 'Distributed cloud infrastructure solutions',
    });

    // 3. Drives
    const driveDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    driveAlpha = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Development Engineer',
      jobDescription: 'Backend and cloud microservices development',
      packageDetails: '14 LPA',
      driveDate,
      registrationDeadline: deadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
        requiredSkills: ['Node.js', 'MongoDB'],
      },
    });

    driveBeta = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeBeta._id,
      jobRole: 'Site Reliability Engineer',
      jobDescription: 'Infrastructure observability and automation',
      packageDetails: '16 LPA',
      driveDate,
      registrationDeadline: deadline,
      isActive: true,
      eligibilityCriteria: {
        minCgpa: 6.5,
        maxBacklogs: 0,
        requiredCourses: ['B.Tech'],
        requiredSkills: ['Linux', 'Go'],
      },
    });

    // 4. Officers
    officerAlpha = await User.create({
      name: 'Officer Alice Alpha',
      email: 'alice.officer@alpha.edu',
      password: 'SecurePassword123!',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    officerBeta = await User.create({
      name: 'Officer Bob Beta',
      email: 'bob.officer@beta.edu',
      password: 'SecurePassword123!',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    officerNoCollege = await User.create({
      name: 'Officer Orphan',
      email: 'orphan.officer@external.edu',
      password: 'SecurePassword123!',
      role: 'placement_officer',
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    officerLegacyUnverified = await User.create({
      name: 'Officer Legacy Unverified',
      email: 'unverified.officer@alpha.edu',
      password: 'SecurePassword123!',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'LEGACY_UNVERIFIED',
      isActive: true,
    });

    officerDeactivated = await User.create({
      name: 'Officer Deactivated',
      email: 'deactivated.officer@alpha.edu',
      password: 'SecurePassword123!',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: false,
    });

    recruiterUser = await User.create({
      name: 'Recruiter Ray',
      email: 'ray.recruiter@company.com',
      password: 'SecurePassword123!',
      role: 'recruiter',
      isActive: true,
    });

    superAdminUser = await User.create({
      name: 'Super Admin Sam',
      email: 'admin.super@platform.gov',
      password: 'SecurePassword123!',
      role: 'super_admin',
      isActive: true,
    });

    // 5. Students
    studentAlpha = await User.create({
      name: 'Student Sam Alpha',
      email: 'sam.student@alpha.edu',
      password: 'SecurePassword123!',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    studentBeta = await User.create({
      name: 'Student Brenda Beta',
      email: 'brenda.student@beta.edu',
      password: 'SecurePassword123!',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    // 6. Profiles
    profileAlpha = await StudentProfile.create({
      user: studentAlpha._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-CSE-2026-001',
      department: 'Computer Science',
      course: 'B.Tech',
      batch: '2026',
      cgpa: 8.75,
      backlogs: 0,
      skills: ['Node.js', 'MongoDB', 'React', 'TypeScript'],
      resumeUrl: 'https://cdn.example.com/resumes/sam_alpha.pdf',
    });

    await StudentProfile.create({
      user: studentBeta._id,
      collegeId: collegeBeta._id,
      rollNumber: 'BETA-IT-2026-002',
      department: 'Information Technology',
      course: 'B.Tech',
      batch: '2026',
      cgpa: 7.9,
      backlogs: 0,
      skills: ['Linux', 'Go', 'Docker'],
      resumeUrl: 'https://cdn.example.com/resumes/brenda_beta.pdf',
    });

    // 7. Initial application for driveAlpha
    applicationAlpha = await DriveApplication.create({
      student: studentAlpha._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    // 8. Generate Tokens
    officerAlphaToken = generateToken(officerAlpha._id, 'placement_officer');
    officerBetaToken = generateToken(officerBeta._id, 'placement_officer');
    officerNoCollegeToken = generateToken(officerNoCollege._id, 'placement_officer');
    officerLegacyUnverifiedToken = generateToken(officerLegacyUnverified._id, 'placement_officer');
    officerDeactivatedToken = generateToken(officerDeactivated._id, 'placement_officer');
    recruiterToken = generateToken(recruiterUser._id, 'recruiter');
    superAdminToken = generateToken(superAdminUser._id, 'super_admin');
    studentAlphaToken = generateToken(studentAlpha._id, 'student');
    studentBetaToken = generateToken(studentBeta._id, 'student');
  });

  // =========================================================================
  // Requirement 1: Unauthenticated requests are rejected
  // =========================================================================
  describe('Requirement 1: Unauthenticated requests rejection', () => {
    it('should reject unauthenticated POST /api/officer/drives with 401', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .send({ jobRole: 'Intern' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token/i);
    });

    it('should reject unauthenticated GET /api/officer/drives with 401', async () => {
      const res = await request(app).get('/api/officer/drives');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated GET /api/officer/drives/:id/applications with 401', async () => {
      const res = await request(app).get(`/api/officer/drives/${driveAlpha._id}/applications`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated PATCH /api/officer/applications/:id/status with 401', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 2: Student tokens cannot access officer endpoints
  // =========================================================================
  describe('Requirement 2: Student tokens role authorization', () => {
    it('should deny student token on POST /api/officer/drives with 403', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${studentAlphaToken}`)
        .send({ jobRole: 'Intern' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should deny student token on GET /api/officer/drives with 403', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${studentAlphaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should deny student token on GET /api/officer/drives/:id/applications with 403', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/applications`)
        .set('Authorization', `Bearer ${studentAlphaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should deny student token on PATCH /api/officer/applications/:id/status with 403', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${studentAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should deny recruiter token on officer endpoints with 403', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ jobRole: 'Intern' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should deny super_admin token on officer endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should deny deactivated placement officer with 403', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${officerDeactivatedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been deactivated/i);
    });
  });

  // =========================================================================
  // Requirement 3: Authorized officer can create a valid drive
  // =========================================================================
  describe('Requirement 3: Authorized officer drive creation', () => {
    it('should create a valid drive when referencing an existing company', async () => {
      const payload = {
        companyId: company._id.toString(),
        jobRole: 'Frontend Developer',
        jobDescription: 'Build modern React applications',
        packageDetails: '11 LPA',
        driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        eligibilityCriteria: {
          minCgpa: 7.5,
          maxBacklogs: 0,
          requiredCourses: ['B.Tech'],
          requiredSkills: ['React', 'CSS'],
        },
      };

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive).toBeDefined();
      expect(res.body.drive.jobRole).toBe('Frontend Developer');
      expect(res.body.drive.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(res.body.drive.company._id.toString()).toBe(company._id.toString());
      expect(res.body.drive.eligibilityCriteria.minCgpa).toBe(7.5);

      // Verify persistence in DB
      const dbDrive = await PlacementDrive.findById(res.body.drive._id);
      expect(dbDrive).not.toBeNull();
      expect(dbDrive.collegeId.toString()).toBe(collegeAlpha._id.toString());
    });

    it('should create a new company dynamically if companyName is provided', async () => {
      const payload = {
        companyName: 'Vertex AI Corp',
        industry: 'Artificial Intelligence',
        website: 'https://vertex.example.com',
        jobRole: 'Machine Learning Engineer',
        jobDescription: 'Train deep neural models',
        packageDetails: '18 LPA',
        driveDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        registrationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.drive.jobRole).toBe('Machine Learning Engineer');

      // Verify company created in DB
      const createdCompany = await Company.findOne({ name: 'Vertex AI Corp' });
      expect(createdCompany).not.toBeNull();
      expect(createdCompany.industry).toBe('Artificial Intelligence');
      expect(res.body.drive.company._id.toString()).toBe(createdCompany._id.toString());
    });

    it('should reject drive creation if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          // missing jobRole, jobDescription, company
          driveDate: new Date().toISOString(),
          registrationDeadline: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/jobRole/i);
    });

    it('should reject drive creation if deadline is after drive date', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyId: company._id.toString(),
          jobRole: 'QA Engineer',
          jobDescription: 'Test web software',
          driveDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deadline/i);
    });

    it('should reject drive creation if minCgpa is out of bounds', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyId: company._id.toString(),
          jobRole: 'QA Engineer',
          jobDescription: 'Test web software',
          driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          eligibilityCriteria: { minCgpa: 15 },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/minCgpa/i);
    });

    it('should return 404 when referenced company ObjectId does not exist', async () => {
      const nonExistentCompanyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyId: nonExistentCompanyId.toString(),
          jobRole: 'DevOps Lead',
          jobDescription: 'Manage cloud infrastructure',
          driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/referenced company not found/i);
    });

    it('should recover from MongoDB duplicate key race condition (code 11000) during company creation', async () => {
      const originalCreate = Company.create;
      const raceCompanyName = 'Concurrent Race Systems';

      // Spy on Company.create: simulate a concurrent worker inserting the company and throwing code 11000
      jest.spyOn(Company, 'create').mockImplementationOnce(async function (companyData) {
        await originalCreate.call(Company, companyData);
        const duplicateKeyErr = new Error('E11000 duplicate key error collection: companies index: name_1 dup key');
        duplicateKeyErr.code = 11000;
        throw duplicateKeyErr;
      });

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({
          companyName: raceCompanyName,
          jobRole: 'Distributed Systems Engineer',
          jobDescription: 'Concurrency race condition recovery test',
          driveDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        });

      Company.create.mockRestore();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.drive).toBeDefined();
      expect(res.body.drive.company.name).toBe(raceCompanyName);

      const savedCompany = await Company.findOne({ name: raceCompanyName });
      expect(savedCompany).not.toBeNull();
      expect(res.body.drive.company._id.toString()).toBe(savedCompany._id.toString());
    });
  });

  // =========================================================================
  // Requirement 4: Server-enforced collegeId overriding client-submitted collegeId
  // =========================================================================
  describe('Requirement 4: CollegeId server enforcement and override', () => {
    it('should enforce officer collegeId even if client sends another collegeId in body', async () => {
      const payload = {
        companyId: company._id.toString(),
        collegeId: collegeBeta._id.toString(), // Client attempts to hijack/spoof College Beta
        jobRole: 'Spoof Attempt Role',
        jobDescription: 'Checking tenant isolation',
        driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      // Must receive Alpha's ID, NOT Beta's ID
      expect(res.body.drive.collegeId.toString()).toBe(collegeAlpha._id.toString());
      expect(res.body.drive.collegeId.toString()).not.toBe(collegeBeta._id.toString());

      // Confirm in DB
      const savedDrive = await PlacementDrive.findById(res.body.drive._id);
      expect(savedDrive.collegeId.toString()).toBe(collegeAlpha._id.toString());
    });

    it('should reject officer with missing collegeId with 403', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerNoCollegeToken}`)
        .send({
          companyId: company._id.toString(),
          jobRole: 'Orphan Role',
          jobDescription: 'Orphan officer test',
          driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/institution/i);
    });

    it('should reject officer with LEGACY_UNVERIFIED assignment status with 403', async () => {
      const res = await request(app)
        .post('/api/officer/drives')
        .set('Authorization', `Bearer ${officerLegacyUnverifiedToken}`)
        .send({
          companyId: company._id.toString(),
          jobRole: 'Security Auditor',
          jobDescription: 'Audit cloud logs',
          driveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/unverified college status/i);
    });
  });

  // =========================================================================
  // Requirement 5: Officers see only drives belonging to their own college
  // =========================================================================
  describe('Requirement 5: Drive listing multi-tenant isolation', () => {
    it('should return only College Alpha drives for Officer Alpha', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.drives)).toBe(true);

      const returnedDriveIds = res.body.drives.map((d) => d._id.toString());
      expect(returnedDriveIds).toContain(driveAlpha._id.toString());
      expect(returnedDriveIds).not.toContain(driveBeta._id.toString());

      // Verify company populated
      expect(res.body.drives[0].company.name).toBe('Nexus Cloud Systems');
    });

    it('should return only College Beta drives for Officer Beta', async () => {
      const res = await request(app)
        .get('/api/officer/drives')
        .set('Authorization', `Bearer ${officerBetaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedDriveIds = res.body.drives.map((d) => d._id.toString());
      expect(returnedDriveIds).toContain(driveBeta._id.toString());
      expect(returnedDriveIds).not.toContain(driveAlpha._id.toString());
    });

    it('should ignore client query parameters attempting to fetch other colleges', async () => {
      const res = await request(app)
        .get(`/api/officer/drives?collegeId=${collegeBeta._id.toString()}`)
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(200);
      const returnedDriveIds = res.body.drives.map((d) => d._id.toString());
      expect(returnedDriveIds).toContain(driveAlpha._id.toString());
      expect(returnedDriveIds).not.toContain(driveBeta._id.toString());
    });
  });

  // =========================================================================
  // Requirement 6: Officers can retrieve applicants for their own college's drives
  // =========================================================================
  describe('Requirement 6: Retrieve applicants for own college drive', () => {
    it('should return applicant details and academicProfile excluding sensitive fields', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/applications`)
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.applications).toHaveLength(1);

      const appItem = res.body.applications[0];
      expect(appItem._id.toString()).toBe(applicationAlpha._id.toString());
      expect(appItem.status).toBe('Applied');

      // Student basic info
      expect(appItem.student).toBeDefined();
      expect(appItem.student._id.toString()).toBe(studentAlpha._id.toString());
      expect(appItem.student.name).toBe('Student Sam Alpha');
      expect(appItem.student.email).toBe('sam.student@alpha.edu');
      expect(appItem.student.password).toBeUndefined();

      // Academic profile info from StudentProfile
      expect(appItem.academicProfile).toBeDefined();
      expect(appItem.academicProfile.rollNumber).toBe('ALPHA-CSE-2026-001');
      expect(appItem.academicProfile.department).toBe('Computer Science');
      expect(appItem.academicProfile.cgpa).toBe(8.75);
      expect(appItem.academicProfile.skills).toEqual(
        expect.arrayContaining(['Node.js', 'MongoDB', 'React'])
      );
      expect(appItem.academicProfile.resumeUrl).toBe('https://cdn.example.com/resumes/sam_alpha.pdf');
    });

    it('should return 400 for invalid drive ID format', async () => {
      const res = await request(app)
        .get('/api/officer/drives/invalid-drive-id/applications')
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent drive ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/officer/drives/${nonExistentId}/applications`)
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 7: Cross-college applicant roster access is denied
  // =========================================================================
  describe('Requirement 7: Cross-college applicant roster access denied', () => {
    it('should deny Officer Beta access to College Alpha drive applicant roster with 403', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveAlpha._id}/applications`)
        .set('Authorization', `Bearer ${officerBetaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/outside your college/i);
    });

    it('should deny Officer Alpha access to College Beta drive applicant roster with 403', async () => {
      const res = await request(app)
        .get(`/api/officer/drives/${driveBeta._id}/applications`)
        .set('Authorization', `Bearer ${officerAlphaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/outside your college/i);
    });
  });

  // =========================================================================
  // Requirement 8: Valid application status update persists correctly
  // =========================================================================
  describe('Requirement 8: Valid application status update persistence', () => {
    it('should allow Officer Alpha to update application status to Shortlisted and persist in DB', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.status).toBe('Shortlisted');

      // Verify in database
      const dbApp = await DriveApplication.findById(applicationAlpha._id);
      expect(dbApp.status).toBe('Shortlisted');
    });

    it('should support transitions across all valid status enum values', async () => {
      const validStatuses = ['Interviewing', 'Selected', 'Rejected', 'Applied'];

      for (const nextStatus of validStatuses) {
        const res = await request(app)
          .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
          .set('Authorization', `Bearer ${officerAlphaToken}`)
          .send({ status: nextStatus });

        expect(res.status).toBe(200);
        expect(res.body.application.status).toBe(nextStatus);

        const dbApp = await DriveApplication.findById(applicationAlpha._id);
        expect(dbApp.status).toBe(nextStatus);
      }
    });
  });

  // =========================================================================
  // Requirement 9: Invalid status is rejected with 400
  // =========================================================================
  describe('Requirement 9: Invalid status rejection', () => {
    it('should reject arbitrary unsupported status strings with 400', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Hired' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/supported values/i);

      // Verify DB was NOT changed
      const dbApp = await DriveApplication.findById(applicationAlpha._id);
      expect(dbApp.status).toBe('Applied');
    });

    it('should reject missing or non-string status values with 400', async () => {
      const res1 = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({});

      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 12345 });

      expect(res2.status).toBe(400);
    });

    it('should reject invalid application ID format with 400', async () => {
      const res = await request(app)
        .patch('/api/officer/applications/bad-app-id/status')
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent application ID', async () => {
      const randomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/officer/applications/${randomId}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Shortlisted' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 10: Cross-college application status updates are denied
  // =========================================================================
  describe('Requirement 10: Cross-college application update denial', () => {
    it('should deny Officer Beta from updating College Alpha application with 403', async () => {
      const res = await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerBetaToken}`)
        .send({ status: 'Selected' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/outside your college/i);

      // DB status must remain unmodified
      const dbApp = await DriveApplication.findById(applicationAlpha._id);
      expect(dbApp.status).toBe('Applied');
    });

    it('should deny Officer Alpha from updating College Beta application with 403', async () => {
      // Create an application for College Beta
      const applicationBeta = await DriveApplication.create({
        student: studentBeta._id,
        placementDrive: driveBeta._id,
        collegeId: collegeBeta._id,
        status: 'Applied',
      });

      const res = await request(app)
        .patch(`/api/officer/applications/${applicationBeta._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Selected' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const dbApp = await DriveApplication.findById(applicationBeta._id);
      expect(dbApp.status).toBe('Applied');
    });
  });

  // =========================================================================
  // Requirement 11: Existing student endpoints and behavior remain compatible
  // =========================================================================
  describe('Requirement 11: Student endpoints compatibility', () => {
    it('should allow Student Alpha to view available drives in their college', async () => {
      const res = await request(app)
        .get('/api/student/drives')
        .set('Authorization', `Bearer ${studentAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.drives)).toBe(true);

      const drive = res.body.drives.find((d) => d._id.toString() === driveAlpha._id.toString());
      expect(drive).toBeDefined();
      expect(drive.company.name).toBe('Nexus Cloud Systems');
      expect(drive.eligibility).toBeDefined();
      expect(drive.eligibility.isEligible).toBe(true);
      expect(drive.hasApplied).toBe(true); // Since applicationAlpha exists
    });

    it('should reflect officer status updates in student applications endpoint', async () => {
      // Officer updates status to Selected
      await request(app)
        .patch(`/api/officer/applications/${applicationAlpha._id}/status`)
        .set('Authorization', `Bearer ${officerAlphaToken}`)
        .send({ status: 'Selected' });

      // Student checks their applications
      const res = await request(app)
        .get('/api/student/applications')
        .set('Authorization', `Bearer ${studentAlphaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].status).toBe('Selected');
      expect(res.body.applications[0].placementDrive.jobRole).toBe('Software Development Engineer');
      expect(res.body.applications[0].placementDrive.company.name).toBe('Nexus Cloud Systems');
    });
  });
});
