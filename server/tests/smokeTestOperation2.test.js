const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const {
  executeSmokeTest,
  SmokeTestPreconditionError,
  CleanupIntegrityError,
  generateTestRunId,
  validateIndexSpecification,
} = require('../scripts/smokeTestOperation2');

describe('Milestone 2 — Operation 2A: Safe Smoke-Test Tooling Tests', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Ensure the compound unique index is created on the isolated test database
    await StudentProfile.collection.createIndex(
      { collegeId: 1, rollNumber: 1 },
      {
        name: 'collegeId_1_rollNumber_1',
        unique: true,
        collation: { locale: 'en', strength: 2 },
        partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
      }
    );
  });

  describe('1. Safety Guards and Database Target Validation', () => {
    it('should refuse to run when target database is unspecified or empty', async () => {
      await expect(executeSmokeTest({ targetDb: '' })).rejects.toThrow(
        SmokeTestPreconditionError
      );
      await expect(executeSmokeTest({ targetDb: null })).rejects.toThrow(
        /TARGET_UNSPECIFIED/
      );
    });

    it('should refuse to run against forbidden system databases', async () => {
      const forbidden = ['admin', 'local', 'config', 'production', 'prod', 'staging'];
      for (const fDb of forbidden) {
        await expect(executeSmokeTest({ targetDb: fDb })).rejects.toThrow(
          /TARGET_FORBIDDEN/
        );
      }
    });

    it('should refuse to target the main database (college_placement_db) without explicit authorization flag', async () => {
      // In dry-run mode
      await expect(
        executeSmokeTest({ targetDb: 'college_placement_db', dryRun: true })
      ).rejects.toThrow(SmokeTestPreconditionError);

      try {
        await executeSmokeTest({ targetDb: 'college_placement_db', dryRun: true });
      } catch (err) {
        expect(err.code).toBe('MAIN_DATABASE_PROTECTED');
        expect(err.message).toMatch(/refused without explicit authorization flag/i);
      }

      // In live execute mode
      await expect(
        executeSmokeTest({ targetDb: 'college_placement_db', dryRun: false })
      ).rejects.toThrow(SmokeTestPreconditionError);
    });

    it('should halt safely if target index collegeId_1_rollNumber_1 is missing or has divergent definition', async () => {
      // Drop the index to simulate missing index
      await StudentProfile.collection.dropIndex('collegeId_1_rollNumber_1');

      await expect(
        executeSmokeTest({
          targetDb: 'college_placement_test_db',
          dryRun: false,
          checkWritePause: false,
        })
      ).rejects.toThrow(/INDEX_PRECONDITION_FAILED/);
    });

    it('should abort before writing if target URI specifies a mismatched database name', async () => {
      await expect(
        executeSmokeTest({
          targetDb: 'college_placement_test_db',
          mongoUri: 'mongodb://127.0.0.1:27017/mismatched_database_name',
          dryRun: true,
          checkWritePause: false,
        })
      ).rejects.toThrow(/DATABASE_NAME_MISMATCH/);

      try {
        await executeSmokeTest({
          targetDb: 'college_placement_test_db',
          mongoUri: 'mongodb://127.0.0.1:27017/mismatched_database_name',
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('DATABASE_NAME_MISMATCH');
        expect(err.details.uriDbName).toBe('mismatched_database_name');
        expect(err.details.targetDb).toBe('college_placement_test_db');
      }
    });

    it('should abort before writing if connection URI targets a non-local host', async () => {
      await expect(
        executeSmokeTest({
          targetDb: 'college_placement_test_db',
          mongoUri: 'mongodb://remote-db.production.net:27017/college_placement_test_db',
          dryRun: true,
          checkWritePause: false,
        })
      ).rejects.toThrow(/NON_LOCAL_HOST_REJECTED/);

      try {
        await executeSmokeTest({
          targetDb: 'college_placement_test_db',
          mongoUri: 'mongodb://remote-db.production.net:27017/college_placement_test_db',
          dryRun: true,
          checkWritePause: false,
        });
      } catch (err) {
        expect(err.code).toBe('NON_LOCAL_HOST_REJECTED');
        expect(err.details.uriHostname).toBe('remote-db.production.net');
      }
    });
  });

  describe('2. Dry-Run Mode Invariant', () => {
    it('should perform zero database writes in dry-run mode', async () => {
      const countBefore = await StudentProfile.collection.countDocuments();
      expect(countBefore).toBe(0);

      const result = await executeSmokeTest({
        targetDb: 'college_placement_test_db',
        dryRun: true,
        checkWritePause: false,
      });

      expect(result.passed).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.targetDb).toBe('college_placement_test_db');

      const countAfter = await StudentProfile.collection.countDocuments();
      expect(countAfter).toBe(0);
    });
  });

  describe('3. Unique Run IDs & Exact-Run Cleanup', () => {
    it('should generate unique testRunIds for distinct executions', () => {
      const id1 = generateTestRunId();
      const id2 = generateTestRunId();

      expect(id1).toMatch(/^smoke_\d+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^smoke_\d+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });

    it('should execute all index assertions and restore collection count to baseline', async () => {
      const baseline = await StudentProfile.collection.countDocuments();
      expect(baseline).toBe(0);

      const result = await executeSmokeTest({
        targetDb: 'college_placement_test_db',
        dryRun: false,
        checkWritePause: false,
      });

      expect(result.passed).toBe(true);
      expect(result.syntheticRecordsInserted).toBeGreaterThan(0);
      expect(result.assertions.caseInsensitiveDuplicateRejected).toBe(true);
      expect(result.assertions.crossCollegeDuplicateAllowed).toBe(true);
      expect(result.assertions.nullEmptyMissingCoexistence).toBe(true);

      // Verify narrow cleanup restored baseline
      expect(result.cleanup.performed).toBe(true);
      expect(result.cleanup.baselineRestored).toBe(true);
      expect(result.cleanup.leftoverIds).toEqual([]);

      const finalCount = await StudentProfile.collection.countDocuments();
      expect(finalCount).toBe(baseline);

      // Verify no records remain for this specific run ID
      const remainingForRun = await StudentProfile.collection.countDocuments({
        testRunId: result.testRunId,
      });
      expect(remainingForRun).toBe(0);
    });
  });

  describe('4. Whitespace-Only Roll-Number Behavior', () => {
    it('should verify raw-driver whitespace collision and document application-layer distinction', async () => {
      const result = await executeSmokeTest({
        targetDb: 'college_placement_test_db',
        dryRun: false,
        checkWritePause: false,
      });

      expect(result.assertions.whitespaceBehavior).toBeDefined();
      expect(result.assertions.whitespaceBehavior.rawDriverMatchesPartialFilter).toBe(true);
      expect(result.assertions.whitespaceBehavior.sameCollegeWhitespaceCollidesWithE11000).toBe(true);
      expect(result.assertions.whitespaceBehavior.crossCollegeWhitespaceAllowed).toBe(true);
      expect(result.assertions.whitespaceBehavior.documentedNote).toMatch(
        /Raw MongoDB driver treats untrimmed "   " as string.*Mongoose schema option trim: true/s
      );
    });
  });

  describe('5. Error Handling & Cleanup Resilience', () => {
    it('should execute narrow cleanup even when a test assertion fails midway', async () => {
      const baseline = await StudentProfile.collection.countDocuments();
      expect(baseline).toBe(0);

      let caughtError = null;
      try {
        await executeSmokeTest({
          targetDb: 'college_placement_test_db',
          dryRun: false,
          checkWritePause: false,
          simulatedFailure: 'Mid-test assertion simulated exception',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toMatch(/SIMULATED_TEST_FAILURE/);

      // Verify that despite the exception, the finally block cleaned up all synthetic records
      const remainingDocs = await StudentProfile.collection.countDocuments({});
      expect(remainingDocs).toBe(baseline);
    });

    it('should report exact leftover IDs and run ID when cleanup fails without performing broad deletion', async () => {
      let cleanupError = null;
      try {
        await executeSmokeTest({
          targetDb: 'college_placement_test_db',
          dryRun: false,
          checkWritePause: false,
          simulateCleanupFailure: true,
        });
      } catch (err) {
        cleanupError = err;
      }

      expect(cleanupError).toBeInstanceOf(CleanupIntegrityError);
      expect(cleanupError.code).toBe('BASELINE_NOT_RESTORED');
      expect(cleanupError.details).toBeDefined();
      expect(cleanupError.details.testRunId).toMatch(/^smoke_/);
      expect(cleanupError.details.leftoverIds.length).toBeGreaterThan(0);
      expect(cleanupError.details.baselineCount).toBe(0);

      // Verify records were left intact for inspection and not broadly wiped
      const leftoverCount = await StudentProfile.collection.countDocuments({
        testRunId: cleanupError.details.testRunId,
      });
      expect(leftoverCount).toBe(cleanupError.details.leftoverIds.length);

      // Clean up manually strictly by the reported testRunId
      const deleteResult = await StudentProfile.collection.deleteMany({
        testRunId: cleanupError.details.testRunId,
      });
      expect(deleteResult.deletedCount).toBe(cleanupError.details.leftoverIds.length);

      const finalCount = await StudentProfile.collection.countDocuments();
      expect(finalCount).toBe(0);
    });

    it('should record actual non-zero baseline count and use that recorded baseline in recovery instructions when cleanup fails', async () => {
      // Pre-insert 3 legitimate documents to establish non-zero baseline
      for (let i = 1; i <= 3; i++) {
        await StudentProfile.collection.insertOne({
          user: new mongoose.Types.ObjectId(),
          collegeId: new mongoose.Types.ObjectId(),
          rollNumber: `PRE-EXISTING-STUDENT-${i}`,
        });
      }

      const initialBaseline = await StudentProfile.collection.countDocuments();
      expect(initialBaseline).toBe(3);

      let cleanupError = null;
      try {
        await executeSmokeTest({
          targetDb: 'college_placement_test_db',
          dryRun: false,
          checkWritePause: false,
          simulateCleanupFailure: true,
        });
      } catch (err) {
        cleanupError = err;
      }

      expect(cleanupError).toBeInstanceOf(CleanupIntegrityError);
      expect(cleanupError.code).toBe('BASELINE_NOT_RESTORED');
      expect(cleanupError.details.recordedBaselineCount).toBe(3);
      expect(cleanupError.details.postCleanupTotalCount).toBeGreaterThan(3);

      // Verify that the error message explicitly cites the recorded baseline of 3, not assuming 0
      expect(cleanupError.message).toMatch(/vs recorded baseline 3/i);

      // Verify that pre-existing 3 records are completely untouched
      const preExistingCount = await StudentProfile.collection.countDocuments({
        rollNumber: /^PRE-EXISTING-STUDENT-/,
      });
      expect(preExistingCount).toBe(3);

      // Manual cleanup strictly by the reported testRunId
      await StudentProfile.collection.deleteMany({
        testRunId: cleanupError.details.testRunId,
      });

      // Assert collection count returns to recorded baseline 3
      const restoredCount = await StudentProfile.collection.countDocuments();
      expect(restoredCount).toBe(3);
    });
  });

  describe('6. Preservation of Unrelated Records', () => {
    it('should preserve pre-existing legitimate records and other test runs, restoring exact baseline count', async () => {
      // 1. Insert a legitimate student profile without testRunId
      const legitimateUserId = new mongoose.Types.ObjectId();
      const legitimateCollegeId = new mongoose.Types.ObjectId();
      await StudentProfile.collection.insertOne({
        user: legitimateUserId,
        collegeId: legitimateCollegeId,
        rollNumber: 'LEGITIMATE-STUDENT-001',
      });

      // 2. Insert a record from a previous test run
      const prevRunId = 'smoke_1700000000000_prevrunid';
      await StudentProfile.collection.insertOne({
        user: new mongoose.Types.ObjectId(),
        collegeId: legitimateCollegeId,
        rollNumber: 'PREV-RUN-STUDENT-002',
        testRunId: prevRunId,
      });

      const baseline = await StudentProfile.collection.countDocuments();
      expect(baseline).toBe(2);

      // 3. Execute smoke test with live execution
      const result = await executeSmokeTest({
        targetDb: 'college_placement_test_db',
        dryRun: false,
        checkWritePause: false,
      });

      expect(result.passed).toBe(true);

      // 4. Verify post-cleanup collection count strictly equals baseline (2)
      const postCount = await StudentProfile.collection.countDocuments();
      expect(postCount).toBe(2);

      // 5. Verify legitimate record still exists
      const legitRecord = await StudentProfile.collection.findOne({
        rollNumber: 'LEGITIMATE-STUDENT-001',
      });
      expect(legitRecord).toBeDefined();
      expect(legitRecord.user.toString()).toBe(legitimateUserId.toString());

      // 6. Verify previous test run record still exists
      const prevRunRecord = await StudentProfile.collection.findOne({
        testRunId: prevRunId,
      });
      expect(prevRunRecord).toBeDefined();
      expect(prevRunRecord.rollNumber).toBe('PREV-RUN-STUDENT-002');

      // 7. Verify zero records exist for the current smoke test run
      const currentRunCount = await StudentProfile.collection.countDocuments({
        testRunId: result.testRunId,
      });
      expect(currentRunCount).toBe(0);
    });
  });
});
