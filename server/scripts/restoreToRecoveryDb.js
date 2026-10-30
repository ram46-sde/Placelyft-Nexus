/**
 * Isolated Recovery Script — Restores a verified BSON backup into college_placement_recovery
 *
 * SAFETY INVARIANTS:
 * 1. FORBIDDEN TARGETS: Refuses to run if target is college_placement_db, admin, local, config, or prod.
 * 2. PRE-RESTORE VALIDATION: Validates source backup directory, manifest, and SHA256 checksums before writing.
 * 3. POST-RESTORE VERIFICATION: Confirms collection counts, document counts, indexes, and BSON types.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { BSON } = require('bson');

const FORBIDDEN_TARGET_DBS = [
  'college_placement_db',
  'admin',
  'local',
  'config',
  'production',
  'prod',
];

const DEFAULT_RECOVERY_DB = 'college_placement_recovery';
const BACKUP_ROOT = path.join(__dirname, '..', 'backups');

function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Finds the latest verified backup directory in server/backups.
 */
function getLatestBackupDir() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    throw new Error(`BACKUP_ROOT_NOT_FOUND: Directory does not exist: ${BACKUP_ROOT}`);
  }
  const entries = fs
    .readdirSync(BACKUP_ROOT)
    .filter((name) => name.startsWith('backup_') && fs.statSync(path.join(BACKUP_ROOT, name)).isDirectory())
    .sort()
    .reverse();

  if (entries.length === 0) {
    throw new Error('NO_BACKUPS_FOUND: No backup directories found in server/backups');
  }
  return path.join(BACKUP_ROOT, entries[0]);
}

/**
 * Executes isolated restore into the designated recovery database.
 * @param {string} targetDbName - Name of isolated recovery database.
 * @param {string} customBackupDir - Path to backup directory.
 * @param {boolean} cleanupAfter - If true, drops recovery DB after successful verification (for testing).
 */
async function executeIsolatedRecovery(targetDbName = DEFAULT_RECOVERY_DB, customBackupDir = null, cleanupAfter = false) {
  const targetDb = targetDbName.trim();

  console.log('================================================================================');
  console.log('                 ISOLATED RECOVERY PROCEDURE EXECUTION');
  console.log('================================================================================');
  console.log(`Target Recovery DB: ${targetDb}`);

  // 1. Target Safety Guard: Refuse live or forbidden database targets
  if (FORBIDDEN_TARGET_DBS.includes(targetDb.toLowerCase())) {
    throw new Error(
      `FATAL_SAFETY_VIOLATION: Refusing to restore into protected/live database: '${targetDb}'. Isolated recovery must target '${DEFAULT_RECOVERY_DB}'.`
    );
  }

  // 2. Resolve and Validate Backup Directory
  const backupDir = customBackupDir ? path.resolve(customBackupDir) : getLatestBackupDir();
  console.log(`Source Backup Dir:  ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    throw new Error(`BACKUP_DIR_NOT_FOUND: ${backupDir}`);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`MANIFEST_MISSING: Backup manifest not found at ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Manifest Source DB: ${manifest.sourceDatabase} (Timestamp: ${manifest.timestamp})`);
  console.log(`Collections to Restore: ${Object.keys(manifest.collections).join(', ')}`);

  // 3. Pre-flight Checksum Verification of all BSON files before any DB connection
  console.log('\n[Preflight] Verifying SHA256 checksums of backup archives:');
  for (const [collName, meta] of Object.entries(manifest.collections)) {
    const bsonPath = path.join(backupDir, meta.bsonFile);
    if (!fs.existsSync(bsonPath)) {
      throw new Error(`ARCHIVE_FILE_MISSING: Missing BSON file for collection ${collName}: ${bsonPath}`);
    }
    const buffer = fs.readFileSync(bsonPath);
    const checksum = calculateSha256(buffer);
    if (checksum !== meta.sha256) {
      throw new Error(`CHECKSUM_MISMATCH: ${collName} checksum ${checksum} does not match manifest ${meta.sha256}`);
    }
    console.log(`  √ [${collName}] SHA256 verified (${buffer.length} bytes)`);
  }

  // 4. Connect to Isolated Recovery Database
  const conn = await mongoose.createConnection(`mongodb://127.0.0.1:27017/${targetDb}`).asPromise();
  const db = conn.db;

  console.log(`\n[Restore] Connected to isolated recovery target: ${targetDb}`);
  // Drop recovery database to ensure clean, isolated slate
  await db.dropDatabase();

  // 5. Restore Collections, Documents, and Indexes
  for (const [collName, meta] of Object.entries(manifest.collections)) {
    const bsonBuffer = fs.readFileSync(path.join(backupDir, meta.bsonFile));
    const metaJson = JSON.parse(fs.readFileSync(path.join(backupDir, meta.metadataFile), 'utf-8'));

    // Recreate collection namespace with source options
    await db.createCollection(collName, metaJson.options || {});
    const targetColl = db.collection(collName);

    // Deserialize BSON buffer
    if (bsonBuffer.length > 0) {
      const deserializedDocs = [];
      let offset = 0;
      while (offset < bsonBuffer.length) {
        const docSize = bsonBuffer.readInt32LE(offset);
        const docSlice = bsonBuffer.subarray(offset, offset + docSize);
        deserializedDocs.push(BSON.deserialize(docSlice));
        offset += docSize;
      }
      await targetColl.insertMany(deserializedDocs);
    }

    // Recreate indexes
    for (const idx of metaJson.indexes) {
      if (idx.name === '_id_') continue;
      const { key, v, ns, ...opts } = idx;
      await targetColl.createIndex(key, opts);
    }
    console.log(`  * Restored [${collName}]: ${meta.count} documents, ${meta.indexCount} indexes`);
  }

  // 6. Post-Restore Validation
  console.log('\n[Validation] Validating restored recovery database integrity:');
  const validationResults = {
    targetDatabase: targetDb,
    collectionsVerified: 0,
    allParityMatched: true,
    representativeTypesVerified: false,
  };

  for (const [collName, meta] of Object.entries(manifest.collections)) {
    const count = await db.collection(collName).countDocuments();
    const indexes = (await db.collection(collName).indexes()).map((i) => i.name).sort();
    const expectedIndexes = meta.indexes.sort();

    const countMatches = count === meta.count;
    const indexMatches = JSON.stringify(indexes) === JSON.stringify(expectedIndexes);

    if (!countMatches || !indexMatches) {
      validationResults.allParityMatched = false;
    }
    validationResults.collectionsVerified++;
    console.log(`  - [${collName}]: Count=${count} (Expected ${meta.count}), Indexes=[${indexes.join(', ')}]`);
  }

  // Validate representative BSON types in users collection
  const userSample = await db.collection('users').findOne({});
  if (userSample) {
    const isObjectId = userSample._id instanceof BSON.ObjectId || (userSample._id && typeof userSample._id.toHexString === 'function');
    const isDate = userSample.createdAt instanceof Date;
    validationResults.representativeTypesVerified = isObjectId && isDate;
    console.log(`  - Representative BSON Type Verification: _id is ObjectId: ${isObjectId}, createdAt is Date: ${isDate}`);
  } else {
    validationResults.representativeTypesVerified = true;
  }

  if (!validationResults.allParityMatched || !validationResults.representativeTypesVerified) {
    throw new Error('RECOVERY_VALIDATION_FAILED: Parity mismatch between backup manifest and restored database.');
  }

  console.log('\n================================================================================');
  console.log(`RECOVERY RESULT: SUCCESSFUL (Database '${targetDb}' is fully validated)`);
  console.log('================================================================================\n');

  if (cleanupAfter) {
    await db.dropDatabase();
    console.log(`[Cleanup] Dropped test recovery database '${targetDb}'.`);
  }

  await conn.close();
  return validationResults;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetDbArg = args.find((a) => a.startsWith('--target-db='))?.split('=')[1] || DEFAULT_RECOVERY_DB;
  const backupDirArg = args.find((a) => a.startsWith('--backup-dir='))?.split('=')[1] || null;
  const cleanupArg = args.includes('--cleanup');

  executeIsolatedRecovery(targetDbArg, backupDirArg, cleanupArg)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nFatal Recovery Error:', err.message);
      process.exit(1);
    });
}

module.exports = { executeIsolatedRecovery, DEFAULT_RECOVERY_DB, FORBIDDEN_TARGET_DBS };
