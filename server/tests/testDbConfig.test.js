const {
  DEFAULT_TEST_MONGO_URI,
  FORBIDDEN_DB_NAMES,
  extractDatabaseName,
  validateTestDbName,
  validateTestConnectionConfig,
  getApprovedTestUri,
} = require('./testDb');

describe('Test Database Configuration & Security Guardrails', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('extractDatabaseName (URI Parsing)', () => {
    it('should extract database name cleanly from standard MongoDB URI', () => {
      const db = extractDatabaseName('mongodb://127.0.0.1:27017/college_placement_test_db');
      expect(db).toBe('college_placement_test_db');
    });

    it('should extract database name without query parameters', () => {
      const db = extractDatabaseName(
        'mongodb://test_user:pass@127.0.0.1:27017/placement_test_db?authSource=admin&retryWrites=true'
      );
      expect(db).toBe('placement_test_db');
    });

    it('should support mongodb+srv protocol', () => {
      const db = extractDatabaseName(
        'mongodb+srv://user:pass@cluster.mongodb.net/cloud_test_db?retryWrites=true'
      );
      expect(db).toBe('cloud_test_db');
    });

    it('should throw when protocol is not mongodb or mongodb+srv', () => {
      expect(() => extractDatabaseName('http://localhost:27017/test_db')).toThrow(
        /Invalid protocol 'http:'/
      );
      expect(() => extractDatabaseName('postgres://localhost:5432/test_db')).toThrow(
        /Invalid protocol 'postgres:'/
      );
    });

    it('should throw when URI has no database name', () => {
      expect(() => extractDatabaseName('mongodb://127.0.0.1:27017')).toThrow(
        /URI does not specify a database name/
      );
      expect(() => extractDatabaseName('mongodb://127.0.0.1:27017/')).toThrow(
        /URI does not specify a database name/
      );
      expect(() => extractDatabaseName('mongodb://127.0.0.1:27017/?authSource=test')).toThrow(
        /URI does not specify a database name/
      );
    });

    it('should throw when URI is null, undefined, or empty', () => {
      expect(() => extractDatabaseName('')).toThrow(/must be a non-empty string/);
      expect(() => extractDatabaseName(null)).toThrow(/must be a non-empty string/);
      expect(() => extractDatabaseName(undefined)).toThrow(/must be a non-empty string/);
    });
  });

  describe('validateTestDbName (Database Name Validation)', () => {
    it('should accept approved database names ending with _test or _test_db', () => {
      expect(validateTestDbName('college_placement_test_db')).toBe('college_placement_test_db');
      expect(validateTestDbName('cpms_unit_test')).toBe('cpms_unit_test');
      expect(validateTestDbName('integration_test_db')).toBe('integration_test_db');
    });

    it('should reject development database (college_placement_db)', () => {
      expect(() => validateTestDbName('college_placement_db')).toThrow(
        /Refusing connection to protected\/non-test database: 'college_placement_db'/
      );
    });

    it('should reject protected system and production database names', () => {
      FORBIDDEN_DB_NAMES.forEach((name) => {
        expect(() => validateTestDbName(name)).toThrow(
          /Refusing connection to protected\/non-test database/
        );
      });
    });

    it('should reject database names not adhering to the test suffix pattern', () => {
      expect(() => validateTestDbName('my_custom_db')).toThrow(
        /does not match approved test naming pattern/
      );
      expect(() => validateTestDbName('college_placement_staging')).toThrow(
        /does not match approved test naming pattern/
      );
      expect(() => validateTestDbName('test_without_suffix')).toThrow(
        /does not match approved test naming pattern/
      );
    });
  });

  describe('validateTestConnectionConfig (Combined Guardrail)', () => {
    it('should accept valid, approved test connection URIs', () => {
      const validUris = [
        'mongodb://127.0.0.1:27017/college_placement_test_db',
        'mongodb://localhost:27017/suite_test',
        'mongodb+srv://admin:pass@cluster0.net/analytics_test_db?retryWrites=true',
      ];

      validUris.forEach((uri) => {
        const result = validateTestConnectionConfig(uri);
        expect(result.uri).toBe(uri);
        expect(result.dbName).toBeDefined();
      });
    });

    it('should reject development database even if query parameter contains "test"', () => {
      // Misleading URI: query param authSource=test
      const misleadingUri = 'mongodb://127.0.0.1:27017/college_placement_db?authSource=test';
      expect(() => validateTestConnectionConfig(misleadingUri)).toThrow(
        /Refusing connection to protected\/non-test database: 'college_placement_db'/
      );
    });

    it('should reject production database even if username contains "test"', () => {
      // Misleading URI: username is test_admin
      const misleadingUri = 'mongodb://test_admin:pass@remote-cluster:27017/production_db';
      expect(() => validateTestConnectionConfig(misleadingUri)).toThrow(
        /does not match approved test naming pattern/
      );
    });
  });

  describe('getApprovedTestUri (Environment Resolution & Dev Fallback Prevention)', () => {
    it('should default strictly to DEFAULT_TEST_MONGO_URI when MONGO_URI_TEST is unset', () => {
      delete process.env.MONGO_URI_TEST;
      process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/college_placement_db'; // Dev URI present

      const uri = getApprovedTestUri();
      expect(uri).toBe(DEFAULT_TEST_MONGO_URI);
      expect(uri).not.toBe(process.env.MONGO_URI);
      expect(uri).toContain('college_placement_test_db');
    });

    it('should use and validate custom MONGO_URI_TEST when specified', () => {
      process.env.MONGO_URI_TEST = 'mongodb://127.0.0.1:27017/custom_ci_test_db';
      const uri = getApprovedTestUri();
      expect(uri).toBe('mongodb://127.0.0.1:27017/custom_ci_test_db');
    });

    it('should throw immediately if MONGO_URI_TEST is set to development database', () => {
      process.env.MONGO_URI_TEST = 'mongodb://127.0.0.1:27017/college_placement_db';
      expect(() => getApprovedTestUri()).toThrow(
        /Refusing connection to protected\/non-test database: 'college_placement_db'/
      );
    });

    it('should never fall back to MONGO_URI when MONGO_URI_TEST is empty whitespace', () => {
      process.env.MONGO_URI_TEST = '   ';
      process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/college_placement_db';

      const uri = getApprovedTestUri();
      expect(uri).toBe(DEFAULT_TEST_MONGO_URI);
      expect(uri).not.toBe(process.env.MONGO_URI);
    });
  });
});
