const jwt = require('jsonwebtoken');
const { getJwtSecret, MIN_SECRET_LENGTH, KNOWN_DEV_SECRETS } = require('../config/jwt');
const generateToken = require('../utils/generateToken');

describe('JWT Configuration & Token Security', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const VALID_TEST_SECRET = 'a_very_secure_test_secret_key_that_is_at_least_32_chars!';
  const VALID_PROD_SECRET = 'd4c1a7e93f82b6105c38e9a2f741d08c5e62b1a9f0743c8d1e2b5a7c9f03e1a6';

  afterEach(() => {
    // Restore original environment
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Configuration Validation (getJwtSecret)', () => {
    it('should throw an error when JWT_SECRET is undefined', () => {
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is missing');
    });

    it('should throw an error when JWT_SECRET is an empty string', () => {
      process.env.JWT_SECRET = '   ';
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is missing');
    });

    it('should throw an error when JWT_SECRET is shorter than 32 characters', () => {
      process.env.JWT_SECRET = 'short_secret_under_32_chars';
      expect(() => getJwtSecret()).toThrow(`at least ${MIN_SECRET_LENGTH} characters long`);
    });

    it('should return the secret when it has at least 32 characters in test/development', () => {
      process.env.JWT_SECRET = VALID_TEST_SECRET;
      expect(getJwtSecret()).toBe(VALID_TEST_SECRET);
    });

    it('should never expose secret values in the thrown error message', () => {
      process.env.JWT_SECRET = 'secret_xyz_too_short';
      try {
        getJwtSecret();
      } catch (err) {
        expect(err.message).not.toContain('secret_xyz_too_short');
        expect(err.message).toContain('current length: 20');
      }
    });
  });

  describe('Production Environment Protections (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should reject known development secret in production', () => {
      KNOWN_DEV_SECRETS.forEach((devSecret) => {
        process.env.JWT_SECRET = devSecret;
        expect(() => getJwtSecret()).toThrow(
          /Development or placeholder JWT_SECRET cannot be used in production/
        );
      });
    });

    it('should reject placeholder/dev pattern secret in production', () => {
      process.env.JWT_SECRET = 'my_super_long_custom_dev_secret_key_for_testing!';
      expect(() => getJwtSecret()).toThrow(
        /Development or placeholder JWT_SECRET cannot be used in production/
      );
    });

    it('should accept cryptographically random secret in production', () => {
      process.env.JWT_SECRET = VALID_PROD_SECRET;
      expect(getJwtSecret()).toBe(VALID_PROD_SECRET);
    });
  });

  describe('Token Generation & Verification', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = VALID_TEST_SECRET;
    });

    it('should generate a valid signed token containing userId and role', () => {
      const userId = '64b1f2e34567890abcdef123';
      const role = 'student';

      const token = generateToken(userId, role);
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, VALID_TEST_SECRET);
      expect(decoded.id).toBe(userId);
      expect(decoded.role).toBe(role);
    });

    it('should reject tokens signed with a different or forged secret', () => {
      const forgedSecret = 'another_forged_secret_key_at_least_32_chars_long!';
      const forgedToken = jwt.sign({ id: '123', role: 'student' }, forgedSecret);

      expect(() => {
        jwt.verify(forgedToken, VALID_TEST_SECRET);
      }).toThrow('invalid signature');
    });
  });
});
