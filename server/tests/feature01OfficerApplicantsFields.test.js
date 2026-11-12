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

/**
 * Feature 01: Enhanced Student Details Panel — Stage 3 Tests
 *
 * Verifies that GET /api/officer/drives/:id/applications returns
 * `section` and `academicYear` on the academicProfile object,
 * while preserving all existing response structures, tenant isolation,
 * role authorization, and graceful null handling for legacy profiles.
 */
describe('Feature 01 Stage 3: Officer Applicants API — section & academicYear Integration', () => {
  let collegeAlpha;
  let collegeBeta;
  let officerAlpha;
  let officerBeta;
  let officerAlphaToken;
  let officerBetaToken;
  let company;
  let driveAlpha;
  let student1;
  let student2;
  let studentLegacy;
  let studentNull;
  let studentToken;
  let recruiterUser;
  let recruiterToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'feature01_stage3_jwt_secret_key_at_least_32_characters!!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Colleges
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

    process.env.COLLEGE_ID = collegeAlpha._id.toString();

    // 2. Setup Officers
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

    // 3. Setup Company & Drive for College Alpha
    company = await Company.create({
      name: 'Nexus Tech Innovations',
      industry: 'Software',
      website: 'https://nexustech.example.com',
    });

    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    driveAlpha = await PlacementDrive.create({
      company: company._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Development Engineer',
      jobDescription: 'Design and build cloud-native services',
      packageDetails: '14 LPA',
      driveDate: futureDate,
      registrationDeadline: futureDeadline,
      isActive: true,
    });

    // 4. Setup Students and Profiles
    // Student 1: section = 'A', academicYear = 'IV'
    student1 = await User.create({
      name: 'Aarav Sharma',
      email: 'aarav@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });
    studentToken = generateToken(student1._id, student1.role);

    await StudentProfile.create({
      user: student1._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-CSE-001',
      department: 'Computer Science',
      course: 'B.Tech',
      batch: '2026',
      section: 'A',
      academicYear: 'IV',
      cgpa: 8.75,
      backlogs: 0,
      skills: ['Node.js', 'React', 'MongoDB'],
      resumeUrl: 'https://cdn.example.com/resumes/aarav.pdf',
    });

    await DriveApplication.create({
      student: student1._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    // Student 2: section = 'B', academicYear = 'III'
    student2 = await User.create({
      name: 'Bhavna Patel',
      email: 'bhavna@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    await StudentProfile.create({
      user: student2._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-IT-002',
      department: 'Information Technology',
      course: 'B.Tech',
      batch: '2027',
      section: 'B',
      academicYear: 'III',
      cgpa: 9.1,
      backlogs: 0,
      skills: ['Python', 'Docker'],
      resumeUrl: 'https://cdn.example.com/resumes/bhavna.pdf',
    });

    await DriveApplication.create({
      student: student2._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Shortlisted',
    });

    // Student 3: Legacy profile without section or academicYear fields
    studentLegacy = await User.create({
      name: 'Chetan Kumar',
      email: 'chetan@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    await StudentProfile.create({
      user: studentLegacy._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-MECH-003',
      department: 'Mechanical Engineering',
      course: 'B.Tech',
      batch: '2025',
      cgpa: 7.8,
      backlogs: 1,
      skills: ['AutoCAD'],
    });

    await DriveApplication.create({
      student: studentLegacy._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Applied',
    });

    // Student 4: Explicit null section and academicYear
    studentNull = await User.create({
      name: 'Divya Reddy',
      email: 'divya@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
      isActive: true,
    });

    await StudentProfile.create({
      user: studentNull._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'ALPHA-ECE-004',
      department: 'Electronics',
      course: 'B.Tech',
      batch: '2026',
      section: null,
      academicYear: null,
      cgpa: 8.2,
      backlogs: 0,
    });

    await DriveApplication.create({
      student: studentNull._id,
      placementDrive: driveAlpha._id,
      collegeId: collegeAlpha._id,
      status: 'Interviewing',
    });

    // Recruiter User
    recruiterUser = await User.create({
      name: 'Recruiter Bob',
      email: 'recruiter@nexus.com',
      password: 'password123',
      role: 'recruiter',
      companyId: company._id,
      isActive: true,
    });
    recruiterToken = generateToken(recruiterUser._id, recruiterUser.role);
  });

  // ─── 1. Applicant API returns section correctly ───────────────────────
  it('1. Applicant API returns section correctly', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const appAarav = res.body.applications.find(
      (a) => a.student && a.student.name === 'Aarav Sharma'
    );
    expect(appAarav).toBeDefined();
    expect(appAarav.academicProfile).toBeDefined();
    expect(appAarav.academicProfile.section).toBe('A');
  });

  // ─── 2. Applicant API returns academicYear correctly ──────────────────
  it('2. Applicant API returns academicYear correctly', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    const appAarav = res.body.applications.find(
      (a) => a.student && a.student.name === 'Aarav Sharma'
    );
    expect(appAarav.academicProfile.academicYear).toBe('IV');
  });

  // ─── 3. Applicant API returns both fields together ────────────────────
  it('3. Applicant API returns both fields together across multiple applicants', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(4);

    const appAarav = res.body.applications.find((a) => a.student?.name === 'Aarav Sharma');
    const appBhavna = res.body.applications.find((a) => a.student?.name === 'Bhavna Patel');

    expect(appAarav.academicProfile.section).toBe('A');
    expect(appAarav.academicProfile.academicYear).toBe('IV');

    expect(appBhavna.academicProfile.section).toBe('B');
    expect(appBhavna.academicProfile.academicYear).toBe('III');
  });

  // ─── 4. Legacy profiles with missing fields return null ───────────────
  it('4. Legacy profiles with missing fields return null', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    const appChetan = res.body.applications.find((a) => a.student?.name === 'Chetan Kumar');
    expect(appChetan).toBeDefined();
    expect(appChetan.academicProfile.section).toBeNull();
    expect(appChetan.academicProfile.academicYear).toBeNull();
  });

  // ─── 5. Null values do not break applicant serialization ──────────────
  it('5. Null values do not break applicant serialization', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    const appDivya = res.body.applications.find((a) => a.student?.name === 'Divya Reddy');
    expect(appDivya).toBeDefined();
    expect(appDivya.academicProfile.section).toBeNull();
    expect(appDivya.academicProfile.academicYear).toBeNull();
    expect(appDivya.academicProfile.rollNumber).toBe('ALPHA-ECE-004');
    expect(appDivya.academicProfile.cgpa).toBe(8.2);
  });

  // ─── 6. Existing applicant response fields remain unchanged ───────────
  it('6. Existing applicant response fields remain unchanged', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.drive).toBeDefined();
    expect(res.body.drive._id.toString()).toBe(driveAlpha._id.toString());
    expect(res.body.drive.jobRole).toBe('Software Development Engineer');

    const appAarav = res.body.applications.find((a) => a.student?.name === 'Aarav Sharma');
    expect(appAarav._id).toBeDefined();
    expect(appAarav.status).toBe('Applied');
    expect(appAarav.appliedAt).toBeDefined();
    expect(appAarav.student._id.toString()).toBe(student1._id.toString());
    expect(appAarav.student.name).toBe('Aarav Sharma');
    expect(appAarav.student.email).toBe('aarav@alpha.edu');

    // Academic profile standard fields
    expect(appAarav.academicProfile.rollNumber).toBe('ALPHA-CSE-001');
    expect(appAarav.academicProfile.department).toBe('Computer Science');
    expect(appAarav.academicProfile.course).toBe('B.Tech');
    expect(appAarav.academicProfile.batch).toBe('2026');
    expect(appAarav.academicProfile.backlogs).toBe(0);
    expect(appAarav.academicProfile.skills).toEqual(
      expect.arrayContaining(['Node.js', 'React', 'MongoDB'])
    );
  });

  // ─── 7. Existing CGPA and resume values remain unchanged ──────────────
  it('7. Existing CGPA and resume values remain unchanged', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerAlphaToken}`);

    expect(res.status).toBe(200);
    const appAarav = res.body.applications.find((a) => a.student?.name === 'Aarav Sharma');
    expect(appAarav.academicProfile.cgpa).toBe(8.75);
    expect(appAarav.academicProfile.resumeUrl).toBe('https://cdn.example.com/resumes/aarav.pdf');
  });

  // ─── 8. Officer from another college cannot access drive applicants ───
  it('8. Officer from another college cannot access the drive applicant details', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${officerBetaToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/outside your college is forbidden/i);
  });

  // ─── 9. Unauthenticated requests remain rejected ──────────────────────
  it('9. Unauthenticated requests remain rejected with 401', async () => {
    const res = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`);

    expect(res.status).toBe(401);
  });

  // ─── 10. Non-officer roles remain unauthorized ────────────────────────
  it('10. Non-officer roles remain unauthorized with 403', async () => {
    // Student token rejected
    const studentRes = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(studentRes.status).toBe(403);

    // Recruiter token rejected
    const recruiterRes = await request(app)
      .get(`/api/officer/drives/${driveAlpha._id}/applications`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(recruiterRes.status).toBe(403);
  });
});

