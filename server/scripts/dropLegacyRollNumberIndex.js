/**
 * Milestone 2 — Operation 3: Legacy Roll-Number Index Drop Utility
 *
 * PURPOSE:
 * Safely removes the legacy single-field sparse non-unique index
 * { rollNumber: 1 } (named 'rollNumber_1') from studentprofiles after
 * confirming that the replacement compound unique index
 * { collegeId: 1, rollNumber: 1 } is active and healthy.
 *
 * SAFETY INVARIANTS:
 * 1. DRY-RUN BY DEFAULT: Performs zero index drops or DDL unless --execute is explicitly supplied.
 * 2. TARGET VALIDATION: Explicit --target-db required. Rejects system/forbidden databases.
 * 3. LOCAL HOST INVARIANT: Rejects connections to non-local MongoDB instances (must be 127.0.0.1 or localhost).
 * 4. WRITE-PAUSE ENFORCEMENT: Asserts that port 5000 is inactive before any operation.
 * 5. REPLACEMENT INDEX PRECONDITION: Asserts that collegeId_1_rollNumber_1 exists and matches
 *    the complete 4-part specification (keys, unique: true, collation strength 2, partial filter).
 * 6. LEGACY INDEX PRECONDITION: Asserts that rollNumber_1 exists with key { rollNumber: 1 },
 *    sparse: true, and unique: false.
 * 7. DYNAMIC BASELINE ENFORCEMENT: Captures collection counts dynamically across all collections;
 *    never hard-codes zero. Asserts that document counts remain 100% unchanged after the drop.
 * 8. SINGLE PERMITTED MUTATION: In execute mode, drops ONLY rollNumber_1.
 * 9. POST-DROP VERIFICATION: Asserts that rollNumber_1 is absent and that _id_, user_1, and
 *    collegeId_1_rollNumber_1 remain intact. If verification fails, halts without destructive recovery.
 * 10. GUARANTEED TEARDOWN: Closes MongoDB connection in a finally block.
 *
 * RECOVERY / RE-CREATION PROCEDURE (IF EVER REQUIRED):
 * If authorized administrators ever explicitly decide to recreate the legacy index:
 * db.studentprofiles.createIndex(
 *   { rollNumber: 1 },
 *   { name: "rollNumber_1", sparse: true, background: true }
 * );
 * (Note: Recreating this legacy index is a separate, explicitly approved action).
 */

const net = require('net');
const mongoose = require('mongoose');

// Prevent Mongoose from automatically mutating schema collections or secondary indexes
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const FORBIDDEN_DBS = ['admin', 'local', 'config', 'production', 'prod', 'staging'];

class DropIndexPreconditionError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DropIndexPreconditionError';
    this.code = code;
    this.details = details;
  }
}

class DropIndexVerificationError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DropIndexVerificationError';
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
 * Deep definition validator for collegeId_1_rollNumber_1 index.
 */
function validateNewRollNumberIndex(indexObj) {
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
 * Validates the legacy rollNumber_1 index definition.
 */
function validateLegacyRollNumberIndex(indexObj) {
  if (!indexObj) {
    return { valid: false, reason: 'LEGACY_INDEX_NOT_FOUND' };
  }

  const keyMatches =
    indexObj.key &&
    indexObj.key.rollNumber === 1 &&
    Object.keys(indexObj.key).length === 1;

  const sparseMatches = indexObj.sparse === true;
  const nonUnique = !indexObj.unique; // Must NOT be unique

  if (!keyMatches) return { valid: false, reason: 'KEY_MISMATCH', actual: indexObj.key };
  if (!sparseMatches) return { valid: false, reason: 'SPARSE_FLAG_MISMATCH', actual: indexObj.sparse };
  if (!nonUnique) return { valid: false, reason: 'UNIQUE_FLAG_MISMATCH (Expected non-unique)', actual: indexObj.unique };

  return { valid: true, reason: 'EXACT_MATCH' };
}

/**
 * Executes the Operation 3 legacy index drop procedure with pre- and post-verification.
 */
async function executeDropLegacyIndex(options = {}) {
  const {
    targetDb = null,
    mongoUri = null,
    dryRun = true,
    checkWritePause = true,
    checkPort = 5000,
    requireLocalHost = true,
    expectedBaselineCount = null, // Optional explicit baseline count assertion
    simulatePostDropFailure = null, // Optional test simulation hook
  } = options;

  // 1. Validate Target Database Configuration
  if (!targetDb || typeof targetDb !== 'string' || targetDb.trim().length === 0) {
    throw new DropIndexPreconditionError(
      'TARGET_UNSPECIFIED: Explicit target database must be provided via --target-db=<dbname>. Fallback is prohibited.',
      'TARGET_UNSPECIFIED'
    );
  }

  const normalizedDb = targetDb.trim();

  // Safety Guard: Forbidden System Databases
  if (FORBIDDEN_DBS.includes(normalizedDb.toLowerCase())) {
    throw new DropIndexPreconditionError(
      `TARGET_FORBIDDEN: Refusing to execute index drop on protected/system database: '${normalizedDb}'.`,
      'TARGET_FORBIDDEN'
    );
  }

  // 2. Write-Pause Verification (if enabled)
  if (checkWritePause) {
    const portActive = await isPortListening(checkPort);
    if (portActive) {
      throw new DropIndexPreconditionError(
        `WRITE_PAUSE_VIOLATION: Application server is active on port ${checkPort}. Write-pause must be active during index maintenance.`,
        'WRITE_PAUSE_ACTIVE'
      );
    }
  }

  // 3. Connection URI Construction & Host/Identity Pre-Validation
  const uri = mongoUri || `mongodb://127.0.0.1:27017/${normalizedDb}`;

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch (err) {
    throw new DropIndexPreconditionError(
      `TARGET_URI_INVALID: Malformed MongoDB connection URI: ${err.message}`,
      'TARGET_URI_INVALID',
      { uri, error: err.message }
    );
  }

  // Local Host Invariant Check (Planned local execution must target 127.0.0.1 or localhost)
  const allowedLocalHosts = ['127.0.0.1', 'localhost'];
  const uriHostname = (parsedUri.hostname || '').toLowerCase();
  if (requireLocalHost && !allowedLocalHosts.includes(uriHostname)) {
    throw new DropIndexPreconditionError(
      `NON_LOCAL_HOST_REJECTED: Expected local MongoDB host (127.0.0.1 or localhost), but URI targets host '${uriHostname}'. Aborting.`,
      'NON_LOCAL_HOST_REJECTED',
      { uriHostname, allowedHosts: allowedLocalHosts }
    );
  }

  // Database Name Mismatch Check between URI path and --target-db
  const rawPath = parsedUri.pathname ? parsedUri.pathname.replace(/^\/+/, '') : '';
  const uriDbName = rawPath.split('/')[0].split('?')[0].trim();
  if (uriDbName && uriDbName !== normalizedDb) {
    throw new DropIndexPreconditionError(
      `DATABASE_NAME_MISMATCH: Connection URI specifies database '${uriDbName}', but target database is '${normalizedDb}'. Aborting.`,
      'DATABASE_NAME_MISMATCH',
      { uriDbName, targetDb: normalizedDb }
    );
  }

  let conn = null;

  console.log('================================================================================');
  console.log('        OPERATION 3: LEGACY ROLL-NUMBER INDEX DROP UTILITY');
  console.log('================================================================================');
  console.log(`Target Database: ${normalizedDb}`);
  console.log(`Execution Mode:  ${dryRun ? 'DRY-RUN (Inspection & Preflight Only — No Drops)' : 'LIVE DROP EXECUTION'}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------\n');

  try {
    // 4. Connect to Database with Guaranteed Teardown
    conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;

    // Actual connected database identity verification
    const actualConnectedDbName = db.databaseName;
    if (actualConnectedDbName !== normalizedDb) {
      throw new DropIndexPreconditionError(
        `CONNECTED_DATABASE_MISMATCH: Actual connected database '${actualConnectedDbName}' does not match expected target '${normalizedDb}'. Aborting.`,
        'CONNECTED_DATABASE_MISMATCH',
        { actualConnectedDbName, expectedTargetDb: normalizedDb }
      );
    }
    console.log(`[Target Identity] Connected database verified: '${actualConnectedDbName}' on host '${uriHostname}'`);

    // 5. Dynamic Baseline Capture (Captures all collections dynamically; never hard-codes zero)
    console.log('[Baseline Capture] Recording dynamic document counts across all collections:');
    const allCollections = await db.listCollections().toArray();
    const baselineCounts = {};
    for (const collInfo of allCollections) {
      const cCount = await db.collection(collInfo.name).countDocuments();
      baselineCounts[collInfo.name] = cCount;
      console.log(`  - ${collInfo.name}: ${cCount} documents`);
    }

    const coll = db.collection('studentprofiles');
    const studentProfilesBaseline = baselineCounts['studentprofiles'] || 0;

    // Optional explicit baseline assertion
    if (expectedBaselineCount !== null && studentProfilesBaseline !== expectedBaselineCount) {
      throw new DropIndexPreconditionError(
        `BASELINE_COUNT_MISMATCH: studentprofiles count is ${studentProfilesBaseline}, expected baseline was ${expectedBaselineCount}. Halting to protect data.`,
        'BASELINE_COUNT_MISMATCH',
        { actualCount: studentProfilesBaseline, expectedCount: expectedBaselineCount }
      );
    }

    // 6. Index Catalog Pre-Drop Verification
    console.log('\n[Preflight Catalog Audit] Verifying indexes on studentprofiles:');
    const catalogBefore = await coll.indexes();

    // 6a. Replacement Index Precondition: collegeId_1_rollNumber_1 must be present and valid
    const newIndexObj = catalogBefore.find((i) => i.name === 'collegeId_1_rollNumber_1');
    const newIndexValidation = validateNewRollNumberIndex(newIndexObj);
    if (!newIndexValidation.valid) {
      throw new DropIndexPreconditionError(
        `REPLACEMENT_INDEX_MISSING_OR_INVALID: Replacement index 'collegeId_1_rollNumber_1' validation failed: ${newIndexValidation.reason}. Cannot drop legacy index without verified replacement.`,
        'REPLACEMENT_INDEX_INVALID',
        { newIndexValidation, existingIndexes: catalogBefore.map((i) => i.name) }
      );
    }
    console.log(`  √ Replacement index 'collegeId_1_rollNumber_1': PRESENT & VALID (EXACT_MATCH)`);

    // 6b. Legacy Index Precondition: rollNumber_1 must be present and match legacy specification
    const legacyIndexObj = catalogBefore.find((i) => i.name === 'rollNumber_1');
    const legacyValidation = validateLegacyRollNumberIndex(legacyIndexObj);
    if (!legacyValidation.valid) {
      throw new DropIndexPreconditionError(
        `LEGACY_INDEX_INVALID: Target legacy index 'rollNumber_1' validation failed: ${legacyValidation.reason}.`,
        'LEGACY_INDEX_INVALID',
        { legacyValidation, existingIndexes: catalogBefore.map((i) => i.name) }
      );
    }
    console.log(`  √ Legacy target index 'rollNumber_1': PRESENT & VALID (sparse: true, unique: false)`);

    // 7. Dry-Run Handling
    if (dryRun) {
      console.log('\n[DRY-RUN MODE] Preflight passed. Zero DDL executed. Index was NOT dropped.');
      return {
        success: true,
        dryRun: true,
        targetDatabase: normalizedDb,
        baselineCounts,
        preDropIndexes: catalogBefore.map((i) => i.name),
        message: "Dry-run verification passed. All preconditions verified. Index 'rollNumber_1' can be safely dropped.",
      };
    }

    // 8. Live Drop Execution (Only rollNumber_1)
    console.log("\n[EXECUTION] Dropping index 'rollNumber_1'...");
    await coll.dropIndex('rollNumber_1');
    console.log("  Index 'rollNumber_1' successfully dropped via coll.dropIndex().");

    // 9. Post-Drop Integrity Verification
    console.log('\n[POST-DROP INTEGRITY VERIFICATION]');
    let catalogAfter = await coll.indexes();

    if (simulatePostDropFailure === 'LEGACY_STILL_PRESENT') {
      catalogAfter = [...catalogAfter, { name: 'rollNumber_1', key: { rollNumber: 1 } }];
    } else if (simulatePostDropFailure === 'REPLACEMENT_INDEX_ALTERED') {
      catalogAfter = catalogAfter.filter((i) => i.name !== 'collegeId_1_rollNumber_1');
    } else if (simulatePostDropFailure === 'USER_INDEX_ALTERED') {
      catalogAfter = catalogAfter.filter((i) => i.name !== 'user_1');
    } else if (simulatePostDropFailure === 'ID_INDEX_MISSING') {
      catalogAfter = catalogAfter.filter((i) => i.name !== '_id_');
    }

    // 9a. Assert rollNumber_1 is absent
    const legacyStillPresent = catalogAfter.some((i) => i.name === 'rollNumber_1');
    if (legacyStillPresent) {
      throw new DropIndexVerificationError(
        "POST_DROP_FAILED: Index 'rollNumber_1' is still present in catalog after dropIndex!",
        'LEGACY_INDEX_STILL_PRESENT'
      );
    }
    console.log("  1. Legacy index 'rollNumber_1': ABSENT from catalog (VERIFIED)");

    // 9b. Assert remaining core indexes are present and identical
    const newIndexAfter = catalogAfter.find((i) => i.name === 'collegeId_1_rollNumber_1');
    const newIndexReValidation = validateNewRollNumberIndex(newIndexAfter);
    if (!newIndexReValidation.valid) {
      throw new DropIndexVerificationError(
        `POST_DROP_FAILED: Replacement index 'collegeId_1_rollNumber_1' altered or missing: ${newIndexReValidation.reason}`,
        'REPLACEMENT_INDEX_ALTERED'
      );
    }
    console.log("  2. Replacement index 'collegeId_1_rollNumber_1': PRESENT & INTACT (VERIFIED)");

    const userIndexAfter = catalogAfter.find((i) => i.name === 'user_1');
    if (!userIndexAfter || !userIndexAfter.unique) {
      throw new DropIndexVerificationError(
        "POST_DROP_FAILED: Core index 'user_1' altered or missing!",
        'USER_INDEX_ALTERED'
      );
    }
    console.log("  3. Core index 'user_1': PRESENT & INTACT (VERIFIED)");

    const idIndexAfter = catalogAfter.find((i) => i.name === '_id_');
    if (!idIndexAfter) {
      throw new DropIndexVerificationError(
        "POST_DROP_FAILED: Primary key index '_id_' missing!",
        'ID_INDEX_MISSING'
      );
    }
    console.log("  4. Primary index '_id_': PRESENT & INTACT (VERIFIED)");

    // 9c. Assert all collection document counts strictly match baseline
    console.log('  5. Verifying collection document count parity against baseline:');
    let countsParity = true;
    const postCounts = {};
    for (const collInfo of allCollections) {
      let postCount = await db.collection(collInfo.name).countDocuments();
      if (simulatePostDropFailure === 'DOCUMENT_COUNT_MISMATCH' && collInfo.name === 'studentprofiles') {
        postCount += 1;
      }
      postCounts[collInfo.name] = postCount;
      const matches = postCount === baselineCounts[collInfo.name];
      if (!matches) {
        countsParity = false;
      }
      console.log(`     - ${collInfo.name}: ${postCount} documents (baseline: ${baselineCounts[collInfo.name]}) -> ${matches ? 'MATCH' : 'MISMATCH'}`);
    }

    if (!countsParity) {
      throw new DropIndexVerificationError(
        'POST_DROP_FAILED: Collection document counts changed during index drop!',
        'DOCUMENT_COUNT_MISMATCH',
        { baselineCounts, postCounts }
      );
    }

    console.log('\n================================================================================');
    console.log("OPERATION 3 SUCCESSFUL: Index 'rollNumber_1' dropped and catalog verified.");
    console.log('================================================================================\n');

    return {
      success: true,
      dryRun: false,
      targetDatabase: normalizedDb,
      droppedIndex: 'rollNumber_1',
      remainingIndexes: catalogAfter.map((i) => i.name),
      baselineCounts,
      postCounts,
    };
  } finally {
    // 10. Guaranteed Teardown
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

  for (const arg of args) {
    if (arg.startsWith('--target-db=')) {
      targetDb = arg.split('=')[1].trim();
    } else if (arg.startsWith('--target-uri=')) {
      mongoUri = arg.split('=')[1].trim();
    } else if (arg === '--execute') {
      isExecute = true;
    } else if (arg === '--dry-run') {
      isExecute = false;
    }
  }

  const dryRun = !isExecute;

  executeDropLegacyIndex({
    targetDb,
    mongoUri,
    dryRun,
  })
    .then((result) => {
      console.log(`[Operation 3 Result] ${result.dryRun ? 'DRY-RUN COMPLETE' : 'DROP COMPLETE'}: ${result.message || 'Success'}`);
      process.exit(0);
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
  DropIndexPreconditionError,
  DropIndexVerificationError,
  validateNewRollNumberIndex,
  validateLegacyRollNumberIndex,
  executeDropLegacyIndex,
  isPortListening,
};
