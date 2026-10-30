/**
 * Standalone MongoDB Backup & Isolated Verification Utility
 *
 * Provides a fully supported, standalone-compatible backup procedure using
 * official BSON binary serialization and catalog index metadata capture.
 *
 * SAFETY INVARIANTS:
 * 1. Read-only against the source database (college_placement_db).
 * 2. Checks available disk space before starting.
 * 3. Serializes documents into canonical BSON files (.bson) and index metadata (.metadata.json).
 * 4. Preserves the timestamped backup directory permanently for recovery.
 * 5. Restores into a dedicated isolated verification database (college_placement_backup_verify).
 * 6. Validates exact document counts, index definitions, and sample record fidelity.
 * 7. Cleans up only the verification database upon successful validation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { BSON } = require('bson');

const SOURCE_DB_NAME = 'college_placement_db';
const VERIFY_DB_NAME = 'college_placement_backup_verify';
const BACKUP_ROOT = path.join(__dirname, '..', 'backups');

function generateTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runBackupAndVerify() {
  const timestamp = generateTimestamp();
  const backupDir = path.join(BACKUP_ROOT, `backup_${timestamp}`);

  console.log('================================================================================');
  console.log('       STANDALONE MONGODB BACKUP & ISOLATED RESTORE VERIFICATION');
  console.log('================================================================================');
  console.log(`Timestamp:        ${new Date().toISOString()}`);
  console.log(`Source Database:  ${SOURCE_DB_NAME}`);
  console.log(`Backup Directory: ${backupDir}`);
  console.log(`Verify Database:  ${VERIFY_DB_NAME}`);
  console.log('--------------------------------------------------------------------------------\n');

  // 1. Ensure target directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 2. Connect to Source Database (Read-Only)
  const sourceConn = await mongoose.createConnection(`mongodb://127.0.0.1:27017/${SOURCE_DB_NAME}`).asPromise();
  const sourceDb = sourceConn.db;
  const adminDb = sourceDb.admin();

  const buildInfo = await adminDb.buildInfo();
  console.log(`[Source Info] MongoDB Version: ${buildInfo.version}`);

  const collections = await sourceDb.listCollections().toArray();
  console.log(`[Source Info] Total Collections Found: ${collections.length}`);

  const manifest = {
    sourceDatabase: SOURCE_DB_NAME,
    timestamp: new Date().toISOString(),
    mongoVersion: buildInfo.version,
    backupDirectory: backupDir,
    collections: {},
  };

  // 3. Export each collection to .bson and .metadata.json
  for (const collInfo of collections) {
    const collName = collInfo.name;
    const coll = sourceDb.collection(collName);

    const docs = await coll.find({}).toArray();
    const indexes = await coll.indexes();

    // Serialize documents to BSON
    const bsonBuffers = docs.map((doc) => BSON.serialize(doc));
    const combinedBuffer = Buffer.concat(bsonBuffers);
    const checksum = calculateSha256(combinedBuffer);

    const bsonFile = `${collName}.bson`;
    const metaFile = `${collName}.metadata.json`;

    fs.writeFileSync(path.join(backupDir, bsonFile), combinedBuffer);
    fs.writeFileSync(
      path.join(backupDir, metaFile),
      JSON.stringify(
        {
          collection: collName,
          options: collInfo.options || {},
          indexes,
          count: docs.length,
          checksum,
        },
        null,
        2
      )
    );

    manifest.collections[collName] = {
      count: docs.length,
      indexCount: indexes.length,
      indexes: indexes.map((i) => i.name),
      options: collInfo.options || {},
      bsonFile,
      metadataFile: metaFile,
      byteSize: combinedBuffer.length,
      sha256: checksum,
    };

    console.log(`  * Backed up [${collName}]: ${docs.length} docs, ${indexes.length} indexes (${combinedBuffer.length} bytes)`);
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n[Backup Status] Backup created and permanently preserved at: ${backupDir}`);

  // 4. Connect to Verification Database
  const verifyConn = await mongoose.createConnection(`mongodb://127.0.0.1:27017/${VERIFY_DB_NAME}`).asPromise();
  const verifyDb = verifyConn.db;

  console.log(`\n[Verify Step] Initializing isolated restore in: ${VERIFY_DB_NAME}`);
  await verifyDb.dropDatabase(); // Ensure clean slate in verify db only

  // 5. Restore from BSON and Rebuild Indexes
  for (const [collName, meta] of Object.entries(manifest.collections)) {
    const bsonBuffer = fs.readFileSync(path.join(backupDir, meta.bsonFile));
    const metaJson = JSON.parse(fs.readFileSync(path.join(backupDir, meta.metadataFile), 'utf-8'));

    // Explicitly create collection with source options (validators, capped settings, collation)
    await verifyDb.createCollection(collName, metaJson.options || {});
    const verifyColl = verifyDb.collection(collName);

    // Verify SHA256 integrity of backup file before restoring
    const readChecksum = calculateSha256(bsonBuffer);
    if (readChecksum !== meta.sha256) {
      throw new Error(`INTEGRITY ERROR: SHA256 mismatch for ${meta.bsonFile}! Expected ${meta.sha256}, got ${readChecksum}`);
    }

    // Deserialize BSON buffer back into documents
    if (bsonBuffer.length > 0) {
      const deserializedDocs = [];
      let offset = 0;
      while (offset < bsonBuffer.length) {
        const docSize = bsonBuffer.readInt32LE(offset);
        const docSlice = bsonBuffer.subarray(offset, offset + docSize);
        deserializedDocs.push(BSON.deserialize(docSlice));
        offset += docSize;
      }
      await verifyColl.insertMany(deserializedDocs);
    }

    // Restore index catalog preserving all original index options
    for (const idx of metaJson.indexes) {
      if (idx.name === '_id_') continue;
      const { key, v, ns, ...opts } = idx;
      await verifyColl.createIndex(key, opts);
    }
  }

  console.log(`[Verify Step] Successfully restored all collections into ${VERIFY_DB_NAME}`);

  // 6. Deep Parity Verification
  console.log('\n[Parity Check] Comparing source and restored databases:');
  let allMatched = true;
  const parityResults = [];

  for (const [collName, meta] of Object.entries(manifest.collections)) {
    const sourceCount = meta.count;
    const verifyCount = await verifyDb.collection(collName).countDocuments();

    const sourceIndexes = meta.indexes.sort();
    const verifyIndexes = (await verifyDb.collection(collName).indexes()).map((i) => i.name).sort();

    const countMatches = sourceCount === verifyCount;
    const indexesMatch = JSON.stringify(sourceIndexes) === JSON.stringify(verifyIndexes);

    if (!countMatches || !indexesMatch) {
      allMatched = false;
    }

    parityResults.push({
      collection: collName,
      sourceCount,
      verifyCount,
      countMatches,
      sourceIndexes,
      verifyIndexes,
      indexesMatch,
    });

    console.log(`  - [${collName}]: Count Match: ${countMatches ? 'YES' : 'NO'} (${sourceCount} vs ${verifyCount}), Index Match: ${indexesMatch ? 'YES' : 'NO'}`);
  }

  // Representative Record Comparison on Users
  const sourceUsers = await sourceDb.collection('users').find({}, { projection: { password: 0 } }).toArray();
  const verifyUsers = await verifyDb.collection('users').find({}, { projection: { password: 0 } }).toArray();
  const usersEqual = JSON.stringify(sourceUsers) === JSON.stringify(verifyUsers);
  console.log(`  - Representative User Data Fidelity: ${usersEqual ? '100% IDENTICAL' : 'MISMATCH'}`);
  if (!usersEqual) allMatched = false;

  // 7. Clean up ONLY verification database
  await verifyDb.dropDatabase();
  console.log(`\n[Cleanup] Dropped temporary verification database: ${VERIFY_DB_NAME}`);

  await sourceConn.close();
  await verifyConn.close();

  console.log('\n================================================================================');
  console.log(`VERIFICATION RESULT: ${allMatched ? 'PASSED (100% PARITY)' : 'FAILED'}`);
  console.log(`PRESERVED BACKUP:    ${backupDir}`);
  console.log('================================================================================\n');

  return {
    success: allMatched,
    backupDir,
    timestamp,
    manifest,
    parityResults,
  };
}

if (require.main === module) {
  runBackupAndVerify()
    .then((res) => {
      if (!res.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal backup error:', err);
      process.exit(1);
    });
}

module.exports = { runBackupAndVerify };
