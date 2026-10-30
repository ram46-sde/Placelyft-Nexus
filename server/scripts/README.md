# Migration Scripts & Tools

## Milestone 2D: Read-Only Multi-Tenant Migration Analyzer

[`migrateMilestone2.js`](./migrateMilestone2.js) is a non-mutating database inspection tool designed to assess data integrity and multi-tenant normalization requirements prior to schema migrations and index cutovers.

### Strict Safety Guarantees

1. **Strictly Read-Only**: Performs zero inserts, updates, deletes, index creations, or collection drops.
2. **Explicit Target Required**: Refuses to run without an explicitly provided target (`--target-db` or `--target-uri`). Never falls back to a default `MONGO_URI`.
3. **Execution Flags Disabled**: Any mutation flag (e.g. `--apply`, `--execute`, `--fix`, `--migrate`, `--write`) causes immediate fatal termination.
4. **Auto-Create & Auto-Index Disabled**: Uses `mongoose.set('autoCreate', false)` and `mongoose.set('autoIndex', false)` to prevent Mongoose from creating collections or secondary indexes during inspection.
5. **Data Privacy & Anonymization**: Never outputs passwords, JWT tokens, student emails, or identifiable student information. All ObjectIds are masked.

### CLI Usage

```bash
# Analyze local development database
node server/scripts/migrateMilestone2.js --target-db=college_placement_db

# Analyze isolated test database
node server/scripts/migrateMilestone2.js --target-db=college_placement_test_db

# Custom URI (must specify database name)
node server/scripts/migrateMilestone2.js --target-uri=mongodb://127.0.0.1:27017/college_placement_db
```

### Analysis Scope

- **Users**: Identifies missing, invalid, or unverified college associations; flags legacy users tied to `Default Institution` pending administrative onboarding.
- **Student Profiles**: Identifies orphaned profiles, pending college inheritance, and user-profile tenant mismatches.
- **Placement Drives**: Flags missing or invalid college references.
- **Drive Applications**: Identifies orphaned student/drive references and cross-tenant application anomalies.
- **Departments**: Maps unambiguous legacy department strings to standard department suggestions while preserving legacy strings. Identifies ambiguous strings requiring manual review.
- **Roll Numbers**: Scans for same-college duplicate roll numbers (integrity blockers) and cross-college duplicates.
- **Index Readiness**: Audits all collection indexes, verifies proposed index filters (confirming no disallowed `$ne` operators), and audits legacy sparse non-unique index (`studentprofiles.rollNumber_1`).

## Milestone 2G.1: Standalone Backup & Isolated Verification Tool

[`backupAndVerify.js`](./backupAndVerify.js) is a standalone-safe backup and verification tool that exports raw BSON documents and index catalog metadata without relying on unbundled CLI tools (`mongodump`).

### Key Features
1. **Canonical BSON Serialization**: Uses official driver `BSON.serialize` to preserve ObjectIds, Dates, and full BSON type fidelity.
2. **SHA256 Integrity Checksums**: Calculates and verifies SHA256 hashes for all exported `.bson` collection archives.
3. **Isolated Test Restore**: Restores into a dedicated verification database (`college_placement_backup_verify`) and verifies 100% count, index, and record parity.
4. **Permanent Preservation**: Preserves verified timestamped backups in `server/backups/backup_<YYYYMMDD_HHMMSS>` for rollback and disaster recovery.
5. **Zero Mutation Invariant**: Source database (`college_placement_db`) is opened in strictly read-only mode and is never modified.

### CLI Usage
```bash
node server/scripts/backupAndVerify.js
```

## Milestone 2G.3.1: Isolated Recovery & Restoration Tool

[`restoreToRecoveryDb.js`](./restoreToRecoveryDb.js) restores a verified BSON backup into an isolated recovery database (`college_placement_recovery`) to validate disaster recovery readiness and allow catalog auditing without touching live databases.

### Strict Safety Guarantees

1. **Forbidden Targets Refusal**: Refuses to run if the target database is `college_placement_db`, `admin`, `local`, `config`, or any production name. Exits with fatal error code 1.
2. **Pre-Restore Checksum Verification**: Recomputes SHA256 hashes of all `.bson` files in the backup directory and validates them against `manifest.json` before opening a database write connection.
3. **Namespace & Index Options Fidelity**: Rebuilds collection namespaces with original options (validators, capped settings) and restores indexes with complete collations and partial filter expressions.
4. **Post-Restore Integrity Audit**: Validates document counts, index lists, and representative BSON types (`ObjectId`, `Date`) against the source backup manifest.
5. **No Blind Live Writes**: Never writes to or overwrites `college_placement_db`.

### CLI Usage

```bash
# Execute isolated recovery into college_placement_recovery
node server/scripts/restoreToRecoveryDb.js --target-db=college_placement_recovery

# Execute isolated recovery test with automatic cleanup
node server/scripts/restoreToRecoveryDb.js --target-db=college_placement_recovery --cleanup

# Specify a custom verified backup directory
node server/scripts/restoreToRecoveryDb.js --target-db=college_placement_recovery --backup-dir=server/backups/backup_20261015_112042
```

## Milestone 2G.3.2: Staged Index Cutover, Safe Rollback & Crash Cleanup Runbook

### 1. Legacy Index Preconditions (`studentprofiles.rollNumber_1`)
- **Actual Catalog State**: In `college_placement_db`, the legacy index is `{ rollNumber: 1 }`, named `rollNumber_1`, with `sparse: true` and `unique: false` (non-unique).
- **Application-Level Independence**: Application-level uniqueness checks (controller pre-checks and Mongoose validation hooks) operate independently of this database index and are verified separately via the automated test suite.
- **Maintenance Pre-Check**: Before dropping in Operation 3, the live catalog must be inspected to verify `name === 'rollNumber_1'`, `key: { rollNumber: 1 }`, `sparse: true`, and `unique: false`.

### 2. Hardened Reusable Rollback Module (`safeRollback.js`)

[`safeRollback.js`](./safeRollback.js) provides programmatic and CLI rollback facilities with controlled error propagation (throwing `RollbackPreconditionError` instead of process termination) and guaranteed connection teardown via `finally` blocks.

#### Safety Checks Before Drop:
1. **Write-Pause Enforcement**: Scans port 5000; halts if the application server is active.
2. **Document-Integrity Guard**: Confirms `studentprofiles` count strictly matches the expected baseline (`0`). Halts if records exist.
3. **Complete Index Definition Verification**: Asserts that `collegeId_1_rollNumber_1` matches:
   - `key`: `{ collegeId: 1, rollNumber: 1 }`
   - `unique`: `true`
   - `collation`: `{ locale: 'en', strength: 2 }`
   - `partialFilterExpression`: `{ rollNumber: { $type: 'string', $gt: '' } }`
4. **Never Drops Unexpected Indexes**: If the index is absent, has divergent options, or preconditions fail, halts without dropping anything.

#### CLI Usage:
```bash
# Execute safe dry-run inspection of rollback preconditions
node server/scripts/safeRollback.js --target-db=college_placement_db --dry-run

# Execute verified rollback (guaranteed connection cleanup)
node server/scripts/safeRollback.js --target-db=college_placement_db
```

## Milestone 2: Operation 1 Index Creation Tool (`createRollNumberIndex.js`)

[`createRollNumberIndex.js`](./createRollNumberIndex.js) executes the mandatory 7-point preflight verification and creates the compound partial unique index `{ collegeId: 1, rollNumber: 1 }` on `studentprofiles`.

### Safety Guarantees:
1. **Mandatory 7-Point Preflight**: Validates target DB, verifies backup checksums, verifies port 5000 write-pause, checks document count and catalog, verifies 0 same-college duplicates, verifies college ownership, and checks engine compatibility before any mutation.
2. **Dry-Run by Default**: Runs in read-only preflight mode unless `--execute` is explicitly passed.
3. **Legacy Preservation**: Asserts that `rollNumber_1` remains unchanged in the catalog.
4. **Zero Record Mutations**: Makes zero insertions, updates, or deletions to user/student documents.

```bash
# Dry-run preflight check
node server/scripts/createRollNumberIndex.js --target-db=college_placement_db --dry-run

# Live index creation (preflight gated)
node server/scripts/createRollNumberIndex.js --target-db=college_placement_db --execute
```

## Milestone 2: Operation 2 Direct-Driver Smoke-Test Tool (`smokeTestOperation2.js`)

[`smokeTestOperation2.js`](./smokeTestOperation2.js) exercises the compound unique roll-number index using isolated synthetic records, unique `testRunId` tagging, and narrow, verified cleanup.

### Safety Guarantees:
1. **Explicit Target Required**: Rejects system/forbidden databases (`admin`, `local`, `config`, etc.).
2. **Main Database Protected**: Refuses to run against `college_placement_db` without explicit authorization flag (`--allow-live-target`).
3. **Dry-Run by Default**: Defaults to dry-run mode (zero writes). Requires `--execute` to insert test records.
4. **Unique Run ID**: Every execution generates a cryptographic timestamped identifier (`smoke_<timestamp>_<hex>`).
5. **Exact-Run Cleanup**: Deletes strictly by exact `testRunId` in a `finally` block. Never uses broad regex wipes.
6. **Integrity Enforcement & Leftover Reporting**: Asserts that collection count restores to baseline. If cleanup fails, captures and logs exact remaining document IDs.
7. **Zero Impact on Legitimate Records**: All operations use synthetic ObjectIds and never modify existing data.

```bash
# Dry-run inspection on test database
node server/scripts/smokeTestOperation2.js --target-db=college_placement_test_db --dry-run

# Live smoke-test execution on test database
node server/scripts/smokeTestOperation2.js --target-db=college_placement_test_db --execute
```

## Milestone 2: Operation 3 Legacy Index Drop Tool (`dropLegacyRollNumberIndex.js`)

[`dropLegacyRollNumberIndex.js`](./dropLegacyRollNumberIndex.js) safely drops the obsolete legacy index `rollNumber_1` from `studentprofiles` after rigorously confirming the health of replacement compound unique index `collegeId_1_rollNumber_1`.

### Safety Guarantees:
1. **Dry-Run by Default**: Defaults to read-only preflight mode. Requires explicit `--execute` flag to execute the drop.
2. **Explicit Target & Host Invariant**: Validates `--target-db` and rejects system/forbidden databases or remote MongoDB hosts.
3. **Write-Pause Enforcement**: Confirms application on port 5000 is inactive before proceeding.
4. **Replacement Index Precondition**: Asserts that `collegeId_1_rollNumber_1` is present and matches the complete 4-part specification.
5. **Legacy Index Precondition**: Asserts that `rollNumber_1` is present with `key: { rollNumber: 1 }`, `sparse: true`, and `unique: false`.
6. **Dynamic Baseline Capture**: Captures document counts dynamically across all collections; never hard-codes zero.
7. **Post-Drop Verification**: Asserts that `rollNumber_1` is absent, that `_id_`, `user_1`, and `collegeId_1_rollNumber_1` remain intact, and that all collection counts match baseline.

### CLI Usage:

```bash
# Safe dry-run inspection on live database (default mode - zero drops)
node server/scripts/dropLegacyRollNumberIndex.js --target-db=college_placement_db --dry-run

# Live drop execution on live database (explicitly gated)
node server/scripts/dropLegacyRollNumberIndex.js --target-db=college_placement_db --execute
```

### Expected Live Output:
```text
================================================================================
        OPERATION 3: LEGACY ROLL-NUMBER INDEX DROP UTILITY
================================================================================
Target Database: college_placement_db
Execution Mode:  LIVE DROP EXECUTION
Timestamp:       2026-10-20T...
--------------------------------------------------------------------------------

[Target Identity] Connected database verified: 'college_placement_db' on host '127.0.0.1'
[Baseline Capture] Recording dynamic document counts across all collections:
  - departments: 0 documents
  - companies: 0 documents
  - placementdrives: 0 documents
  - users: 2 documents
  - studentprofiles: 0 documents
  - colleges: 1 documents
  - driveapplications: 0 documents

[Preflight Catalog Audit] Verifying indexes on studentprofiles:
  √ Replacement index 'collegeId_1_rollNumber_1': PRESENT & VALID (EXACT_MATCH)
  √ Legacy target index 'rollNumber_1': PRESENT & VALID (sparse: true, unique: false)

[EXECUTION] Dropping index 'rollNumber_1'...
  Index 'rollNumber_1' successfully dropped via coll.dropIndex().

[POST-DROP INTEGRITY VERIFICATION]
  1. Legacy index 'rollNumber_1': ABSENT from catalog (VERIFIED)
  2. Replacement index 'collegeId_1_rollNumber_1': PRESENT & INTACT (VERIFIED)
  3. Core index 'user_1': PRESENT & INTACT (VERIFIED)
  4. Primary index '_id_': PRESENT & INTACT (VERIFIED)
  5. Verifying collection document count parity against baseline:
     - departments: 0 documents (baseline: 0) -> MATCH
     - companies: 0 documents (baseline: 0) -> MATCH
     - placementdrives: 0 documents (baseline: 0) -> MATCH
     - users: 2 documents (baseline: 2) -> MATCH
     - studentprofiles: 0 documents (baseline: 0) -> MATCH
     - colleges: 1 documents (baseline: 1) -> MATCH
     - driveapplications: 0 documents (baseline: 0) -> MATCH

================================================================================
OPERATION 3 SUCCESSFUL: Index 'rollNumber_1' dropped and catalog verified.
================================================================================
```

### Recovery & Re-creation Procedure (If Ever Required):
If authorized administrators ever explicitly decide to recreate the legacy index:
```javascript
db.studentprofiles.createIndex(
  { rollNumber: 1 },
  { name: "rollNumber_1", sparse: true, background: true }
);
```
> [!IMPORTANT]
> Recreating this legacy index is a separate, explicitly approved action. It should only be executed if an authorized change request specifically mandates restoring the legacy single-field index.



### 3. Narrow Manual Smoke-Test Cleanup
If a direct-driver smoke test crashes before self-cleanup:
1. Log and capture the exact `testRunId` assigned to the run (e.g. `smoke_1760512800000_a1b2c3d4`).
2. Query and inspect the matching documents before deletion:
   ```javascript
   db.studentprofiles.find({ testRunId: "smoke_1760512800000_a1b2c3d4" }).toArray();
   ```
3. Confirm that the documents are exclusively synthetic test records.
4. Delete strictly by the exact logged identifier:
   ```javascript
   db.studentprofiles.deleteMany({ testRunId: "smoke_1760512800000_a1b2c3d4" });
   ```
5. Confirm that the collection count returns to the pre-test baseline.
6. **Strict Prohibition**: Never delete records using a generic prefix regex like `/^smoke_/`, and never execute uninspected deletions.

### 4. Approved Staged Execution Sequence & Gates
1. **Preflight**: Verify write-pause (port 5000), verify baseline count (0), verify backup checksums.
2. **Operation 1**: Build compound partial unique index `{ collegeId: 1, rollNumber: 1 }` with collation `{ locale: 'en', strength: 2 }` and partial filter `{ rollNumber: { $type: 'string', $gt: '' } }`. Verify full index specification in catalog.
3. **Operation 2**: Execute direct-driver smoke test tagged with unique `testRunId`. Verify uniqueness and cross-college allowance. Inspect documents, delete by exact `testRunId`, and verify baseline count restoration.
4. **Operation 3**: Inspect legacy `rollNumber_1` in catalog (confirming `sparse: true`, `unique: false`). Drop `rollNumber_1` and verify catalog state.
5. **Approval Gate & Operation 4**: Execute full application regression test suite (`npm test`). Require explicit user approval before restarting the application server and resuming live traffic.

