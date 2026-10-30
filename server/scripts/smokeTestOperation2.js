/**
 * Milestone 2 — Operation 2: Safe Direct-Driver Smoke-Test Tool
 *
 * PURPOSE:
 * Verifies the behavior of the compound unique roll-number index
 * { collegeId: 1, rollNumber: 1 } (collation: { locale: 'en', strength: 2 },
 * partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } })
 * using synthetic test records, strictly isolated test identifiers, and
 * narrow, verified cleanup.
 *
 * SAFETY INVARIANTS:
 * 1. TARGET VALIDATION: Requires explicit database target. Disallows system/forbidden databases.
 * 2. LIVE DATABASE PROTECTION: Refuses to run against 'college_placement_db' without explicit
 *    authorization flag (--allow-live-target).
 * 3. DRY-RUN BY DEFAULT: Performs zero database writes unless --execute is explicitly supplied.
 * 4. UNIQUE TEST RUN ID: Every execution generates a timestamped, cryptographically random testRunId.
 * 5. SYNTHETIC-ONLY RECORDS: Operates strictly with synthetic ObjectIds; never modifies or touches
 *    existing legitimate documents.
 * 6. NARROW CLEANUP: In finally block, deletes ONLY documents tagged with the exact testRunId.
 *    Broad regex deletions (e.g. /^smoke_/) are strictly prohibited.
 * 7. CLEANUP INTEGRITY & LEFTOVER REPORTING: Verifies that all run records are deleted and the
 *    collection count strictly restores to baseline. If cleanup fails, captures and logs exact
 *    leftover document IDs without modifying other records.
 * 8. GUARANTEED TEARDOWN: MongoDB connections are always closed in a finally block.
 *
 * DISASTER RECOVERY & MANUAL CRASH CLEANUP:
 * If the process is abruptly terminated (e.g. SIGKILL, power outage) before the finally block executes:
 * 1. Inspect uncleaned synthetic test records using the logged testRunId:
 *    db.studentprofiles.find({ testRunId: "<exactTestRunId>" }).toArray();
 * 2. Verify all records have the synthetic testRunId and synthetic fields.
 * 3. Delete strictly by the exact logged testRunId:
 *    db.studentprofiles.deleteMany({ testRunId: "<exactTestRunId>" });
 * 4. Confirm the collection count returns to the pre-test baseline.
 */

const crypto = require('crypto');
const net = require('net');
const mongoose = require('mongoose');

// Prevent Mongoose from automatically mutating schema collections or secondary indexes
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const PROTECTED_MAIN_DB = 'college_placement_db';
const FORBIDDEN_DBS = ['admin', 'local', 'config', 'production', 'prod', 'staging'];

class SmokeTestPreconditionError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SmokeTestPreconditionError';
    this.code = code;
    this.details = details;
  }
}

class CleanupIntegrityError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'CleanupIntegrityError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Checks whether a TCP port is currently active.
 */
function isPortListening(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Generates an isolated, collision-resistant test run identifier.
 */
function generateTestRunId() {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `smoke_${timestamp}_${randomHex}`;
}

/**
 * Validates that the target index definition matches the cutover specification exactly.
 */
function validateIndexSpecification(indexObj) {
  if (!indexObj) {
    return { valid: false, reason: 'INDEX_NOT_FOUND' };
  }

  const keyMatches =
    indexObj.key &&
    indexObj.key.collegeId === 1 &&
    indexObj.key.rollNumber === 1 &&
    Object.keys(indexObj.key).length === 2;

  const uniqueMatches = indexObj.unique === true;

  const collationMatches =
    indexObj.collation &&
    indexObj.collation.locale === 'en' &&
    indexObj.collation.strength === 2;

  const partialMatches =
    indexObj.partialFilterExpression &&
    indexObj.partialFilterExpression.rollNumber &&
    indexObj.partialFilterExpression.rollNumber.$type === 'string' &&
    indexObj.partialFilterExpression.rollNumber.$gt === '';

  if (!keyMatches) return { valid: false, reason: 'KEY_PATTERN_MISMATCH', actual: indexObj.key };
  if (!uniqueMatches) return { valid: false, reason: 'UNIQUE_FLAG_MISMATCH', actual: indexObj.unique };
  if (!collationMatches) return { valid: false, reason: 'COLLATION_MISMATCH', actual: indexObj.collation };
  if (!partialMatches) return { valid: false, reason: 'PARTIAL_FILTER_MISMATCH', actual: indexObj.partialFilterExpression };

  return { valid: true, reason: 'EXACT_MATCH' };
}

/**
 * Executes the Operation 2 direct-driver smoke test.
 */
async function executeSmokeTest(options = {}) {
  const {
    targetDb = null,
    mongoUri = null,
    dryRun = true,
    allowLiveTarget = false,
    checkWritePause = true,
    requireLocalHost = true,
    simulatedFailure = null, // Injects a failure for testing error handling & cleanup
    simulateCleanupFailure = false, // Injects a failure during cleanup for testing leftover reporting
  } = options;

  // 1. Validate Target Database Configuration
  if (!targetDb || typeof targetDb !== 'string' || targetDb.trim().length === 0) {
    throw new SmokeTestPreconditionError(
      'TARGET_UNSPECIFIED: Explicit target database must be provided via --target-db=<dbname>. Fallback is prohibited.',
      'TARGET_UNSPECIFIED'
    );
  }

  const normalizedDb = targetDb.trim();

  // Safety Guard: Forbidden System Databases
  if (FORBIDDEN_DBS.includes(normalizedDb.toLowerCase())) {
    throw new SmokeTestPreconditionError(
      `TARGET_FORBIDDEN: Refusing to run smoke test against protected/forbidden database: '${normalizedDb}'.`,
      'TARGET_FORBIDDEN'
    );
  }

  // Safety Guard: Protection of Main Production/Development Database
  if (normalizedDb === PROTECTED_MAIN_DB && !allowLiveTarget) {
    throw new SmokeTestPreconditionError(
      `MAIN_DATABASE_PROTECTED: Direct smoke testing against live database '${PROTECTED_MAIN_DB}' is refused without explicit authorization flag (--allow-live-target).`,
      'MAIN_DATABASE_PROTECTED'
    );
  }

  // 2. Write-Pause Verification (if enabled)
  if (checkWritePause) {
    const portActive = await isPortListening(5000);
    if (portActive) {
      throw new SmokeTestPreconditionError(
        'WRITE_PAUSE_VIOLATION: Application server is active on port 5000. Write-pause must be active during smoke testing.',
        'WRITE_PAUSE_ACTIVE'
      );
    }
  }

  // 3. Connection URI Construction & Identity Pre-Validation
  const uri = mongoUri || `mongodb://127.0.0.1:27017/${normalizedDb}`;

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch (err) {
    throw new SmokeTestPreconditionError(
      `TARGET_URI_INVALID: Malformed MongoDB connection URI: ${err.message}`,
      'TARGET_URI_INVALID',
      { uri, error: err.message }
    );
  }

  // Local Host Invariant Check (Planned local execution must target 127.0.0.1 or localhost)
  const allowedLocalHosts = ['127.0.0.1', 'localhost'];
  const uriHostname = (parsedUri.hostname || '').toLowerCase();
  if (requireLocalHost && !allowedLocalHosts.includes(uriHostname)) {
    throw new SmokeTestPreconditionError(
      `NON_LOCAL_HOST_REJECTED: Expected local MongoDB host (127.0.0.1 or localhost), but URI targets host '${uriHostname}'. Aborting.`,
      'NON_LOCAL_HOST_REJECTED',
      { uriHostname, allowedHosts: allowedLocalHosts }
    );
  }

  // Database Name Mismatch Check between URI path and --target-db
  const rawPath = parsedUri.pathname ? parsedUri.pathname.replace(/^\/+/, '') : '';
  const uriDbName = rawPath.split('/')[0].split('?')[0].trim();
  if (uriDbName && uriDbName !== normalizedDb) {
    throw new SmokeTestPreconditionError(
      `DATABASE_NAME_MISMATCH: Connection URI specifies database '${uriDbName}', but target database is '${normalizedDb}'. Aborting before write.`,
      'DATABASE_NAME_MISMATCH',
      { uriDbName, targetDb: normalizedDb }
    );
  }

  const testRunId = generateTestRunId();
  const trackedInsertedIds = [];

  let conn = null;
  let baselineCount = 0;
  let executionSummary = {
    testRunId,
    targetDb: normalizedDb,
    dryRun,
    passed: false,
    baselineCount: 0,
    syntheticRecordsInserted: 0,
    recovery: {},
    assertions: {},
    cleanup: {
      performed: false,
      deletedCount: 0,
      baselineRestored: false,
      leftoverIds: [],
    },
  };

  console.log('================================================================================');
  console.log('         OPERATION 2: DIRECT-DRIVER ROLL-NUMBER INDEX SMOKE TEST');
  console.log('================================================================================');
  console.log(`Target Database: ${normalizedDb}`);
  console.log(`Execution Mode:  ${dryRun ? 'DRY-RUN (Inspection & Simulation — No Writes)' : 'LIVE EXECUTION'}`);
  console.log(`Test Run ID:     ${testRunId}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------\n');

  try {
    // 4. Connect to Database with Guaranteed Teardown
    conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;

    // Actual connected database identity verification
    const actualConnectedDbName = db.databaseName;
    if (actualConnectedDbName !== normalizedDb) {
      throw new SmokeTestPreconditionError(
        `CONNECTED_DATABASE_MISMATCH: Actual connected database '${actualConnectedDbName}' does not match expected target '${normalizedDb}'. Aborting before write.`,
        'CONNECTED_DATABASE_MISMATCH',
        { actualConnectedDbName, expectedTargetDb: normalizedDb }
      );
    }
    console.log(`[Target Identity] Connected database verified: '${actualConnectedDbName}' on host '${uriHostname}'`);

    const coll = db.collection('studentprofiles');

    // 5. Record Pre-Test Baseline Count & Recovery Instructions
    baselineCount = await coll.countDocuments();
    executionSummary.baselineCount = baselineCount;
    executionSummary.recovery = {
      testRunId,
      recordedBaselineCount: baselineCount,
      inspectionQuery: `db.studentprofiles.find({ testRunId: "${testRunId}" }).toArray()`,
      cleanupQuery: `db.studentprofiles.deleteMany({ testRunId: "${testRunId}" })`,
      expectedRestoredCount: baselineCount,
    };

    console.log(`[Baseline] studentprofiles baseline document count: ${baselineCount}`);
    console.log(`[Run Identity & Baseline] Test Run ID: ${testRunId} | Recorded Baseline Count: ${baselineCount}`);
    console.log(`[Crash Recovery Guide] If execution is interrupted prior to cleanup:`);
    console.log(`  1. Inspect: db.studentprofiles.find({ testRunId: "${testRunId}" }).toArray();`);
    console.log(`  2. Delete:  db.studentprofiles.deleteMany({ testRunId: "${testRunId}" });`);
    console.log(`  3. Verify:  Ensure studentprofiles count strictly restores to recorded baseline: ${baselineCount}.\n`);

    // 6. Index Verification Precondition
    let indexes = [];
    try {
      indexes = await coll.indexes();
    } catch (err) {
      // Code 26: Namespace does not exist (collection has not been created yet)
      if (err.code === 26 || (err.message && err.message.includes('ns does not exist'))) {
        indexes = [];
      } else {
        throw err;
      }
    }
    const targetIndex = indexes.find((i) => i.name === 'collegeId_1_rollNumber_1');
    const indexValidation = validateIndexSpecification(targetIndex);

    if (!indexValidation.valid) {
      throw new SmokeTestPreconditionError(
        `INDEX_PRECONDITION_FAILED: Target index 'collegeId_1_rollNumber_1' is missing or has divergent definition: ${indexValidation.reason}. Index must be verified before smoke test writes.`,
        'INDEX_PRECONDITION_FAILED',
        { indexValidation, existingIndexes: indexes.map((i) => i.name) }
      );
    }
    console.log(`[Precondition] Index 'collegeId_1_rollNumber_1' verified: EXACT MATCH`);

    // 6. Dry-Run Handling
    if (dryRun) {
      console.log('\n[DRY-RUN MODE] Zero database writes performed.');
      console.log('Simulated plan:');
      console.log('  1. Synthetic colleges creation (in-memory ObjectIds)');
      console.log('  2. Case-insensitive duplicate test within College Alpha (verify E11000)');
      console.log('  3. Cross-college identical roll number test (verify allowed in College Beta)');
      console.log('  4. Missing, null, and empty-string roll numbers coexistence test');
      console.log('  5. Whitespace-only roll numbers direct driver behavior test');
      console.log('  6. Verification of baseline count restoration via exact testRunId cleanup');

      executionSummary.passed = true;
      return executionSummary;
    }

    // 7. Live Synthetic Test Execution
    console.log('\n[TEST EXECUTION] Running direct-driver index assertions with synthetic records:');

    // Create synthetic College IDs (never modifies legitimate colleges collection)
    const synthCollegeA = new mongoose.Types.ObjectId();
    const synthCollegeB = new mongoose.Types.ObjectId();

    // Assertion 1: Same-College Case-Insensitive Duplicate Rejection
    console.log('  [Assertion 1] Case-insensitive duplicate within same college:');
    const doc1 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: 'SMOKE-ROLL-101',
      department: 'CS',
      testRunId,
    };
    const insertRes1 = await coll.insertOne(doc1);
    trackedInsertedIds.push(insertRes1.insertedId);

    let dupError = null;
    try {
      const doc2 = {
        user: new mongoose.Types.ObjectId(),
        collegeId: synthCollegeA,
        rollNumber: 'smoke-roll-101', // Lowercase variant
        department: 'IT',
        testRunId,
      };
      await coll.insertOne(doc2);
      // If insertion succeeded, that's an error because it should have collided!
    } catch (err) {
      dupError = err;
    }

    if (!dupError || dupError.code !== 11000) {
      throw new Error(`ASSERTION_1_FAILED: Expected E11000 duplicate key error on case-variant roll number in same college, got: ${dupError ? dupError.message : 'SUCCESS'}`);
    }
    executionSummary.assertions.caseInsensitiveDuplicateRejected = true;
    console.log('    √ PASS: Case-insensitive duplicate rejected with E11000 in same college.');

    // Assertion 2: Same Roll Number in Different College Allowed
    console.log('  [Assertion 2] Identical roll number across different colleges:');
    const doc3 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeB,
      rollNumber: 'SMOKE-ROLL-101', // Identical roll number, different college
      department: 'ECE',
      testRunId,
    };
    const insertRes3 = await coll.insertOne(doc3);
    trackedInsertedIds.push(insertRes3.insertedId);
    executionSummary.assertions.crossCollegeDuplicateAllowed = true;
    console.log('    √ PASS: Identical roll number allowed in College Beta.');

    // Assertion 3: Missing, Null, and Empty-String Roll Numbers Coexistence
    console.log('  [Assertion 3] Null, empty string, and missing roll numbers coexistence:');
    const docNull1 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: null,
      testRunId,
    };
    const resNull1 = await coll.insertOne(docNull1);
    trackedInsertedIds.push(resNull1.insertedId);

    const docNull2 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: null,
      testRunId,
    };
    const resNull2 = await coll.insertOne(docNull2);
    trackedInsertedIds.push(resNull2.insertedId);

    const docEmpty1 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: '',
      testRunId,
    };
    const resEmpty1 = await coll.insertOne(docEmpty1);
    trackedInsertedIds.push(resEmpty1.insertedId);

    const docEmpty2 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: '',
      testRunId,
    };
    const resEmpty2 = await coll.insertOne(docEmpty2);
    trackedInsertedIds.push(resEmpty2.insertedId);

    const docMissing = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      testRunId,
    };
    const resMissing = await coll.insertOne(docMissing);
    trackedInsertedIds.push(resMissing.insertedId);

    executionSummary.assertions.nullEmptyMissingCoexistence = true;
    console.log('    √ PASS: Multiple nulls, empty strings, and missing roll numbers coexist without index collision.');

    // Assertion 4: Whitespace-Only Roll Numbers Behavior
    console.log('  [Assertion 4] Whitespace-only roll numbers behavior:');
    const docWs1 = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeA,
      rollNumber: '   ', // 3 spaces
      testRunId,
    };
    const resWs1 = await coll.insertOne(docWs1);
    trackedInsertedIds.push(resWs1.insertedId);

    let wsDupError = null;
    try {
      const docWs2 = {
        user: new mongoose.Types.ObjectId(),
        collegeId: synthCollegeA,
        rollNumber: '   ', // Duplicate whitespace in same college
        testRunId,
      };
      await coll.insertOne(docWs2);
    } catch (err) {
      wsDupError = err;
    }

    if (!wsDupError || wsDupError.code !== 11000) {
      throw new Error(`ASSERTION_4_FAILED: Raw driver whitespace duplicate did not trigger E11000.`);
    }

    // Whitespace in College B should succeed
    const docWsB = {
      user: new mongoose.Types.ObjectId(),
      collegeId: synthCollegeB,
      rollNumber: '   ',
      testRunId,
    };
    const resWsB = await coll.insertOne(docWsB);
    trackedInsertedIds.push(resWsB.insertedId);

    executionSummary.assertions.whitespaceBehavior = {
      rawDriverMatchesPartialFilter: true,
      sameCollegeWhitespaceCollidesWithE11000: true,
      crossCollegeWhitespaceAllowed: true,
      documentedNote:
        'Raw MongoDB driver treats untrimmed "   " as string with length > 0, matching the partial filter. Duplicate whitespace within same college triggers E11000 under strength 2 collation. At application layer, Mongoose schema option trim: true and pre-validate hook trim/normalize strings before database write.',
    };
    console.log('    √ PASS: Whitespace roll numbers tested. Raw driver indexes untrimmed whitespace; collision correctly enforced per college.');

    // Simulated test failure injection (for automated testing of error handling)
    if (simulatedFailure) {
      throw new Error(`SIMULATED_TEST_FAILURE: ${simulatedFailure}`);
    }

    executionSummary.syntheticRecordsInserted = trackedInsertedIds.length;
    executionSummary.passed = true;
    console.log(`\nAll direct-driver index assertions PASSED (${trackedInsertedIds.length} synthetic records verified).`);
    return executionSummary;
  } finally {
    // 8. Narrow and Verifiable Cleanup
    if (conn && conn.db && !dryRun && trackedInsertedIds.length > 0) {
      console.log('\n[CLEANUP] Executing narrow, verified cleanup strictly by exact testRunId:');
      console.log(`  Target testRunId: ${testRunId}`);
      console.log(`  Tracked inserted IDs count: ${trackedInsertedIds.length}`);

      try {
        const coll = conn.db.collection('studentprofiles');

        // Pre-cleanup inspection: query all documents carrying this exact testRunId
        const preDeleteRunDocs = await coll.find({ testRunId }).toArray();
        console.log(`  Inspected matching testRunId documents: ${preDeleteRunDocs.length}`);

        // Safety assertion: confirm every document found has testRunId equal to our testRunId
        for (const doc of preDeleteRunDocs) {
          if (doc.testRunId !== testRunId) {
            throw new CleanupIntegrityError(
              `FATAL_CLEANUP_GUARD: Encountered document with divergent testRunId '${doc.testRunId}'! Halting cleanup.`,
              'DIVERGENT_TEST_RUN_ID',
              { docId: doc._id }
            );
          }
        }

        // Simulate cleanup failure if requested by test harness
        if (simulateCleanupFailure) {
          // Intentionally do not delete to test leftover reporting
          console.log('  [SIMULATION] Simulating cleanup failure (skipping deletion)...');
        } else {
          // Delete strictly by the exact logged testRunId
          const deleteResult = await coll.deleteMany({ testRunId });
          console.log(`  Deleted ${deleteResult.deletedCount} documents matching exact testRunId.`);
          executionSummary.cleanup.deletedCount = deleteResult.deletedCount;
        }

        // Post-cleanup verification: confirm 0 documents remain with this testRunId
        const remainingRunDocs = await coll.find({ testRunId }).toArray();
        const postCleanupTotalCount = await coll.countDocuments();

        executionSummary.cleanup.performed = true;

        if (remainingRunDocs.length > 0 || postCleanupTotalCount !== baselineCount) {
          const leftoverIds = remainingRunDocs.map((d) => d._id.toString());
          executionSummary.cleanup.leftoverIds = leftoverIds;
          executionSummary.cleanup.baselineRestored = false;

          console.error(`\n[CLEANUP INTEGRITY ERROR] Leftover synthetic test records detected!`);
          console.error(`  testRunId:               ${testRunId}`);
          console.error(`  Leftover Count:          ${leftoverIds.length}`);
          console.error(`  Recorded Baseline Count: ${baselineCount}`);
          console.error(`  Actual Document Count:   ${postCleanupTotalCount}`);
          console.error(`  MANUAL RECOVERY INSTRUCTIONS:`);
          console.error(`    1. Inspect: db.studentprofiles.find({ testRunId: "${testRunId}" }).toArray();`);
          console.error(`    2. Delete:  db.studentprofiles.deleteMany({ testRunId: "${testRunId}" });`);
          console.error(`    3. Verify:  Confirm studentprofiles collection count returns to recorded baseline (${baselineCount}).\n`);

          throw new CleanupIntegrityError(
            `CLEANUP_INTEGRITY_FAILED: ${leftoverIds.length} synthetic records remaining for testRunId '${testRunId}'. Baseline count not restored (${postCleanupTotalCount} vs recorded baseline ${baselineCount}).`,
            'BASELINE_NOT_RESTORED',
            { testRunId, leftoverIds, recordedBaselineCount: baselineCount, baselineCount, postCleanupTotalCount }
          );
        }

        executionSummary.cleanup.baselineRestored = true;
        console.log(`  √ PASS: Zero records remaining for testRunId. Collection count restored to baseline (${postCleanupTotalCount}).`);
      } catch (cleanupErr) {
        if (!(cleanupErr instanceof CleanupIntegrityError)) {
          console.error(`\n[CLEANUP EXCEPTION] Error during cleanup: ${cleanupErr.message}`);
        }
        throw cleanupErr;
      }
    }

    if (conn) {
      await conn.close();
      console.log('[Cleanup] Closed MongoDB connection.');
    }
  }
}

// CLI Execution Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  let targetDb = null;
  let mongoUri = null;
  let isExecute = false;
  let allowLiveTarget = false;

  for (const arg of args) {
    if (arg.startsWith('--target-db=')) {
      targetDb = arg.split('=')[1].trim();
    } else if (arg.startsWith('--target-uri=')) {
      mongoUri = arg.split('=')[1].trim();
    } else if (arg === '--execute') {
      isExecute = true;
    } else if (arg === '--dry-run') {
      isExecute = false;
    } else if (arg === '--allow-live-target') {
      allowLiveTarget = true;
    }
  }

  const dryRun = !isExecute;

  executeSmokeTest({
    targetDb,
    mongoUri,
    dryRun,
    allowLiveTarget,
  })
    .then((result) => {
      console.log('\n================================================================================');
      console.log(`SMOKE TEST RESULT: ${result.passed ? 'PASSED' : 'FAILED'}`);
      console.log('================================================================================\n');
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error(`\n[FATAL HALT] ${err.name} [${err.code || 'UNKNOWN'}]: ${err.message}`);
      if (err.details) {
        console.error('Details:', JSON.stringify(err.details, null, 2));
      }
      process.exit(1);
    });
}

module.exports = {
  SmokeTestPreconditionError,
  CleanupIntegrityError,
  generateTestRunId,
  validateIndexSpecification,
  executeSmokeTest,
};
