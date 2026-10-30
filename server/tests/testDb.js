const mongoose = require('mongoose');

// Default approved test database URI
const DEFAULT_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/college_placement_test_db';

// Disallowed database names that must never be connected to or cleared during tests
const FORBIDDEN_DB_NAMES = [
  'college_placement_db',
  'admin',
  'local',
  'config',
  'production',
  'prod',
  'staging',
  'development',
  'dev',
];

/**
 * Parses a MongoDB connection string and extracts the target database name.
 * @param {string} uri
 * @returns {string} The extracted database name
 */
const extractDatabaseName = (uri) => {
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    throw new Error('Test configuration error: MongoDB connection URI must be a non-empty string.');
  }

  let parsed;
  try {
    parsed = new URL(uri.trim());
  } catch (err) {
    throw new Error(`Test configuration error: Invalid MongoDB URI format: ${err.message}`);
  }

  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error(
      `Test configuration error: Invalid protocol '${parsed.protocol}'. Expected 'mongodb:' or 'mongodb+srv:'.`
    );
  }

  // Extract pathname and remove leading slashes
  const rawPath = parsed.pathname ? parsed.pathname.replace(/^\/+/, '') : '';
  const dbName = rawPath.split('/')[0].split('?')[0].trim();

  if (!dbName) {
    throw new Error('Test configuration error: URI does not specify a database name.');
  }

  return dbName;
};

/**
 * Validates that a database name conforms strictly to approved test database naming rules.
 * Rejects dev, prod, system, or unexpected database names.
 * @param {string} dbName
 * @returns {string} The validated database name
 */
const validateTestDbName = (dbName) => {
  if (!dbName || typeof dbName !== 'string' || dbName.trim().length === 0) {
    throw new Error('Test configuration error: Database name must be a non-empty string.');
  }

  const normalized = dbName.toLowerCase().trim();

  // 1. Must not match forbidden database names
  if (FORBIDDEN_DB_NAMES.includes(normalized)) {
    throw new Error(
      `Safety guard violation: Refusing connection to protected/non-test database: '${dbName}'.`
    );
  }

  // 2. Must strictly match test naming convention (*_test or *_test_db)
  const isApprovedTestPattern = /^[a-zA-Z0-9_-]+_test(_db)?$/i.test(normalized);
  if (!isApprovedTestPattern) {
    throw new Error(
      `Safety guard violation: Database '${dbName}' does not match approved test naming pattern (*_test or *_test_db).`
    );
  }

  return dbName;
};

/**
 * Validates an entire test connection URI without opening any connection.
 * @param {string} uri
 * @returns {{ uri: string, dbName: string }}
 */
const validateTestConnectionConfig = (uri) => {
  const dbName = extractDatabaseName(uri);
  validateTestDbName(dbName);
  return { uri, dbName };
};

/**
 * Resolves the approved test URI from process.env.MONGO_URI_TEST,
 * NEVER falling back to process.env.MONGO_URI.
 * @returns {string} Validated test URI
 */
const getApprovedTestUri = () => {
  // Explicitly NEVER fall back to MONGO_URI
  const configuredUri = process.env.MONGO_URI_TEST;

  if (configuredUri && configuredUri.trim().length > 0) {
    validateTestConnectionConfig(configuredUri);
    return configuredUri.trim();
  }

  // Default strictly to the dedicated local test database
  validateTestConnectionConfig(DEFAULT_TEST_MONGO_URI);
  return DEFAULT_TEST_MONGO_URI;
};

/**
 * Connects to the isolated test database.
 * Strictly asserts database name before and after connection.
 */
const connectTestDb = async () => {
  const testUri = getApprovedTestUri();
  const { dbName: expectedDbName } = validateTestConnectionConfig(testUri);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testUri);
  }

  // Post-connection safety assertion: verify driver's actual connected database name
  const actualDbName = mongoose.connection.name;
  validateTestDbName(actualDbName);

  if (actualDbName.toLowerCase() !== expectedDbName.toLowerCase()) {
    throw new Error(
      `Safety guard violation: Connected database name '${actualDbName}' does not match expected test database '${expectedDbName}'.`
    );
  }
};

/**
 * Clears all documents from test collections between test suites.
 */
const clearTestDb = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  const actualDbName = mongoose.connection.name;
  validateTestDbName(actualDbName);

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Drops the test database and closes the Mongoose connection.
 */
const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    const actualDbName = mongoose.connection.name;
    validateTestDbName(actualDbName);

    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  }
};

module.exports = {
  DEFAULT_TEST_MONGO_URI,
  FORBIDDEN_DB_NAMES,
  extractDatabaseName,
  validateTestDbName,
  validateTestConnectionConfig,
  getApprovedTestUri,
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
};
