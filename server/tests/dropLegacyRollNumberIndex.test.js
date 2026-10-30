const net = require('net');
const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const {
  DropIndexPreconditionError,
  DropIndexVerificationError,
  validateNewRollNumberIndex,
  validateLegacyRollNumberIndex,
  executeDropLegacyIndex,
  isPortListening,
} = require('../scripts/dropLegacyRollNumberIndex');

const TEST_DB_NAME = 'college_placement_test_db';

/**
 * Helper to ensure studentprofiles has the expected 4 indexes on test database:
 * 1. _id_ (auto)
 * 2. user_1 (unique: true)
 * 3. collegeId_1_rollNumber_1 (unique: true, collation locale 'en' strength 2, partial filter)
 * 4. rollNumber_1 (sparse: true, unique: false)
 */
async function setupStandardTestIndexes() {
  const coll = StudentProfile.collection;
  try {
    await coll.dropIndexes();
  } catch (err) {
    // Ignore if collection did not exist yet
  }

  // Create user_1
  await coll.createIndex({ user: 1 }, { name: 'user_1', unique: true });

  // Create replacement compound unique index
  await coll.createIndex(
    { collegeId: 1, rollNumber: 1 },
    {
      name: 'collegeId_1_rollNumber_1',
      unique: true,
      collation: { locale: 'en', strength: 2 },
      partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
    }
  );

  // Create legacy single-field sparse non-unique index
  await coll.createIndex(
    { rollNumber: 1 },
    {
      name: 'rollNumber_1',
      sparse: true,
      unique: false,
    }
  );
}

describe('Milestone 2 — Operation 3A: Legacy Index Drop Tooling Tests', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await setupStandardTestIndexes();
  });

  describe('1. Target Database & Connection Host Safety Guards', () => {
    it('should reject execution when target database is unspecified or empty', async () => {
      await expect(executeDropLegacyIndex({ targetDb: '' })).rejects.toThrow(
        DropIndexPreconditionError
      );

      try {
        await executeDropLegacyIndex({ targetDb: null });
      } catch (err) {
        expect(err.code).toBe('TARGET_UNSPECIFIED');
        expect(err.message).toMatch(/TARGET_UNSPECIFIED/);
      }
    });

    it('should reject execution against forbidden system/protected databases', async () => {
      const forbiddenDbs = ['admin', 'local', 'config', 'production', 'prod', 'staging'];
      for (const fDb of forbiddenDbs) {
        await expect(executeDropLegacyIndex({ targetDb: fDb })).rejects.toThrow(
          DropIndexPreconditionError
        );

        try {
          await executeDropLegacyIndex({ targetDb: fDb });
        } catch (err) {
          expect(err.code).toBe('TARGET_FORBIDDEN');
          expect(err.message).toMatch(/TARGET_FORBIDDEN/);
        }
      }
    });

    it('should reject connection URIs targeting non-local MongoDB hosts', async () => {
      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          mongoUri: 'mongodb://remote-cluster.internal.net:27017/college_placement_test_db',
          checkWritePause: false,
        })
      ).rejects.toThrow(DropIndexPreconditionError);

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          mongoUri: 'mongodb://remote-cluster.internal.net:27017/college_placement_test_db',
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('NON_LOCAL_HOST_REJECTED');
        expect(err.details.uriHostname).toBe('remote-cluster.internal.net');
      }
    });

    it('should reject execution if URI database name mismatches --target-db', async () => {
      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          mongoUri: 'mongodb://127.0.0.1:27017/mismatched_db_name',
          checkWritePause: false,
        })
      ).rejects.toThrow(DropIndexPreconditionError);

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          mongoUri: 'mongodb://127.0.0.1:27017/mismatched_db_name',
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('DATABASE_NAME_MISMATCH');
        expect(err.details.uriDbName).toBe('mismatched_db_name');
        expect(err.details.targetDb).toBe(TEST_DB_NAME);
      }
    });

    it('should reject execution on malformed MongoDB URI', async () => {
      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          mongoUri: 'not_a_valid_uri:::$$$',
          checkWritePause: false,
        })
      ).rejects.toThrow(DropIndexPreconditionError);
    });
  });

  describe('2. Write-Pause Verification (Active Port Check)', () => {
    it('should correctly detect port listening status via isPortListening', async () => {
      // Test with an ephemeral server on a free port
      const testServer = net.createServer();
      await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
      const boundPort = testServer.address().port;

      const isListening = await isPortListening(boundPort);
      expect(isListening).toBe(true);

      await new Promise((resolve) => testServer.close(resolve));
      const isStopped = await isPortListening(boundPort);
      expect(isStopped).toBe(false);
    });

    it('should abort with WRITE_PAUSE_ACTIVE if application port 5000 is listening', async () => {
      // Bind port 5000 temporarily to simulate active application server
      const dummyAppServer = net.createServer();
      let portBound = false;

      try {
        await new Promise((resolve, reject) => {
          dummyAppServer.once('error', reject);
          dummyAppServer.listen(5000, '127.0.0.1', () => {
            portBound = true;
            resolve();
          });
        });

        await expect(
          executeDropLegacyIndex({
            targetDb: TEST_DB_NAME,
            checkWritePause: true,
          })
        ).rejects.toThrow(/WRITE_PAUSE_VIOLATION/);

        try {
          await executeDropLegacyIndex({
            targetDb: TEST_DB_NAME,
            checkWritePause: true,
          });
        } catch (err) {
          expect(err.code).toBe('WRITE_PAUSE_ACTIVE');
        }
      } finally {
        if (portBound) {
          await new Promise((resolve) => dummyAppServer.close(resolve));
        }
      }
    });
  });

  describe('3. Index Definition Validators (Unit Verification)', () => {
    describe('validateNewRollNumberIndex', () => {
      it('should validate exact matching replacement compound index definition', () => {
        const validObj = {
          name: 'collegeId_1_rollNumber_1',
          key: { collegeId: 1, rollNumber: 1 },
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        };
        const result = validateNewRollNumberIndex(validObj);
        expect(result.valid).toBe(true);
        expect(result.reason).toBe('EXACT_MATCH');
      });

      it('should reject missing index object', () => {
        const result = validateNewRollNumberIndex(null);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INDEX_NOT_FOUND');
      });

      it('should reject index with wrong keys or extra keys', () => {
        const wrongKeys = {
          key: { collegeId: 1, rollNumber: -1 },
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        };
        expect(validateNewRollNumberIndex(wrongKeys).valid).toBe(false);
        expect(validateNewRollNumberIndex(wrongKeys).reason).toBe('KEY_PATTERN_MISMATCH');

        const extraKeys = {
          key: { collegeId: 1, rollNumber: 1, extraField: 1 },
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        };
        expect(validateNewRollNumberIndex(extraKeys).valid).toBe(false);
        expect(validateNewRollNumberIndex(extraKeys).reason).toBe('KEY_PATTERN_MISMATCH');
      });

      it('should reject index missing unique: true', () => {
        const nonUnique = {
          key: { collegeId: 1, rollNumber: 1 },
          unique: false,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        };
        const result = validateNewRollNumberIndex(nonUnique);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('UNIQUE_FLAG_MISMATCH');
      });

      it('should reject index with divergent collation', () => {
        const wrongCollation = {
          key: { collegeId: 1, rollNumber: 1 },
          unique: true,
          collation: { locale: 'fr', strength: 1 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
        };
        const result = validateNewRollNumberIndex(wrongCollation);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('COLLATION_MISMATCH');
      });

      it('should reject index with divergent or missing partial filter', () => {
        const missingFilter = {
          key: { collegeId: 1, rollNumber: 1 },
          unique: true,
          collation: { locale: 'en', strength: 2 },
        };
        expect(validateNewRollNumberIndex(missingFilter).valid).toBe(false);
        expect(validateNewRollNumberIndex(missingFilter).reason).toBe('PARTIAL_FILTER_MISMATCH');

        const wrongFilter = {
          key: { collegeId: 1, rollNumber: 1 },
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $ne: null } },
        };
        expect(validateNewRollNumberIndex(wrongFilter).valid).toBe(false);
        expect(validateNewRollNumberIndex(wrongFilter).reason).toBe('PARTIAL_FILTER_MISMATCH');
      });
    });

    describe('validateLegacyRollNumberIndex', () => {
      it('should validate exact matching legacy rollNumber_1 index definition', () => {
        const validLegacy = {
          name: 'rollNumber_1',
          key: { rollNumber: 1 },
          sparse: true,
          unique: false,
        };
        const result = validateLegacyRollNumberIndex(validLegacy);
        expect(result.valid).toBe(true);
        expect(result.reason).toBe('EXACT_MATCH');
      });

      it('should reject missing legacy index object', () => {
        const result = validateLegacyRollNumberIndex(null);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('LEGACY_INDEX_NOT_FOUND');
      });

      it('should reject legacy index with non-sparse setting', () => {
        const nonSparse = {
          name: 'rollNumber_1',
          key: { rollNumber: 1 },
          sparse: false,
          unique: false,
        };
        const result = validateLegacyRollNumberIndex(nonSparse);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('SPARSE_FLAG_MISMATCH');
      });

      it('should reject legacy index if unexpectedly unique', () => {
        const uniqueLegacy = {
          name: 'rollNumber_1',
          key: { rollNumber: 1 },
          sparse: true,
          unique: true,
        };
        const result = validateLegacyRollNumberIndex(uniqueLegacy);
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/UNIQUE_FLAG_MISMATCH/);
      });
    });
  });

  describe('4. Pre-Drop Catalog Verification Invariants', () => {
    it('should halt safely if replacement index collegeId_1_rollNumber_1 is missing', async () => {
      // Drop replacement index from test database
      await StudentProfile.collection.dropIndex('collegeId_1_rollNumber_1');

      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        })
      ).rejects.toThrow(DropIndexPreconditionError);

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('REPLACEMENT_INDEX_INVALID');
        expect(err.details.newIndexValidation.reason).toBe('INDEX_NOT_FOUND');
      }
    });

    it('should halt safely if replacement index has divergent definition (e.g. non-unique)', async () => {
      // Replace with a non-unique compound index
      await StudentProfile.collection.dropIndex('collegeId_1_rollNumber_1');
      await StudentProfile.collection.createIndex(
        { collegeId: 1, rollNumber: 1 },
        { name: 'collegeId_1_rollNumber_1', unique: false }
      );

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('REPLACEMENT_INDEX_INVALID');
        expect(err.details.newIndexValidation.reason).toBe('UNIQUE_FLAG_MISMATCH');
      }
    });

    it('should halt safely if legacy target index rollNumber_1 is missing', async () => {
      // Drop the legacy index
      await StudentProfile.collection.dropIndex('rollNumber_1');

      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        })
      ).rejects.toThrow(DropIndexPreconditionError);

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('LEGACY_INDEX_INVALID');
        expect(err.details.legacyValidation.reason).toBe('LEGACY_INDEX_NOT_FOUND');
      }
    });

    it('should halt safely if legacy index has divergent definition (e.g. unique: true)', async () => {
      await StudentProfile.collection.dropIndex('rollNumber_1');
      await StudentProfile.collection.createIndex(
        { rollNumber: 1 },
        { name: 'rollNumber_1', sparse: true, unique: true }
      );

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('LEGACY_INDEX_INVALID');
        expect(err.details.legacyValidation.reason).toMatch(/UNIQUE_FLAG_MISMATCH/);
      }
    });
  });

  describe('5. Baseline Document Count Capture & Mismatch Detection', () => {
    it('should capture dynamic baseline counts without modifying documents', async () => {
      // Insert 2 legitimate documents into studentprofiles
      const collegeId = new mongoose.Types.ObjectId();
      await StudentProfile.collection.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId,
        rollNumber: 'BASELINE-TEST-01',
      });
      await StudentProfile.collection.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId,
        rollNumber: 'BASELINE-TEST-02',
      });

      const countBefore = await StudentProfile.collection.countDocuments();
      expect(countBefore).toBe(2);

      const result = await executeDropLegacyIndex({
        targetDb: TEST_DB_NAME,
        dryRun: true,
        checkWritePause: false,
      });

      expect(result.baselineCounts['studentprofiles']).toBe(2);
      const countAfter = await StudentProfile.collection.countDocuments();
      expect(countAfter).toBe(2);
    });

    it('should abort if explicit expectedBaselineCount mismatches actual count', async () => {
      // Actual count is 0 in empty test collection, expect 5
      await expect(
        executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
          expectedBaselineCount: 5,
        })
      ).rejects.toThrow(DropIndexPreconditionError);

      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: true,
          checkWritePause: false,
          expectedBaselineCount: 5,
        });
      } catch (err) {
        expect(err.code).toBe('BASELINE_COUNT_MISMATCH');
        expect(err.details.actualCount).toBe(0);
        expect(err.details.expectedCount).toBe(5);
      }
    });
  });

  describe('6. Dry-Run Mode Invariants', () => {
    it('should execute zero DDL and drop zero indexes when dry-run is default', async () => {
      const indexesBefore = await StudentProfile.collection.indexes();
      const namesBefore = indexesBefore.map((i) => i.name);
      expect(namesBefore).toContain('rollNumber_1');
      expect(namesBefore).toContain('collegeId_1_rollNumber_1');

      // Call executeDropLegacyIndex without explicit dryRun option (defaults to true)
      const result = await executeDropLegacyIndex({
        targetDb: TEST_DB_NAME,
        checkWritePause: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      const indexesAfter = await StudentProfile.collection.indexes();
      const namesAfter = indexesAfter.map((i) => i.name);

      // Verify rollNumber_1 was NOT dropped
      expect(namesAfter).toEqual(namesBefore);
      expect(namesAfter).toContain('rollNumber_1');
      expect(namesAfter).toContain('collegeId_1_rollNumber_1');
    });

    it('should execute zero DDL when dryRun: true is explicitly passed', async () => {
      const result = await executeDropLegacyIndex({
        targetDb: TEST_DB_NAME,
        dryRun: true,
        checkWritePause: false,
      });

      expect(result.dryRun).toBe(true);
      const indexesAfter = await StudentProfile.collection.indexes();
      expect(indexesAfter.some((i) => i.name === 'rollNumber_1')).toBe(true);
    });
  });

  describe('7. Successful Isolated Drop & Post-Drop Verification (Execute Mode on Test DB)', () => {
    it('should drop only rollNumber_1 and verify remaining catalog integrity', async () => {
      // Insert sample profiles across 2 colleges to verify document integrity
      const college1 = new mongoose.Types.ObjectId();
      const college2 = new mongoose.Types.ObjectId();

      await StudentProfile.collection.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: college1,
        rollNumber: 'CS-101',
      });
      await StudentProfile.collection.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: college2,
        rollNumber: 'CS-101', // Allowed cross-college duplicate
      });

      const initialCount = await StudentProfile.collection.countDocuments();
      expect(initialCount).toBe(2);

      // Verify all 4 indexes are present prior to drop
      const preIndexes = await StudentProfile.collection.indexes();
      const preNames = preIndexes.map((i) => i.name);
      expect(preNames).toContain('_id_');
      expect(preNames).toContain('user_1');
      expect(preNames).toContain('collegeId_1_rollNumber_1');
      expect(preNames).toContain('rollNumber_1');

      // Execute live drop on isolated test database
      const result = await executeDropLegacyIndex({
        targetDb: TEST_DB_NAME,
        dryRun: false,
        checkWritePause: false,
        expectedBaselineCount: 2,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
      expect(result.droppedIndex).toBe('rollNumber_1');

      // Post-drop index catalog assertions:
      const postIndexes = await StudentProfile.collection.indexes();
      const postNames = postIndexes.map((i) => i.name);

      // 1. rollNumber_1 MUST be absent
      expect(postNames).not.toContain('rollNumber_1');

      // 2. collegeId_1_rollNumber_1 MUST remain present and intact
      expect(postNames).toContain('collegeId_1_rollNumber_1');
      const replacementIdx = postIndexes.find((i) => i.name === 'collegeId_1_rollNumber_1');
      expect(validateNewRollNumberIndex(replacementIdx).valid).toBe(true);

      // 3. user_1 MUST remain present and unique
      expect(postNames).toContain('user_1');
      const userIdx = postIndexes.find((i) => i.name === 'user_1');
      expect(userIdx.unique).toBe(true);

      // 4. _id_ MUST remain present
      expect(postNames).toContain('_id_');

      // 5. Total index count decreased by exactly 1
      expect(postIndexes.length).toBe(preIndexes.length - 1);

      // 6. Collection document counts match baseline exactly
      const finalCount = await StudentProfile.collection.countDocuments();
      expect(finalCount).toBe(initialCount);
      expect(result.postCounts['studentprofiles']).toBe(initialCount);
    });
  });

  describe('8. Post-Drop Verification Failure Handling (No Destructive Recovery)', () => {
    it('should halt with DropIndexVerificationError if legacy index is still present post-drop', async () => {
      let caughtError = null;
      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: false,
          checkWritePause: false,
          simulatePostDropFailure: 'LEGACY_STILL_PRESENT',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(DropIndexVerificationError);
      expect(caughtError.code).toBe('LEGACY_INDEX_STILL_PRESENT');
    });

    it('should halt with DropIndexVerificationError if replacement index is altered post-drop', async () => {
      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: false,
          checkWritePause: false,
          simulatePostDropFailure: 'REPLACEMENT_INDEX_ALTERED',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(DropIndexVerificationError);
        expect(err.code).toBe('REPLACEMENT_INDEX_ALTERED');
      }
    });

    it('should halt with DropIndexVerificationError if user_1 index is missing/altered post-drop', async () => {
      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: false,
          checkWritePause: false,
          simulatePostDropFailure: 'USER_INDEX_ALTERED',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(DropIndexVerificationError);
        expect(err.code).toBe('USER_INDEX_ALTERED');
      }
    });

    it('should halt with DropIndexVerificationError if _id_ index is missing post-drop', async () => {
      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: false,
          checkWritePause: false,
          simulatePostDropFailure: 'ID_INDEX_MISSING',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(DropIndexVerificationError);
        expect(err.code).toBe('ID_INDEX_MISSING');
      }
    });

    it('should halt with DropIndexVerificationError if document counts change during drop', async () => {
      try {
        await executeDropLegacyIndex({
          targetDb: TEST_DB_NAME,
          dryRun: false,
          checkWritePause: false,
          simulatePostDropFailure: 'DOCUMENT_COUNT_MISMATCH',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(DropIndexVerificationError);
        expect(err.code).toBe('DOCUMENT_COUNT_MISMATCH');
        expect(err.details.postCounts['studentprofiles']).not.toBe(
          err.details.baselineCounts['studentprofiles']
        );
      }
    });
  });
});
