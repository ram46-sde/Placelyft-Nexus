const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Feature 2: Student Profile Achievements & Field Integrity Tests', () => {
  let collegeAlpha;
  let collegeBeta;

  let studentAlpha;
  let tokenAlpha;

  let studentBeta;
  let tokenBeta;

  let officerAlpha;
  let tokenOfficer;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Engineering Institute',
      contactEmail: 'admin@alpha.edu',
    });

    collegeBeta = await College.create({
      name: 'Beta Technical University',
      contactEmail: 'admin@beta.edu',
    });

    // 2. Verified Student in College Alpha
    studentAlpha = await User.create({
      name: 'Alice Johnson',
      email: 'alice@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenAlpha = generateToken(studentAlpha._id, studentAlpha.role);

    // 3. Verified Student in College Beta
    studentBeta = await User.create({
      name: 'Bob Smith',
      email: 'bob@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenBeta = generateToken(studentBeta._id, studentBeta.role);

    // 4. Officer in College Alpha
    officerAlpha = await User.create({
      name: 'Officer Davis',
      email: 'davis@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficer = generateToken(officerAlpha._id, officerAlpha.role);
  });

  describe('1. Adding and Retrieving Achievements', () => {
    it('should allow student to add achievements to profile and retrieve them via GET /api/student/profile', async () => {
      const achievementsPayload = [
        {
          title: '1st Place - Smart India Hackathon',
          description: 'Developed an automated disaster relief routing system.',
          date: 'March 2024',
          issuer: 'Ministry of Education',
          certificateUrl: 'https://example.com/sih-cert.pdf',
        },
        {
          title: 'ACM ICPC Regional Finalist',
          description: 'Ranked in top 20 teams in regional contest.',
          date: 'December 2023',
          issuer: 'ACM ICPC',
          certificateUrl: 'https://example.com/icpc-cert.pdf',
        },
      ];

      const putRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          rollNumber: 'ALPHA-001',
          department: 'Computer Science',
          course: 'B.Tech',
          batch: '2025',
          achievements: achievementsPayload,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.profile.achievements).toHaveLength(2);
      expect(putRes.body.profile.achievements[0].title).toBe('1st Place - Smart India Hackathon');
      expect(putRes.body.profile.achievements[0].issuer).toBe('Ministry of Education');

      // Verify GET endpoint retrieves achievements
      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.profile.achievements).toHaveLength(2);
      expect(getRes.body.profile.achievements[1].title).toBe('ACM ICPC Regional Finalist');
    });

    it('should allow updating, appending, or removing achievements', async () => {
      // Step 1: Initial creation with 1 achievement
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          rollNumber: 'ALPHA-002',
          achievements: [
            {
              title: 'Initial Achievement',
              description: 'Initial description',
            },
          ],
        });

      // Step 2: Update with revised list (replacement/deletion)
      const updateRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: [
            {
              title: 'Revised Achievement',
              description: 'Updated description',
              date: '2024',
            },
            {
              title: 'Second Achievement',
              description: 'Another honor',
            },
          ],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.profile.achievements).toHaveLength(2);
      expect(updateRes.body.profile.achievements[0].title).toBe('Revised Achievement');

      // Step 3: Remove all achievements (empty array)
      const clearRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: [],
        });

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.profile.achievements).toEqual([]);
    });
  });

  describe('2. Validation of Achievements', () => {
    it('should reject non-array achievements with 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: 'not-an-array',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Achievements must be an array/i);
    });

    it('should reject achievement with missing or blank title with 400', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: [
            {
              description: 'Missing title',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must have a valid title/i);
    });
  });

  describe('3. Field Preservation and Photo Reference Compatibility', () => {
    it('should preserve achievements when updating academic or professional profile fields', async () => {
      // 1. Create profile with achievements, projects, and certifications
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          rollNumber: 'ALPHA-003',
          department: 'Computer Science',
          achievements: [
            { title: 'Hackathon Winner', issuer: 'Major Tech Corp' },
          ],
          projects: [
            { title: 'E-Commerce Platform', link: 'https://github.com/test' },
          ],
          certifications: [
            { name: 'AWS Certified Cloud Practitioner', issuer: 'AWS' },
          ],
          profilePhotoUrl: '/uploads/avatars/alice-photo.webp',
        });

      // 2. Update only CGPA and backlogs (without specifying achievements or photo)
      const updateRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          cgpa: 9.2,
          backlogs: 0,
        });

      expect(updateRes.status).toBe(200);
      const profile = updateRes.body.profile;

      // Ensure achievements, projects, certifications, and photo are intact
      expect(profile.cgpa).toBe(9.2);
      expect(profile.achievements).toHaveLength(1);
      expect(profile.achievements[0].title).toBe('Hackathon Winner');
      expect(profile.projects).toHaveLength(1);
      expect(profile.projects[0].title).toBe('E-Commerce Platform');
      expect(profile.certifications).toHaveLength(1);
      expect(profile.certifications[0].name).toBe('AWS Certified Cloud Practitioner');
      expect(profile.profilePhotoUrl).toBe('/uploads/avatars/alice-photo.webp');
    });

    it('should preserve profilePhotoUrl when updating achievements', async () => {
      // Set initial profile with photo
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          profilePhotoUrl: '/uploads/profile-photos/safe-uuid-123.jpg',
        });

      // Update achievements only
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: [{ title: 'Codeforces Master' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.profilePhotoUrl).toBe('/uploads/profile-photos/safe-uuid-123.jpg');
      expect(res.body.profile.achievements).toHaveLength(1);
    });
  });

  describe('4. Multi-Tenant and Role Isolation', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .send({ achievements: [{ title: 'Hacked' }] });

      expect(res.status).toBe(401);
    });

    it('should reject non-student roles with 403', async () => {
      const res = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenOfficer}`)
        .send({ achievements: [{ title: 'Officer Achievement' }] });

      expect(res.status).toBe(403);
    });

    it('should isolate achievements between students across tenants', async () => {
      // Student Alpha creates achievement
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          achievements: [{ title: 'Alpha Student Achievement' }],
        });

      // Student Beta creates different achievement
      await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenBeta}`)
        .send({
          achievements: [{ title: 'Beta Student Achievement' }],
        });

      // Query Alpha
      const alphaRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(alphaRes.body.profile.achievements[0].title).toBe('Alpha Student Achievement');

      // Query Beta
      const betaRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenBeta}`);

      expect(betaRes.body.profile.achievements[0].title).toBe('Beta Student Achievement');
    });
  });
});
