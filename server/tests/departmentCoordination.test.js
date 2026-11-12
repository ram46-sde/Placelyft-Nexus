const mongoose = require('mongoose');
const Department = require('../models/Department');
const College = require('../models/College');
const {
  acquireWriterToken,
  releaseWriterToken,
  acquireBatchWriterTokens,
  releaseBatchWriterTokens,
  claimDepartmentDeletion,
  restoreDepartmentDeletion,
} = require('../utils/departmentCoordination');
const { connectTestDb, disconnectTestDb, clearTestDb } = require('./testDb');

describe('Stage 1: Department Coordination Schema and Core Helpers', () => {
  jest.setTimeout(30000);

  let collegeAlpha;
  let collegeBeta;
  let deptCseAlpha;
  let deptEceAlpha;
  let deptMechAlpha;
  let deptBeta;

  beforeAll(async () => {
    // Connect strictly to approved college_placement_test_db
    await connectTestDb();
    await Department.createIndexes();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Setup colleges
    collegeAlpha = await College.create({
      name: 'Alpha Institute of Technology',
      isActive: true,
    });

    collegeBeta = await College.create({
      name: 'Beta State College',
      isActive: true,
    });

    // Setup departments for College Alpha
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
      isActive: true,
    });

    // Setup department for College Beta
    deptBeta = await Department.create({
      collegeId: collegeBeta._id,
      name: 'Computer Science and Engineering',
      code: 'CSE',
      isActive: true,
    });
  });

  describe('1. Department Schema Defaults & Legacy Compatibility', () => {
    test('should populate default coordination fields on newly created departments', async () => {
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('open');
      expect(Array.isArray(doc.activeWriterIds)).toBe(true);
      expect(doc.activeWriterIds).toEqual([]);
      expect(doc.deletionToken).toBeNull();
      expect(doc.deletionStartedAt).toBeNull();
    });

    test('should allow writer-token acquisition on legacy documents without coordination fields', async () => {
      // Simulate an un-migrated legacy document by stripping the coordination fields directly in MongoDB
      await Department.collection.updateOne(
        { _id: deptCseAlpha._id },
        {
          $unset: {
            deletionState: 1,
            activeWriterIds: 1,
            deletionToken: 1,
            deletionStartedAt: 1,
          },
        }
      );

      // Verify fields are absent in raw document
      const rawBefore = await Department.collection.findOne({ _id: deptCseAlpha._id });
      expect(rawBefore.deletionState).toBeUndefined();
      expect(rawBefore.activeWriterIds).toBeUndefined();

      // Acquire writer token on the legacy document
      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(result.success).toBe(true);
      expect(typeof result.writerId).toBe('string');

      // Verify the writer token was pushed
      const rawAfter = await Department.collection.findOne({ _id: deptCseAlpha._id });
      expect(rawAfter.activeWriterIds).toEqual([result.writerId]);
    });
  });

  describe('2. Writer Token Acquisition', () => {
    test('should successfully acquire a writer token on an active open department', async () => {
      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(result.success).toBe(true);
      expect(result.writerId).toBeDefined();

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toContain(result.writerId);
    });

    test('should accept an explicit writerId when provided', async () => {
      const customId = 'custom-writer-uuid-12345';
      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: customId,
      });

      expect(result.success).toBe(true);
      expect(result.writerId).toBe(customId);

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toContain(customId);
    });

    test('should reject writer token acquisition when department is inactive', async () => {
      await Department.updateOne({ _id: deptCseAlpha._id }, { $set: { isActive: false } });

      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('WRITER_TOKEN_REJECTED');

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toEqual([]);
    });

    test('should reject writer token acquisition when deletionState is closing', async () => {
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionState: 'closing' } }
      );

      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('WRITER_TOKEN_REJECTED');

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toEqual([]);
    });

    test('should reject writer token acquisition when deletionToken is already present', async () => {
      await Department.updateOne(
        { _id: deptCseAlpha._id },
        { $set: { deletionToken: 'active-op-token-777' } }
      );

      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('WRITER_TOKEN_REJECTED');

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toEqual([]);
    });

    test('should reject acquisition across colleges (tenant isolation)', async () => {
      // College Beta officer attempting to acquire token on College Alpha's department
      const result = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeBeta._id,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('WRITER_TOKEN_REJECTED');

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toEqual([]);
    });
  });

  describe('3. Writer Token Release', () => {
    test('should successfully release an active writer token with valid collegeId', async () => {
      const acq = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(acq.success).toBe(true);

      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: acq.writerId,
      });

      expect(rel.success).toBe(true);

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toEqual([]);
    });

    test('should reject token release when collegeId is missing', async () => {
      const acq = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(acq.success).toBe(true);

      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        writerId: acq.writerId,
      });

      expect(rel.success).toBe(false);
      expect(rel.code).toBe('INVALID_PARAMETERS');

      // Token must NOT be released
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toContain(acq.writerId);
    });

    test('should reject token release when collegeId is an invalid ObjectId', async () => {
      const acq = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(acq.success).toBe(true);

      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: 'invalid-non-objectid-college',
        writerId: acq.writerId,
      });

      expect(rel.success).toBe(false);
      expect(rel.code).toBe('INVALID_PARAMETERS');

      // Token must NOT be released
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toContain(acq.writerId);
    });

    test('should reject releasing a token using another college ID (tenant isolation)', async () => {
      const acq = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(acq.success).toBe(true);

      // Attempt to release using College Beta
      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeBeta._id, // Wrong college
        writerId: acq.writerId,
      });

      expect(rel.success).toBe(false);
      expect(rel.code).toBe('DEPARTMENT_NOT_FOUND');

      // Token remains intact on College Alpha department
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.activeWriterIds).toContain(acq.writerId);
    });

    test('should not release a token when referencing another department in the same college', async () => {
      const acq = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(acq.success).toBe(true);

      // Attempt to release acq.writerId against deptEceAlpha
      const rel = await releaseWriterToken({
        departmentId: deptEceAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: acq.writerId,
      });

      // deptEceAlpha matches college, so update succeeded idempotently (modifiedCount 0)
      expect(rel.success).toBe(true);

      // But deptCseAlpha's token was NOT removed
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toContain(acq.writerId);
    });

    test('should remove strictly the target token and leave other active tokens intact', async () => {
      const writer1 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      const writer2 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      const writer3 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      const beforeDoc = await Department.findById(deptCseAlpha._id);
      expect(beforeDoc.activeWriterIds).toHaveLength(3);
      expect(beforeDoc.activeWriterIds).toContain(writer1.writerId);
      expect(beforeDoc.activeWriterIds).toContain(writer2.writerId);
      expect(beforeDoc.activeWriterIds).toContain(writer3.writerId);

      // Release only writer2
      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: writer2.writerId,
      });
      expect(rel.success).toBe(true);

      const afterDoc = await Department.findById(deptCseAlpha._id);
      expect(afterDoc.activeWriterIds).toHaveLength(2);
      expect(afterDoc.activeWriterIds).toContain(writer1.writerId);
      expect(afterDoc.activeWriterIds).toContain(writer3.writerId);
      expect(afterDoc.activeWriterIds).not.toContain(writer2.writerId);
    });

    test('should be idempotent when releasing a non-existent token on matching department', async () => {
      const rel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: 'non-existent-token-id',
      });

      expect(rel.success).toBe(true);
    });
  });

  describe('4. Batch Token Acquisition & Release', () => {
    test('should acquire tokens across multiple unique departments', async () => {
      const batchRes = await acquireBatchWriterTokens({
        departmentIds: [deptCseAlpha._id, deptEceAlpha._id, deptMechAlpha._id],
        collegeId: collegeAlpha._id,
      });

      expect(batchRes.success).toBe(true);
      expect(batchRes.tokens).toHaveLength(3);

      const cseDoc = await Department.findById(deptCseAlpha._id);
      const eceDoc = await Department.findById(deptEceAlpha._id);
      const mechDoc = await Department.findById(deptMechAlpha._id);

      expect(cseDoc.activeWriterIds).toHaveLength(1);
      expect(eceDoc.activeWriterIds).toHaveLength(1);
      expect(mechDoc.activeWriterIds).toHaveLength(1);

      // Release the batch
      const relBatch = await releaseBatchWriterTokens({
        tokens: batchRes.tokens,
        collegeId: collegeAlpha._id,
      });
      expect(relBatch.success).toBe(true);
      expect(relBatch.releasedCount).toBe(3);

      const cseAfter = await Department.findById(deptCseAlpha._id);
      expect(cseAfter.activeWriterIds).toEqual([]);
    });

    test('should deduplicate department IDs in batch and not create duplicate tokens', async () => {
      const batchRes = await acquireBatchWriterTokens({
        departmentIds: [
          deptCseAlpha._id,
          deptEceAlpha._id,
          deptCseAlpha._id,
          deptCseAlpha._id,
          deptEceAlpha._id,
        ],
        collegeId: collegeAlpha._id,
      });

      expect(batchRes.success).toBe(true);
      // Exactly 2 unique departments
      expect(batchRes.tokens).toHaveLength(2);

      const cseDoc = await Department.findById(deptCseAlpha._id);
      const eceDoc = await Department.findById(deptEceAlpha._id);

      expect(cseDoc.activeWriterIds).toHaveLength(1);
      expect(eceDoc.activeWriterIds).toHaveLength(1);

      // Clean up
      await releaseBatchWriterTokens({ tokens: batchRes.tokens, collegeId: collegeAlpha._id });
    });

    test('should return empty tokens array when departmentIds is empty', async () => {
      const batchRes = await acquireBatchWriterTokens({
        departmentIds: [],
        collegeId: collegeAlpha._id,
      });

      expect(batchRes.success).toBe(true);
      expect(batchRes.tokens).toEqual([]);
    });

    test('should release all earlier acquired tokens if a batch acquisition fails partway through', async () => {
      // Make the 2nd department in the batch closing
      await Department.updateOne(
        { _id: deptEceAlpha._id },
        { $set: { deletionState: 'closing' } }
      );

      const batchRes = await acquireBatchWriterTokens({
        departmentIds: [deptCseAlpha._id, deptEceAlpha._id, deptMechAlpha._id],
        collegeId: collegeAlpha._id,
      });

      expect(batchRes.success).toBe(false);
      expect(batchRes.code).toBe('BATCH_WRITER_TOKEN_REJECTED');
      expect(batchRes.failedDepartmentId.toString()).toBe(deptEceAlpha._id.toString());
      expect(batchRes.tokens).toEqual([]);

      // Crucial: deptCseAlpha's token was acquired first, but MUST have been rolled back
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);

      const mechDoc = await Department.findById(deptMechAlpha._id);
      expect(mechDoc.activeWriterIds).toEqual([]);
    });

    test('should continue releasing remaining batch tokens even if one token release fails', async () => {
      const token1 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      const token2 = await acquireWriterToken({
        departmentId: deptMechAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(token1.success).toBe(true);
      expect(token2.success).toBe(true);

      const fakeDeptId = new mongoose.Types.ObjectId();
      const mixedTokens = [
        { departmentId: deptCseAlpha._id, writerId: token1.writerId },
        { departmentId: fakeDeptId, writerId: 'non-existent-token' }, // Will fail matchedCount 0
        { departmentId: deptMechAlpha._id, writerId: token2.writerId },
      ];

      const batchRel = await releaseBatchWriterTokens({
        tokens: mixedTokens,
        collegeId: collegeAlpha._id,
      });

      // Now correctly reports failure because one release failed
      expect(batchRel.success).toBe(false);
      expect(batchRel.releasedCount).toBe(2);
      expect(batchRel.failedCount).toBe(1);
      expect(batchRel.failures).toHaveLength(1);
      expect(batchRel.failures[0].departmentId.toString()).toBe(fakeDeptId.toString());
      expect(batchRel.failures[0].code).toBe('DEPARTMENT_NOT_FOUND');

      // Both valid tokens were still released despite the failure in the middle
      const cseDoc = await Department.findById(deptCseAlpha._id);
      const mechDoc = await Department.findById(deptMechAlpha._id);
      expect(cseDoc.activeWriterIds).toEqual([]);
      expect(mechDoc.activeWriterIds).toEqual([]);
    });

    test('should return success:true with failedCount:0 when all releases succeed', async () => {
      const token1 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      const token2 = await acquireWriterToken({
        departmentId: deptEceAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(token1.success).toBe(true);
      expect(token2.success).toBe(true);

      const batchRel = await releaseBatchWriterTokens({
        tokens: [
          { departmentId: deptCseAlpha._id, writerId: token1.writerId },
          { departmentId: deptEceAlpha._id, writerId: token2.writerId },
        ],
        collegeId: collegeAlpha._id,
      });

      expect(batchRel.success).toBe(true);
      expect(batchRel.releasedCount).toBe(2);
      expect(batchRel.failedCount).toBe(0);
      expect(batchRel.failures).toEqual([]);
    });

    test('should treat already-absent tokens as idempotent success', async () => {
      // Acquire and immediately release a token individually
      const token1 = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(token1.success).toBe(true);

      const individualRel = await releaseWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        writerId: token1.writerId,
      });
      expect(individualRel.success).toBe(true);

      // Now try to batch-release the same token again — should be idempotent success
      const batchRel = await releaseBatchWriterTokens({
        tokens: [{ departmentId: deptCseAlpha._id, writerId: token1.writerId }],
        collegeId: collegeAlpha._id,
      });

      expect(batchRel.success).toBe(true);
      expect(batchRel.releasedCount).toBe(1); // Idempotent — matchedCount=1, modifiedCount=0
      expect(batchRel.failedCount).toBe(0);
      expect(batchRel.failures).toEqual([]);
    });

    test('should reject immediately with INVALID_PARAMETERS when collegeId is missing', async () => {
      const batchRel = await releaseBatchWriterTokens({
        tokens: [{ departmentId: deptCseAlpha._id, writerId: 'some-token' }],
        collegeId: undefined,
      });

      expect(batchRel.success).toBe(false);
      expect(batchRel.code).toBe('INVALID_PARAMETERS');
      expect(batchRel.releasedCount).toBe(0);
      expect(batchRel.failedCount).toBe(0);
      expect(batchRel.failures).toEqual([]);
    });

    test('should reject immediately with INVALID_PARAMETERS when collegeId is invalid', async () => {
      const batchRel = await releaseBatchWriterTokens({
        tokens: [{ departmentId: deptCseAlpha._id, writerId: 'some-token' }],
        collegeId: 'not-a-valid-objectid',
      });

      expect(batchRel.success).toBe(false);
      expect(batchRel.code).toBe('INVALID_PARAMETERS');
      expect(batchRel.releasedCount).toBe(0);
      expect(batchRel.failedCount).toBe(0);
      expect(batchRel.failures).toEqual([]);
    });

    test('should not clear other writers tokens when a batch release has failures', async () => {
      // Writer A acquires tokens on CSE and ECE
      const writerA_cse = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      const writerA_ece = await acquireWriterToken({
        departmentId: deptEceAlpha._id,
        collegeId: collegeAlpha._id,
      });

      // Writer B acquires a separate token on CSE
      const writerB_cse = await acquireWriterToken({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(writerA_cse.success).toBe(true);
      expect(writerA_ece.success).toBe(true);
      expect(writerB_cse.success).toBe(true);

      // Batch release writer A's tokens + a bad one (non-existent department)
      const batchRel = await releaseBatchWriterTokens({
        tokens: [
          { departmentId: deptCseAlpha._id, writerId: writerA_cse.writerId },
          { departmentId: new mongoose.Types.ObjectId(), writerId: 'ghost-token' },
          { departmentId: deptEceAlpha._id, writerId: writerA_ece.writerId },
        ],
        collegeId: collegeAlpha._id,
      });

      expect(batchRel.success).toBe(false);
      expect(batchRel.releasedCount).toBe(2);
      expect(batchRel.failedCount).toBe(1);

      // Writer B's token on CSE must still be intact
      const cseDoc = await Department.findById(deptCseAlpha._id);
      expect(cseDoc.activeWriterIds).toHaveLength(1);
      expect(cseDoc.activeWriterIds).toContain(writerB_cse.writerId);

      // ECE should be clean — writer A's token was released
      const eceDoc = await Department.findById(deptEceAlpha._id);
      expect(eceDoc.activeWriterIds).toEqual([]);
    });
  });

  describe('5. Deletion Operation Claiming', () => {
    test('should successfully claim deletion on an open department', async () => {
      const claim = await claimDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });

      expect(claim.success).toBe(true);
      expect(claim.deletionToken).toBeDefined();
      expect(claim.deletionStartedAt).toBeInstanceOf(Date);

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('closing');
      expect(doc.deletionToken).toBe(claim.deletionToken);
      expect(doc.deletionStartedAt).toBeDefined();
    });

    test('should reject a second simultaneous deletion claim on the same department', async () => {
      // Genuinely concurrent overlapping requests via Promise.all
      const [claimA, claimB] = await Promise.all([
        claimDepartmentDeletion({
          departmentId: deptCseAlpha._id,
          collegeId: collegeAlpha._id,
        }),
        claimDepartmentDeletion({
          departmentId: deptCseAlpha._id,
          collegeId: collegeAlpha._id,
        }),
      ]);

      const successes = [claimA, claimB].filter((c) => c.success);
      const failures = [claimA, claimB].filter((c) => !c.success);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].code).toBe('DELETION_CLAIM_REJECTED');
      expect(failures[0].deletionToken).toBeNull();

      // Original claim preserved
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('closing');
      expect(doc.deletionToken).toBe(successes[0].deletionToken);
    });

    test('should reject deletion claim across colleges (tenant isolation)', async () => {
      const claim = await claimDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeBeta._id, // Wrong college
      });

      expect(claim.success).toBe(false);
      expect(claim.code).toBe('DELETION_CLAIM_REJECTED');

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('open');
      expect(doc.deletionToken).toBeNull();
    });

    test('should safely claim deletion on an inactive legacy department with missing coordination fields', async () => {
      // Create a legacy inactive department with no coordination fields in MongoDB
      const legacyId = new mongoose.Types.ObjectId();
      await Department.collection.insertOne({
        _id: legacyId,
        collegeId: collegeAlpha._id,
        name: 'Legacy Master of Computer Application',
        code: 'LMCA',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const claim = await claimDepartmentDeletion({
        departmentId: legacyId,
        collegeId: collegeAlpha._id,
      });

      expect(claim.success).toBe(true);
      expect(claim.deletionToken).toBeDefined();
      expect(claim.deletionStartedAt).toBeInstanceOf(Date);

      const doc = await Department.findById(legacyId);
      expect(doc.deletionState).toBe('closing');
      expect(doc.deletionToken).toBe(claim.deletionToken);
      expect(doc.isActive).toBe(false);
    });
  });

  describe('6. Deletion State Restoration', () => {
    test('should successfully restore open state when matching deletionToken is supplied', async () => {
      const claim = await claimDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(claim.success).toBe(true);

      const restored = await restoreDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        deletionToken: claim.deletionToken,
      });

      expect(restored.success).toBe(true);

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('open');
      expect(doc.deletionToken).toBeNull();
      expect(doc.deletionStartedAt).toBeNull();
    });

    test('should reject restoration when deletionToken does not match (theft prevention)', async () => {
      const claim = await claimDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(claim.success).toBe(true);

      const restored = await restoreDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
        deletionToken: 'wrong-or-expired-token-xyz',
      });

      expect(restored.success).toBe(false);
      expect(restored.code).toBe('RESTORATION_FAILED');

      // State remains closing under the original token
      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('closing');
      expect(doc.deletionToken).toBe(claim.deletionToken);
    });

    test('should reject restoration when collegeId does not match (tenant isolation)', async () => {
      const claim = await claimDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeAlpha._id,
      });
      expect(claim.success).toBe(true);

      const restored = await restoreDepartmentDeletion({
        departmentId: deptCseAlpha._id,
        collegeId: collegeBeta._id, // Wrong college
        deletionToken: claim.deletionToken,
      });

      expect(restored.success).toBe(false);

      const doc = await Department.findById(deptCseAlpha._id);
      expect(doc.deletionState).toBe('closing');
      expect(doc.deletionToken).toBe(claim.deletionToken);
    });
  });
});
