const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');
const app = require('../app');

const User = require('../models/User');
const College = require('../models/College');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const DriveApplication = require('../models/DriveApplication');
const PlacementOutcome = require('../models/PlacementOutcome');
const StudentProfile = require('../models/StudentProfile');
const Department = require('../models/Department');

const {
  verifyOutcomeService,
  revokeOutcomeService,
} = require('../services/placementOutcomeService');
const { getPlacementMetricsService } = require('../services/placementMetricsService');

describe('CPMS Phase 4D: Stage A - Read-Only Outcome List & Queue Endpoints', () => {
  jest.setTimeout(30000);

  let collegeAlpha;
  let collegeBeta;
  let officerAlpha;
  let officerBeta;
  let tokenAlpha;
  let tokenBeta;
  let companyAlpha;
  let driveAlphaActive;
  let driveAlphaArchived;

  const createAuthToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role, collegeId: user.collegeId },
      process.env.JWT_SECRET || 'phase4d_jwt_secret_at_least_32_chars_long!',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'phase4d_jwt_secret_at_least_32_chars_long!';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Colleges
    collegeAlpha = await College.create({
      name: 'College Alpha',
      contactEmail: 'admin@alpha.edu',
      address: '100 Alpha Rd',
    });

    collegeBeta = await College.create({
      name: 'College Beta',
      contactEmail: 'admin@beta.edu',
      address: '200 Beta St',
    });

    // 2. Departments in Alpha
    await Department.create({
      collegeId: collegeAlpha._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
    });

    // 3. Officers
    officerAlpha = await User.create({
      name: 'Officer Alpha',
      email: 'officer@alpha.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });

    officerBeta = await User.create({
      name: 'Officer Beta',
      email: 'officer@beta.edu',
      password: 'password123',
      role: 'placement_officer',
      collegeId: collegeBeta._id,
      collegeAssignmentStatus: 'VERIFIED',
    });

    tokenAlpha = createAuthToken(officerAlpha);
    tokenBeta = createAuthToken(officerBeta);

    // 4. Company & Drives
    companyAlpha = await Company.create({
      name: 'Alpha Tech Corp ' + Date.now(),
      industry: 'Technology',
    });

    driveAlphaActive = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Software Engineer',
      jobDescription: 'Backend systems',
      driveDate: new Date(Date.now() + 86400000),
      registrationDeadline: new Date(Date.now() + 86400000),
      isActive: true,
      isArchived: false,
    });

    driveAlphaArchived = await PlacementDrive.create({
      company: companyAlpha._id,
      collegeId: collegeAlpha._id,
      jobRole: 'Data Analyst',
      jobDescription: 'Analytics',
      driveDate: new Date(Date.now() - 86400000),
      registrationDeadline: new Date(Date.now() - 86400000),
      isActive: false,
      isArchived: true,
      archivedAt: new Date(),
    });
  });

  it('1. Tenant isolation: Officer Beta cannot access Alpha applications in queue or verified list', async () => {
    // Create student & application in Alpha
    const studentA = await User.create({
      name: 'Alice Alpha',
      email: 'alice@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    await StudentProfile.create({
      user: studentA._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS001',
      department: 'Computer Science and Engineering',
    });
    const appA = await DriveApplication.create({
      student: studentA._id,
      placementDrive: driveAlphaActive._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    // Queue query from Beta officer returns 0 rows
    const betaQueueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenBeta}`);

    expect(betaQueueRes.status).toBe(200);
    expect(betaQueueRes.body.queue).toHaveLength(0);
    expect(betaQueueRes.body.pagination.total).toBe(0);

    // Verify appA for Alpha
    await verifyOutcomeService({
      applicationId: appA._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      ctc: 12,
    });

    // Verified list query from Beta officer returns 0 rows
    const betaVerifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenBeta}`);

    expect(betaVerifiedRes.status).toBe(200);
    expect(betaVerifiedRes.body.outcomes).toHaveLength(0);
    expect(betaVerifiedRes.body.pagination.total).toBe(0);

    // Alpha officer sees the outcome
    const alphaVerifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(alphaVerifiedRes.status).toBe(200);
    expect(alphaVerifiedRes.body.outcomes).toHaveLength(1);
    expect(alphaVerifiedRes.body.outcomes[0].applicationId).toBe(appA._id.toString());
  });

  it('2. Verified outcomes are excluded from the queue; revoked outcomes with Selected status reappear', async () => {
    const student1 = await User.create({
      name: 'Bob Alpha',
      email: 'bob@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    const app1 = await DriveApplication.create({
      student: student1._id,
      placementDrive: driveAlphaActive._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    // 1. Initial Selected application -> In queue
    let queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(queueRes.body.queue).toHaveLength(1);
    expect(queueRes.body.queue[0].applicationId).toBe(app1._id.toString());

    // 2. Verify outcome -> Excluded from queue, present in verified
    await verifyOutcomeService({
      applicationId: app1._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      ctc: 14,
    });

    queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(queueRes.body.queue).toHaveLength(0);
    expect(queueRes.body.pagination.total).toBe(0);

    let verifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(verifiedRes.body.outcomes).toHaveLength(1);
    expect(verifiedRes.body.outcomes[0].ctc).toBe(14);

    // 3. Revoke outcome -> Reappears in queue (since status is still Selected), excluded from verified
    await revokeOutcomeService({
      applicationId: app1._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      reason: 'Candidate background check failed initially',
    });

    queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(queueRes.body.queue).toHaveLength(1);
    expect(queueRes.body.queue[0].applicationId).toBe(app1._id.toString());

    verifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(verifiedRes.body.outcomes).toHaveLength(0);
  });

  it('3. Legacy Selected applications without an outcome document appear in the queue', async () => {
    const studentLegacy = await User.create({
      name: 'Legacy Student',
      email: 'legacy@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });
    // Legacy document: status Selected, outcomeVerified undefined, no PlacementOutcome document exists
    const appLegacy = await DriveApplication.create({
      student: studentLegacy._id,
      placementDrive: driveAlphaActive._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    const queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.queue).toHaveLength(1);
    expect(queueRes.body.queue[0].applicationId).toBe(appLegacy._id.toString());
    expect(queueRes.body.queue[0].studentName).toBe('Legacy Student');
  });

  it('4. Queue total strictly equals Needs Verification metric and Verified total strictly equals Verified Offers', async () => {
    // Setup 4 students:
    // Student 1: Verified (15 LPA)
    // Student 2: Verified (20 LPA)
    // Student 3: Selected, unverified (in queue)
    // Student 4: Selected, verified then revoked (in queue)
    const students = await Promise.all([1, 2, 3, 4].map((i) =>
      User.create({
        name: `Student ${i}`,
        email: `s${i}@alpha.edu`,
        password: 'password123',
        role: 'student',
        collegeId: collegeAlpha._id,
        collegeAssignmentStatus: 'VERIFIED',
      })
    ));

    const apps = await Promise.all(students.map((s) =>
      DriveApplication.create({
        student: s._id,
        placementDrive: driveAlphaActive._id,
        collegeId: collegeAlpha._id,
        status: 'Selected',
      })
    ));

    // Verify apps 0 and 1
    await verifyOutcomeService({ applicationId: apps[0]._id, collegeId: collegeAlpha._id, officerUser: officerAlpha, ctc: 15 });
    await verifyOutcomeService({ applicationId: apps[1]._id, collegeId: collegeAlpha._id, officerUser: officerAlpha, ctc: 20 });

    // Verify then revoke app 3
    await verifyOutcomeService({ applicationId: apps[3]._id, collegeId: collegeAlpha._id, officerUser: officerAlpha, ctc: 10 });
    await revokeOutcomeService({ applicationId: apps[3]._id, collegeId: collegeAlpha._id, officerUser: officerAlpha, reason: 'Revocation reason text test' });

    // Fetch metrics via service
    const metrics = await getPlacementMetricsService({ collegeId: collegeAlpha._id });

    // Fetch queue and verified lists via HTTP
    const queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    const verifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(queueRes.body.pagination.total).toBe(metrics.needsVerification);
    expect(queueRes.body.pagination.total).toBe(2); // app 2 and app 3

    expect(verifiedRes.body.pagination.total).toBe(metrics.verifiedOffers);
    expect(verifiedRes.body.pagination.total).toBe(2); // app 0 and app 1
  });

  it('5. Pagination has deterministic sorting and no duplicates or gaps across pages', async () => {
    // Create 7 Selected applications in queue
    const students = await Promise.all(
      Array.from({ length: 7 }).map((_, i) =>
        User.create({
          name: `Pagination Student ${i + 1}`,
          email: `pag${i + 1}@alpha.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeAlpha._id,
          collegeAssignmentStatus: 'VERIFIED',
        })
      )
    );

    const apps = await Promise.all(
      students.map((s) =>
        DriveApplication.create({
          student: s._id,
          placementDrive: driveAlphaActive._id,
          collegeId: collegeAlpha._id,
          status: 'Selected',
        })
      )
    );

    // Fetch page 1 (limit 3)
    const page1Res = await request(app)
      .get('/api/officer/outcomes/queue?page=1&limit=3')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(page1Res.body.queue).toHaveLength(3);
    expect(page1Res.body.pagination.page).toBe(1);
    expect(page1Res.body.pagination.total).toBe(7);
    expect(page1Res.body.pagination.totalPages).toBe(3);

    // Fetch page 2 (limit 3)
    const page2Res = await request(app)
      .get('/api/officer/outcomes/queue?page=2&limit=3')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(page2Res.body.queue).toHaveLength(3);
    expect(page2Res.body.pagination.page).toBe(2);

    // Fetch page 3 (limit 3)
    const page3Res = await request(app)
      .get('/api/officer/outcomes/queue?page=3&limit=3')
      .set('Authorization', `Bearer ${tokenAlpha}`);
    expect(page3Res.body.queue).toHaveLength(1);
    expect(page3Res.body.pagination.page).toBe(3);

    // Check no duplicates across pages
    const idsPage1 = page1Res.body.queue.map((r) => r.applicationId);
    const idsPage2 = page2Res.body.queue.map((r) => r.applicationId);
    const idsPage3 = page3Res.body.queue.map((r) => r.applicationId);

    const allIds = [...idsPage1, ...idsPage2, ...idsPage3];
    const uniqueIds = new Set(allIds);

    expect(allIds).toHaveLength(7);
    expect(uniqueIds.size).toBe(7);
  });

  it('6. Archived-drive rows appear with driveLifecycleState: "archived"', async () => {
    const studentArchived = await User.create({
      name: 'Archived Drive Student',
      email: 'archived_student@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });

    const appArchived = await DriveApplication.create({
      student: studentArchived._id,
      placementDrive: driveAlphaArchived._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    const queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    expect(queueRes.status).toBe(200);
    const row = queueRes.body.queue.find((r) => r.applicationId === appArchived._id.toString());
    expect(row).toBeDefined();
    expect(row.driveLifecycleState).toBe('archived');
  });

  it('7. Whitelist enforcement: response contains strictly zero forbidden keys', async () => {
    const student = await User.create({
      name: 'Whitelist Student',
      email: 'whitelist_secret_email@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeAlpha._id,
      collegeAssignmentStatus: 'VERIFIED',
    });

    await StudentProfile.create({
      user: student._id,
      collegeId: collegeAlpha._id,
      rollNumber: 'CS999',
      cgpa: 9.8,
      backlogs: 0,
      resumeUrl: 'https://secret.resume.url',
    });

    const appRecord = await DriveApplication.create({
      student: student._id,
      placementDrive: driveAlphaActive._id,
      collegeId: collegeAlpha._id,
      status: 'Selected',
    });

    // 7a. Check queue response
    const queueRes = await request(app)
      .get('/api/officer/outcomes/queue')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    const queueRow = queueRes.body.queue[0];
    const forbiddenKeys = ['email', 'phone', 'cgpa', 'backlogs', 'resume', 'resumeUrl', 'history'];

    for (const key of forbiddenKeys) {
      expect(queueRow[key]).toBeUndefined();
    }
    expect(JSON.stringify(queueRes.body)).not.toContain('whitelist_secret_email@alpha.edu');
    expect(JSON.stringify(queueRes.body)).not.toContain('https://secret.resume.url');

    // 7b. Check verified response
    await verifyOutcomeService({
      applicationId: appRecord._id,
      collegeId: collegeAlpha._id,
      officerUser: officerAlpha,
      ctc: 25,
    });

    const verifiedRes = await request(app)
      .get('/api/officer/outcomes')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    const verifiedRow = verifiedRes.body.outcomes[0];
    for (const key of forbiddenKeys) {
      expect(verifiedRow[key]).toBeUndefined();
    }
    expect(verifiedRow.verifiedBy).toBeDefined();
    expect(verifiedRow.verifiedBy.name).toBe('Officer Alpha');
    expect(verifiedRow.verifiedBy.email).toBeUndefined();
    expect(JSON.stringify(verifiedRes.body)).not.toContain('whitelist_secret_email@alpha.edu');
  });
});
