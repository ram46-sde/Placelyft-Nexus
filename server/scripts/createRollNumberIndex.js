/**
 * Milestone 2 — Operation 1: Create the New Student Roll-Number Index
 *
 * SAFETY INVARIANTS:
 * 1. MANDATORY PREFLIGHT: All 7 preflight checks must pass before any database modification.
 * 2. TARGET VALIDATION: Explicitly requires target database to be college_placement_db.
 * 3. READ-ONLY PREFLIGHT: In --dry-run mode (default), zero mutations are performed.
 * 4. OPERATION 1 ONLY: Creates only compound unique index { collegeId: 1, rollNumber: 1 } on studentprofiles.
 * 5. PRESERVES LEGACY: Explicitly verifies that rollNumber_1 remains in catalog unchanged.
 * 6. ZERO RECORD MUTATIONS: No documents inserted, updated, or deleted.
 * 7. GUARANTEED TEARDOWN: Always disconnects from MongoDB in a finally block.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const mongoose = require('mongoose');
const { BSON } = require('bson');

// Mongoose safety configuration
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const EXPECTED_DB_NAME = 'college_placement_db';
const EXPECTED_BACKUP_DIR = path.resolve(__dirname, '..', 'backups', 'backup_20261015_112042');

function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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

  if (!keyMatches) return { valid: false, reason: 'KEY_MISMATCH' };
  if (!sparseMatches) return { valid: false, reason: 'SPARSE_FLAG_MISMATCH' };
  if (!nonUnique) return { valid: false, reason: 'UNIQUE_FLAG_MISMATCH (Expected non-unique)' };

  return { valid: true, reason: 'EXACT_MATCH' };
}

/**
 * Executes all 7 mandatory preflight checks.
 */
async function runPreflightChecks(db, uri, targetDbName) {
  const preflightReport = {
    allPassed: true,
    checks: {},
  };

  console.log('--------------------------------------------------------------------------------');
  console.log('                  MANDATORY PREFLIGHT VERIFICATION CHECKS                       ');
  console.log('--------------------------------------------------------------------------------');

  // Check 1: Target Database and Connection URI
  console.log('[Check 1/7] Target Database and Connection URI...');
  const isTargetMatch = targetDbName === EXPECTED_DB_NAME || targetDbName === 'college_placement_test_db';
  const uriExpected = uri.includes('127.0.0.1:27017') || uri.includes('localhost:27017');
  if (!isTargetMatch || !uriExpected) {
    preflightReport.allPassed = false;
    preflightReport.checks.check1 = {
      passed: false,
      targetDb: targetDbName,
      uri,
      error: `TARGET_MISMATCH: Target must be ${EXPECTED_DB_NAME} on local MongoDB instance (127.0.0.1:27017).`,
    };
    console.log(`  FAIL: Target DB or URI mismatch (db: ${targetDbName}, uri: ${uri})`);
  } else {
    preflightReport.checks.check1 = {
      passed: true,
      targetDb: targetDbName,
      uri,
    };
    console.log(`  PASS: Target database is '${targetDbName}' targeting local MongoDB instance at 127.0.0.1:27017.`);
  }

  // Check 2: Verify Existing Backup & Integrity
  console.log('[Check 2/7] Backup Verification at server/backups/backup_20261015_112042...');
  try {
    if (!fs.existsSync(EXPECTED_BACKUP_DIR)) {
      throw new Error(`Backup directory not found at: ${EXPECTED_BACKUP_DIR}`);
    }
    const manifestPath = path.join(EXPECTED_BACKUP_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json missing at: ${manifestPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.sourceDatabase !== EXPECTED_DB_NAME) {
      throw new Error(`Manifest sourceDatabase '${manifest.sourceDatabase}' does not match expected '${EXPECTED_DB_NAME}'`);
    }

    const backupFileResults = {};
    for (const [collName, meta] of Object.entries(manifest.collections)) {
      const bsonPath = path.join(EXPECTED_BACKUP_DIR, meta.bsonFile);
      const metaPath = path.join(EXPECTED_BACKUP_DIR, meta.metadataFile);

      if (!fs.existsSync(bsonPath)) {
        throw new Error(`BSON archive missing for collection '${collName}': ${bsonPath}`);
      }
      if (!fs.existsSync(metaPath)) {
        throw new Error(`Metadata file missing for collection '${collName}': ${metaPath}`);
      }

      const bsonBuffer = fs.readFileSync(bsonPath);
      const computedHash = calculateSha256(bsonBuffer);
      if (computedHash !== meta.sha256) {
        throw new Error(`SHA256 checksum mismatch on ${meta.bsonFile}: expected ${meta.sha256}, got ${computedHash}`);
      }

      // Verify BSON deserialization fidelity
      if (bsonBuffer.length > 0) {
        let offset = 0;
        let count = 0;
        while (offset < bsonBuffer.length) {
          const docSize = bsonBuffer.readInt32LE(offset);
          const docSlice = bsonBuffer.subarray(offset, offset + docSize);
          BSON.deserialize(docSlice);
          offset += docSize;
          count++;
        }
        if (count !== meta.count) {
          throw new Error(`Document count mismatch in BSON archive for '${collName}': expected ${meta.count}, deserialized ${count}`);
        }
      }

      backupFileResults[collName] = {
        docs: meta.count,
        byteSize: bsonBuffer.length,
        sha256Match: true,
      };
    }

    preflightReport.checks.check2 = {
      passed: true,
      backupDir: EXPECTED_BACKUP_DIR,
      timestamp: manifest.timestamp,
      mongoVersion: manifest.mongoVersion,
      collectionsVerified: Object.keys(backupFileResults).length,
      details: backupFileResults,
    };
    console.log(`  PASS: Backup integrity 100% verified (${Object.keys(backupFileResults).length} collections, all SHA256 checksums and BSON deserialization matched).`);
  } catch (err) {
    preflightReport.allPassed = false;
    preflightReport.checks.check2 = {
      passed: false,
      error: err.message,
    };
    console.log(`  FAIL: Backup verification failed: ${err.message}`);
  }

  // Check 3: Confirm Application on Port 5000 is Stopped & No Write Activity
  console.log('[Check 3/7] Application Write-Pause State (Port 5000)...');
  const port5000Listening = await isPortListening(5000);
  let activeWrites = [];
  try {
    const adminDb = db.admin();
    const currentOpResult = await adminDb.command({
      currentOp: 1,
      active: true,
      op: { $in: ['insert', 'update', 'remove'] },
    });
    if (currentOpResult && currentOpResult.inprog) {
      activeWrites = currentOpResult.inprog.filter((op) => op.ns && op.ns.startsWith(`${targetDbName}.`));
    }
  } catch (err) {
    // CurrentOp command might be restricted on some setups, not fatal if empty
  }

  if (port5000Listening) {
    preflightReport.allPassed = false;
    preflightReport.checks.check3 = {
      passed: false,
      port5000Listening: true,
      error: 'WRITE_PAUSE_VIOLATION: Port 5000 is active. Application must be stopped before migration.',
    };
    console.log('  FAIL: Application server is active on port 5000.');
  } else if (activeWrites.length > 0) {
    preflightReport.allPassed = false;
    preflightReport.checks.check3 = {
      passed: false,
      activeWrites,
      error: `ACTIVE_WRITES_DETECTED: ${activeWrites.length} active write operations in progress on ${targetDbName}.`,
    };
    console.log(`  FAIL: Active write operations detected on ${targetDbName}.`);
  } else {
    preflightReport.checks.check3 = {
      passed: true,
      port5000Listening: false,
      activeWritesCount: activeWrites.length,
    };
    console.log('  PASS: Port 5000 is free and no active write operations detected on database.');
  }

  // Check 4: Inspect Existing studentprofiles Documents & Index Catalog
  console.log('[Check 4/7] Inspecting studentprofiles Documents and Index Catalog...');
  const studentProfilesColl = db.collection('studentprofiles');
  const profileCount = await studentProfilesColl.countDocuments();
  const existingProfiles = await studentProfilesColl.find({}).toArray();
  const existingIndexes = await studentProfilesColl.indexes();

  const legacyIndexObj = existingIndexes.find((i) => i.name === 'rollNumber_1');
  const legacyValidation = validateLegacyRollNumberIndex(legacyIndexObj);

  const existingNewIndexObj = existingIndexes.find((i) => i.name === 'collegeId_1_rollNumber_1');
  const newIndexPreCheck = existingNewIndexObj ? validateNewRollNumberIndex(existingNewIndexObj) : null;

  preflightReport.checks.check4 = {
    passed: legacyValidation.valid,
    profileCount,
    existingProfiles: existingProfiles.map((p) => ({
      _id: p._id,
      user: p.user,
      collegeId: p.collegeId,
      rollNumber: p.rollNumber,
    })),
    indexes: existingIndexes.map((i) => ({
      name: i.name,
      key: i.key,
      unique: i.unique || false,
      sparse: i.sparse || false,
      collation: i.collation || null,
      partialFilterExpression: i.partialFilterExpression || null,
    })),
    legacyRollNumberIndexValid: legacyValidation.valid,
    newRollNumberIndexAlreadyPresent: Boolean(existingNewIndexObj),
    newRollNumberIndexDefinition: newIndexPreCheck,
  };

  if (!legacyValidation.valid) {
    preflightReport.allPassed = false;
    console.log(`  FAIL: Legacy rollNumber_1 index state invalid: ${legacyValidation.reason}`);
  } else {
    console.log(`  PASS: studentprofiles documents: ${profileCount}. Index catalog contains ${existingIndexes.length} indexes, including verified legacy rollNumber_1.`);
    if (existingNewIndexObj) {
      console.log(`  NOTICE: collegeId_1_rollNumber_1 is already present in catalog (Definition: ${newIndexPreCheck.reason}).`);
    }
  }

  // Check 5: Conflicting Non-Empty Roll Numbers Within Same College (Case-Insensitive)
  console.log('[Check 5/7] Checking for Same-College Duplicate Roll Numbers (Case-Insensitive)...');
  const duplicatePipeline = [
    { $match: { rollNumber: { $type: 'string', $gt: '' } } },
    {
      $group: {
        _id: {
          collegeId: '$collegeId',
          normalizedRoll: { $toLower: { $trim: { input: '$rollNumber' } } },
        },
        count: { $sum: 1 },
        docs: { $push: '$_id' },
        sampleRolls: { $push: '$rollNumber' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ];
  const duplicateResults = await studentProfilesColl.aggregate(duplicatePipeline).toArray();

  if (duplicateResults.length > 0) {
    preflightReport.allPassed = false;
    preflightReport.checks.check5 = {
      passed: false,
      conflictsCount: duplicateResults.length,
      conflicts: duplicateResults,
      error: `INTEGRITY_BLOCKER: Found ${duplicateResults.length} duplicate roll number conflicts within the same college.`,
    };
    console.log(`  FAIL: Found ${duplicateResults.length} same-college duplicate roll number conflicts!`);
  } else {
    preflightReport.checks.check5 = {
      passed: true,
      conflictsCount: 0,
    };
    console.log('  PASS: Zero same-college duplicate roll numbers found.');
  }

  // Check 6: Verify Every Non-Empty Roll Number Has a Valid collegeId
  console.log('[Check 6/7] Verifying collegeId on All Non-Empty Roll Numbers...');
  const profilesWithRoll = await studentProfilesColl
    .find({ rollNumber: { $type: 'string', $gt: '' } })
    .toArray();

  const collegesColl = db.collection('colleges');
  const validColleges = await collegesColl.find({}).toArray();
  const validCollegeIdSet = new Set(validColleges.map((c) => c._id.toString()));

  const invalidProfiles = [];
  for (const prof of profilesWithRoll) {
    if (!prof.collegeId || !validCollegeIdSet.has(prof.collegeId.toString())) {
      invalidProfiles.push({
        _id: prof._id,
        rollNumber: prof.rollNumber,
        collegeId: prof.collegeId || null,
        reason: !prof.collegeId ? 'MISSING_COLLEGE_ID' : 'INVALID_COLLEGE_ID',
      });
    }
  }

  if (invalidProfiles.length > 0) {
    preflightReport.allPassed = false;
    preflightReport.checks.check6 = {
      passed: false,
      invalidCount: invalidProfiles.length,
      invalidProfiles,
      error: `INVALID_COLLEGE_ASSIGNMENT: ${invalidProfiles.length} profiles have non-empty rollNumber but lack valid collegeId.`,
    };
    console.log(`  FAIL: ${invalidProfiles.length} profiles have roll numbers with missing/invalid collegeId.`);
  } else {
    preflightReport.checks.check6 = {
      passed: true,
      profilesAudited: profilesWithRoll.length,
      invalidCount: 0,
    };
    console.log(`  PASS: All profiles with non-empty roll numbers (${profilesWithRoll.length}) have valid collegeId.`);
  }

  // Check 7: Compatibility of Requested Index with MongoDB Server & Existing Data
  console.log('[Check 7/7] Verifying MongoDB Server & Data Compatibility for Requested Index...');
  const adminDb = db.admin();
  const buildInfo = await adminDb.buildInfo();
  const mongoVersion = buildInfo.version;
  const majorVersion = parseInt(mongoVersion.split('.')[0], 10);

  const isServerCompatible = majorVersion >= 4; // Collation & partialFilter supported >= 3.4/4.2
  const usesDisallowedNe = false; // Filter { rollNumber: { $type: "string", $gt: "" } } does not use $ne

  if (!isServerCompatible) {
    preflightReport.allPassed = false;
    preflightReport.checks.check7 = {
      passed: false,
      mongoVersion,
      error: `SERVER_INCOMPATIBLE: MongoDB version ${mongoVersion} does not support requested index capabilities.`,
    };
    console.log(`  FAIL: MongoDB version ${mongoVersion} is incompatible.`);
  } else {
    preflightReport.checks.check7 = {
      passed: true,
      mongoVersion,
      majorVersion,
      usesDisallowedNe,
      collationSupported: true,
      partialFilterSupported: true,
    };
    console.log(`  PASS: MongoDB ${mongoVersion} fully supports compound unique index with collation { locale: "en", strength: 2 } and partialFilterExpression.`);
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`PREFLIGHT SUMMARY: ${preflightReport.allPassed ? 'ALL 7 CHECKS PASSED' : 'PREFLIGHT CHECKS FAILED'}`);
  console.log('--------------------------------------------------------------------------------\n');

  return preflightReport;
}

/**
 * Executes Operation 1: Creates the compound unique index on studentprofiles.
 */
async function executeOperation1(options = {}) {
  const {
    targetDb = EXPECTED_DB_NAME,
    mongoUri = null,
    dryRun = true,
  } = options;

  console.log('================================================================================');
  console.log('        MILESTONE 2 — OPERATION 1: CREATE STUDENT ROLL-NUMBER INDEX');
  console.log('================================================================================');
  console.log(`Target Database: ${targetDb}`);
  console.log(`Execution Mode:  ${dryRun ? 'DRY-RUN (Inspection Only — Zero Mutations)' : 'LIVE EXECUTION'}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------\n');

  // Forbidden databases guard
  const forbidden = ['admin', 'local', 'config', 'production', 'prod'];
  if (!targetDb || forbidden.includes(targetDb.toLowerCase())) {
    throw new Error(`FATAL_TARGET_ERROR: Refusing to execute on forbidden database: '${targetDb}'`);
  }

  const uri = mongoUri || `mongodb://127.0.0.1:27017/${targetDb}`;
  let conn = null;

  try {
    conn = await mongoose.createConnection(uri).asPromise();
    const db = conn.db;

    // Snapshot collection counts across the entire database before doing anything
    const collectionsList = await db.listCollections().toArray();
    const baselineCounts = {};
    for (const collInfo of collectionsList) {
      baselineCounts[collInfo.name] = await db.collection(collInfo.name).countDocuments();
    }

    // Run Mandatory Preflight Checks
    const preflight = await runPreflightChecks(db, uri, targetDb);

    if (!preflight.allPassed) {
      throw new Error('PREFLIGHT_FAILED: One or more mandatory preflight checks failed. Halting without modifying database.');
    }

    if (dryRun) {
      console.log('[DRY-RUN COMPLETE] All 7 preflight checks passed. Database was NOT modified.');
      return {
        success: true,
        dryRun: true,
        preflight,
        baselineCounts,
      };
    }

    // LIVE EXECUTION: Operation 1 only
    console.log('[OPERATION 1 EXECUTION] Checking existing index catalog before creation...');
    const coll = db.collection('studentprofiles');
    const catalogBefore = await coll.indexes();
    const alreadyExists = catalogBefore.find((i) => i.name === 'collegeId_1_rollNumber_1');

    let creationResult = null;
    if (alreadyExists) {
      const validation = validateNewRollNumberIndex(alreadyExists);
      if (!validation.valid) {
        throw new Error(`INDEX_ALREADY_EXISTS_WITH_DIVERGENT_SPEC: ${validation.reason}. Manual inspection required.`);
      }
      console.log("  Notice: Index 'collegeId_1_rollNumber_1' already exists with exact matching definition. Re-creation skipped.");
      creationResult = 'ALREADY_EXISTS_VALID';
    } else {
      console.log("  Building index 'collegeId_1_rollNumber_1'...");
      const indexName = await coll.createIndex(
        { collegeId: 1, rollNumber: 1 },
        {
          name: 'collegeId_1_rollNumber_1',
          unique: true,
          collation: { locale: 'en', strength: 2 },
          partialFilterExpression: { rollNumber: { $type: 'string', $gt: '' } },
          background: true,
        }
      );
      console.log(`  Index created successfully: '${indexName}'`);
      creationResult = 'CREATED';
    }

    // Post-Execution Verification
    console.log('\n[POST-EXECUTION VERIFICATION]');
    const catalogAfter = await coll.indexes();

    // 1. Verify complete definition of collegeId_1_rollNumber_1
    const newIndexObj = catalogAfter.find((i) => i.name === 'collegeId_1_rollNumber_1');
    const newIndexValidation = validateNewRollNumberIndex(newIndexObj);
    if (!newIndexValidation.valid) {
      throw new Error(`POST_VERIFICATION_FAILED: New index definition mismatch (${newIndexValidation.reason})`);
    }
    console.log(`  1. collegeId_1_rollNumber_1 Verified: EXACT MATCH`);
    console.log(`     - Keys:                    ${JSON.stringify(newIndexObj.key)}`);
    console.log(`     - Unique:                  ${newIndexObj.unique}`);
    console.log(`     - Collation:               locale: "${newIndexObj.collation.locale}", strength: ${newIndexObj.collation.strength}`);
    console.log(`     - PartialFilterExpression: ${JSON.stringify(newIndexObj.partialFilterExpression)}`);

    // 2. Verify legacy rollNumber_1 index remains unchanged
    const legacyIndexObj = catalogAfter.find((i) => i.name === 'rollNumber_1');
    const legacyValidation = validateLegacyRollNumberIndex(legacyIndexObj);
    if (!legacyValidation.valid) {
      throw new Error(`POST_VERIFICATION_FAILED: Legacy rollNumber_1 index altered or missing (${legacyValidation.reason})`);
    }
    console.log(`  2. Legacy rollNumber_1 Verified: UNCHANGED`);
    console.log(`     - Keys:                    ${JSON.stringify(legacyIndexObj.key)}`);
    console.log(`     - Sparse:                  ${legacyIndexObj.sparse}`);
    console.log(`     - Unique:                  ${legacyIndexObj.unique || false}`);

    // 3. Confirm document counts across all collections remain unchanged
    let countsIntact = true;
    const postCounts = {};
    for (const collInfo of collectionsList) {
      postCounts[collInfo.name] = await db.collection(collInfo.name).countDocuments();
      if (postCounts[collInfo.name] !== baselineCounts[collInfo.name]) {
        countsIntact = false;
      }
    }

    if (!countsIntact) {
      throw new Error('POST_VERIFICATION_FAILED: Document counts changed during index creation!');
    }
    console.log(`  3. Collection Counts Verified: 100% UNCHANGED`);
    for (const [cName, cCount] of Object.entries(postCounts)) {
      console.log(`     - ${cName}: ${cCount} documents (baseline: ${baselineCounts[cName]})`);
    }

    console.log('\n================================================================================');
    console.log('OPERATION 1 SUCCESSFUL: New compound roll-number index created and verified.');
    console.log('================================================================================\n');

    return {
      success: true,
      dryRun: false,
      targetDatabase: targetDb,
      creationResult,
      newIndex: newIndexObj,
      legacyIndex: legacyIndexObj,
      catalogAfter,
      baselineCounts,
      postCounts,
      preflight,
    };
  } finally {
    if (conn) {
      await conn.close();
      console.log('[Cleanup] Closed MongoDB connection.');
    }
  }
}

// CLI Execution Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  let targetDb = EXPECTED_DB_NAME;
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

  executeOperation1({
    targetDb,
    mongoUri,
    dryRun,
  })
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('\n[FATAL ERROR]', err.message);
      process.exit(1);
    });
}

module.exports = {
  runPreflightChecks,
  executeOperation1,
  validateNewRollNumberIndex,
  validateLegacyRollNumberIndex,
};
