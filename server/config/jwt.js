/**
 * JWT Configuration Helper
 * Enforces strict environment variable validation for JWT secrets.
 * Fails fast if JWT_SECRET is missing, shorter than 32 characters,
 * or if a development/placeholder secret is supplied in production.
 *
 * NOTE: Never prints or logs actual secret values.
 */

const MIN_SECRET_LENGTH = 32;

const KNOWN_DEV_SECRETS = [
  'cpms_secure_jwt_secret_key_2026_dev',
  'cpms_default_secret_key',
];

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('Fatal Security Misconfiguration: JWT_SECRET environment variable is missing.');
  }

  // Production environment enforcement:
  // Strictly prevent development or placeholder secrets from being used in production.
  if (process.env.NODE_ENV === 'production') {
    const isKnownDevSecret = KNOWN_DEV_SECRETS.includes(secret.trim());
    const hasDevPattern = /(^|_)dev(_|$)|example|placeholder|default/i.test(secret);

    if (isKnownDevSecret || hasDevPattern) {
      throw new Error(
        'Fatal Security Misconfiguration: Development or placeholder JWT_SECRET cannot be used in production. A cryptographically random secret of at least 32 characters is required.'
      );
    }
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Fatal Security Misconfiguration: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long (current length: ${secret.length}).`
    );
  }

  return secret;
};

module.exports = {
  MIN_SECRET_LENGTH,
  KNOWN_DEV_SECRETS,
  getJwtSecret,
};
