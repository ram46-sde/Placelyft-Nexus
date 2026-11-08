/**
 * Script: createPlacementOutcomeIndexes.js
 * 
 * Creates recommended indexes for the PlacementOutcome collection:
 * 1. { application: 1 } (unique: true)
 * 2. { collegeId: 1, placementDrive: 1 }
 * 3. { collegeId: 1, student: 1 }
 * 4. { collegeId: 1, status: 1 }
 * 
 * WARNING: This script is prepared for manual administrator execution in target environments.
 * DO NOT execute against production or development environments without an approved maintenance window.
 * Without the unique index on { application: 1 }, duplicate-record protection under concurrency does not exist.
 * 
 * Usage:
 *   node server/scripts/createPlacementOutcomeIndexes.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const PlacementOutcome = require('../models/PlacementOutcome');

async function createPlacementOutcomeIndexes() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);

  try {
    console.log('Building indexes for PlacementOutcome collection...');
    await PlacementOutcome.createIndexes();
    console.log('Successfully created PlacementOutcome indexes:');
    const indexes = await PlacementOutcome.collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
  } catch (err) {
    console.error('Error creating indexes:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

if (require.main === module) {
  createPlacementOutcomeIndexes();
}

module.exports = { createPlacementOutcomeIndexes };
