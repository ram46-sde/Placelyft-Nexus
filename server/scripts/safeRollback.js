/**
 * Hardened Safe Conditional Rollback Utility
 *
 * SAFETY INVARIANTS:
 * 1. CONTROLLED ERROR PROPAGATION: Throws RollbackPreconditionError instead of calling process.exit.
 * 2. GUARANTEED CONNECTION CLEANUP: Always closes Mongoose/Mongo connections in a finally block.
 * 3. WRITE-PAUSE ENFORCEMENT: Asserts that port 5000 is not active before proceeding.
 * 4. DOCUMENT INTEGRITY ENFORCEMENT: Halts if document count does not match the expected baseline.
 * 5. COMPLETE INDEX DEFINITION MATCHING: Validates key, unique, collation, and partialFilterExpression.
 * 6. NEVER DROPS UNEXPECTED INDEX: Halts and preserves database state if any precondition diverges.
 */

const net = require('net');
const mongoose = require('mongoose');

class RollbackPreconditionError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'RollbackPreconditionError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Checks whether a given TCP port is actively listening.
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
 * Validates that an index definition matches the cutover specification exactly.
 */
function validateIndexDefinition(indexObj) {
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

  if (!keyMatches) return { valid: false, reason: 'KEY_PATTERN_MISMATCH' };
  if (!uniqueMatches) return { valid: false, reason: 'UNIQUE_FLAG_MISMATCH' };
  if (!collationMatches) return { valid: false, reason: 'COLLATION_MISMATCH' };
  if (!partialMatches) return { valid: false, reason: 'PARTIAL_FILTER_MISMATCH' };

  return { valid: true, reason: 'EXACT_MATCH' };
}

/**
 * Executes a safe, verified rollback of collegeId_1_rollNumber_1.
 */
async function executeSafeConditionalRollback(options = {}) {
  const {
    targetDb = 'college_placement_db',
    mongoUri = null,
    expectedBaselineCount = 0,
    checkWritePause = true,
    dryRun = false,
  } = options;

  let conn = null;

  try {
    // 1. Verify Write-Pause State (Port 5000)
    if (checkWritePause) {
      const portActive = await isPortListening(5000);
      if (portActive) {
        throw new RollbackPreconditionError(
          'WRITE_PAUSE_VIOLATION: Application server is active on port 5000. Write-pause must be active before rollback.',
          'WRITE_PAUSE_ACTIVE'
        );
      }
    }

    // 2. Validate Target Database Name
    const forbidden = ['admin', 'local', 'config'];
    if (!targetDb || forbidden.includes(targetDb.toLowerCase())) {
      throw new RollbackPreconditionError(
        `INVALID_TARGET_DB: Refusing to execute rollback on protected/system database: '${targetDb}'`,
        'FORBIDDEN_DATABASE'
      );
    }

    // 3. Connect to Database with Guaranteed Teardown
    const uri = mongoUri || `mongodb://127.0.0.1:27017/${targetDb}`;
    conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;
    const coll = db.collection('studentprofiles');

    // 4. Document-Integrity Guard
    const docCount = await coll.countDocuments();
    if (docCount !== expectedBaselineCount) {
      throw new RollbackPreconditionError(
        `DOCUMENT_INTEGRITY_VIOLATION: studentprofiles contains ${docCount} documents (expected baseline: ${expectedBaselineCount}). Rollback halted to protect data.`,
        'BASELINE_COUNT_MISMATCH',
        { docCount, expectedBaselineCount }
      );
    }

    // 5. Inspect Index Catalog
    const indexes = await coll.indexes();
    const targetIndex = indexes.find((i) => i.name === 'collegeId_1_rollNumber_1');

    if (!targetIndex) {
      return {
        success: true,
        status: 'NO_OP',
        message: "Index 'collegeId_1_rollNumber_1' is not present in catalog. No rollback required.",
      };
    }

    // 6. Complete Definition Verification
    const validation = validateIndexDefinition(targetIndex);
    if (!validation.valid) {
      throw new RollbackPreconditionError(
        `INDEX_DEFINITION_MISMATCH: Index 'collegeId_1_rollNumber_1' has unexpected definition (${validation.reason}). Halting without dropping.`,
        'DEFINITION_DIVERGENCE',
        { actualIndex: targetIndex, failureReason: validation.reason }
      );
    }

    // 7. Perform Safe Drop (or Dry-Run)
    if (dryRun) {
      return {
        success: true,
        status: 'DRY_RUN_PASSED',
        message: "All preconditions verified. Index 'collegeId_1_rollNumber_1' matches expected specification and can be safely dropped.",
      };
    }

    await coll.dropIndex('collegeId_1_rollNumber_1');
    return {
      success: true,
      status: 'DROPPED',
      message: "Index 'collegeId_1_rollNumber_1' successfully and safely dropped. Rollback complete.",
    };
  } finally {
    // Guaranteed Connection Teardown
    if (conn) {
      await conn.close();
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetDbArg = args.find((a) => a.startsWith('--target-db='))?.split('=')[1] || 'college_placement_db';
  const dryRunArg = args.includes('--dry-run');
  const skipWritePause = args.includes('--skip-write-pause-check');

  executeSafeConditionalRollback({
    targetDb: targetDbArg,
    dryRun: dryRunArg,
    checkWritePause: !skipWritePause,
  })
    .then((res) => {
      console.log(`[Safe Rollback Result] ${res.status}: ${res.message}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n[Safe Rollback Fatal Halt] ${err.name} [${err.code || 'UNKNOWN'}]: ${err.message}`);
      if (err.details) {
        console.error('Details:', JSON.stringify(err.details, null, 2));
      }
      process.exit(1);
    });
}

module.exports = {
  RollbackPreconditionError,
  isPortListening,
  validateIndexDefinition,
  executeSafeConditionalRollback,
};
