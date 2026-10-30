const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const generateToken = require('../utils/generateToken');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const { PHOTO_UPLOAD_DIR } = require('../middleware/photoUploadMiddleware');

describe('Feature 2: Student Profile Photo Upload, Storage & Security Tests', () => {
  let collegeAlpha;
  let collegeBeta;

  let studentAlpha1;
  let tokenAlpha1;

  let studentAlpha2;
  let tokenAlpha2;

  let studentBeta;
  let tokenBeta;

  let officerAlpha;
  let tokenOfficer;

  // Reusable valid image buffers
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  ]);

  // Track created files to ensure test cleanup
  const createdTestFiles = new Set();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'super_secure_test_jwt_secret_key_at_least_32_chars!';
    await connectTestDb();
  });

  afterAll(async () => {
    // Cleanup any lingering files created in tests
    for (const filePath of createdTestFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore
        }
      }
    }
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Tech',
      contactEmail: 'admin@alpha.edu',
    });

    collegeBeta = await College.create({
      name: 'Beta State University',
      contactEmail: 'admin@beta.edu',
    });

    // 2. Verified Student 1 in College Alpha
    studentAlpha1 = await User.create({
      name: 'Alice Springs',
      email: 'alice@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenAlpha1 = generateToken(studentAlpha1._id, studentAlpha1.role);

    // 3. Verified Student 2 in College Alpha
    studentAlpha2 = await User.create({
      name: 'Alex Rivera',
      email: 'alex@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenAlpha2 = generateToken(studentAlpha2._id, studentAlpha2.role);

    // 4. Verified Student in College Beta
    studentBeta = await User.create({
      name: 'Bob Miller',
      email: 'bob@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenBeta = generateToken(studentBeta._id, studentBeta.role);

    // 5. Placement Officer in College Alpha
    officerAlpha = await User.create({
      name: 'Officer Jenkins',
      email: 'jenkins@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    tokenOfficer = generateToken(officerAlpha._id, officerAlpha.role);
  });

  describe('1. Valid Image Uploads (JPEG, PNG, WebP)', () => {
    it('should upload a valid JPEG photo and return a safe relative URL', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validJpegBuffer, {
          filename: 'original-user-name.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photoUrl).toBeDefined();
      expect(res.body.photoUrl).toMatch(/^\/uploads\/profile-photos\/student-.*\.jpg$/);

      // Verify filename is safe and doesn't contain user-supplied name
      expect(res.body.photoUrl).not.toContain('original-user-name');

      // Verify file exists on disk
      const localFilename = path.basename(res.body.photoUrl);
      const diskPath = path.join(PHOTO_UPLOAD_DIR, localFilename);
      expect(fs.existsSync(diskPath)).toBe(true);
      createdTestFiles.add(diskPath);

      // Verify profile in DB was updated
      const profileInDb = await StudentProfile.findOne({ user: studentAlpha1._id });
      expect(profileInDb.profilePhotoUrl).toBe(res.body.photoUrl);
    });

    it('should upload a valid PNG photo', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validPngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.photoUrl).toMatch(/^\/uploads\/profile-photos\/student-.*\.png$/);

      const localFilename = path.basename(res.body.photoUrl);
      const diskPath = path.join(PHOTO_UPLOAD_DIR, localFilename);
      expect(fs.existsSync(diskPath)).toBe(true);
      createdTestFiles.add(diskPath);
    });

    it('should upload a valid WebP photo', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validWebpBuffer, {
          filename: 'avatar.webp',
          contentType: 'image/webp',
        });

      expect(res.status).toBe(200);
      expect(res.body.photoUrl).toMatch(/^\/uploads\/profile-photos\/student-.*\.webp$/);

      const localFilename = path.basename(res.body.photoUrl);
      const diskPath = path.join(PHOTO_UPLOAD_DIR, localFilename);
      expect(fs.existsSync(diskPath)).toBe(true);
      createdTestFiles.add(diskPath);
    });
  });

  describe('2. Photo Replacement and Orphan Cleanup', () => {
    it('should safely replace an existing photo and clean up old file from disk', async () => {
      // Step 1: Upload first photo
      const res1 = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validJpegBuffer, {
          filename: 'first.jpg',
          contentType: 'image/jpeg',
        });

      const firstPhotoUrl = res1.body.photoUrl;
      const firstDiskPath = path.join(PHOTO_UPLOAD_DIR, path.basename(firstPhotoUrl));
      expect(fs.existsSync(firstDiskPath)).toBe(true);
      createdTestFiles.add(firstDiskPath);

      // Step 2: Upload replacement photo
      const res2 = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validPngBuffer, {
          filename: 'second.png',
          contentType: 'image/png',
        });

      expect(res2.status).toBe(200);
      const secondPhotoUrl = res2.body.photoUrl;
      const secondDiskPath = path.join(PHOTO_UPLOAD_DIR, path.basename(secondPhotoUrl));
      createdTestFiles.add(secondDiskPath);

      // Verify second file exists
      expect(fs.existsSync(secondDiskPath)).toBe(true);
      // Verify first file was cleaned up and deleted from disk
      expect(fs.existsSync(firstDiskPath)).toBe(false);

      // Verify DB contains only second photo URL
      const profile = await StudentProfile.findOne({ user: studentAlpha1._id });
      expect(profile.profilePhotoUrl).toBe(secondPhotoUrl);
    });
  });

  describe('3. Validation & Security Rejections', () => {
    it('should reject unsupported file extension and MIME type with 400', async () => {
      const textBuffer = Buffer.from('This is a text file, not an image');
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', textBuffer, {
          filename: 'resume.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unsupported image format/i);
    });

    it('should reject disguised non-image files (e.g. SVG or HTML named as .png) via magic byte check', async () => {
      const fakePngBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', fakePngBuffer, {
          filename: 'malicious.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unsupported or corrupted image file/i);
    });

    it('should reject files exceeding 5 MB limit with 400', async () => {
      // 5.2 MB buffer
      const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024);
      // Set valid JPEG magic header so it passes format filter before size check
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', oversizedBuffer, {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/5 MB limit/i);
    });

    it('should reject request when no file is attached under "photo" field', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No photo file provided/i);
    });
  });

  describe('4. Authentication & Multi-Tenant Authorization', () => {
    it('should reject unauthenticated upload requests with 401', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .attach('photo', validJpegBuffer, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-student roles (placement_officer) with 403', async () => {
      const res = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenOfficer}`)
        .attach('photo', validJpegBuffer, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(403);
    });

    it('should ensure student uploads attach strictly to own profile and do not leak cross-student', async () => {
      // Student Alpha 1 uploads photo
      const res1 = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validJpegBuffer, {
          filename: 'alpha1.jpg',
          contentType: 'image/jpeg',
        });

      expect(res1.status).toBe(200);
      createdTestFiles.add(path.join(PHOTO_UPLOAD_DIR, path.basename(res1.body.photoUrl)));

      // Student Alpha 2 checks profile: must not have Alpha 1 photo
      const profileRes2 = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha2}`);

      expect(profileRes2.status).toBe(200);
      expect(profileRes2.body.profile).toBeNull(); // No profile yet
    });
  });

  describe('5. Profile Integration and Field Preservation', () => {
    it('should retrieve photoUrl when fetching profile via GET /api/student/profile', async () => {
      await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validJpegBuffer, {
          filename: 'alice.jpg',
          contentType: 'image/jpeg',
        });

      const getRes = await request(app)
        .get('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha1}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.profile.profilePhotoUrl).toMatch(/^\/uploads\/profile-photos\//);
    });

    it('should preserve profile photo reference when other profile fields are updated', async () => {
      // 1. Upload photo
      const uploadRes = await request(app)
        .post('/api/student/profile/photo')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .attach('photo', validJpegBuffer, {
          filename: 'alice.jpg',
          contentType: 'image/jpeg',
        });

      const savedPhotoUrl = uploadRes.body.photoUrl;
      createdTestFiles.add(path.join(PHOTO_UPLOAD_DIR, path.basename(savedPhotoUrl)));

      // 2. Perform regular profile update (without photo field)
      const updateRes = await request(app)
        .put('/api/student/profile')
        .set('Authorization', `Bearer ${tokenAlpha1}`)
        .send({
          rollNumber: 'ALICE-01',
          department: 'Information Science',
          cgpa: 9.5,
          achievements: [{ title: 'Gold Medalist' }],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.profile.rollNumber).toBe('ALICE-01');
      expect(updateRes.body.profile.profilePhotoUrl).toBe(savedPhotoUrl);
      expect(updateRes.body.profile.achievements).toHaveLength(1);
    });
  });
});
