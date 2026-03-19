const bcrypt = require('bcryptjs');
const env = require('../config/env');

/**
 * Validates password strength.
 * Rules:
 *   - At least 8 characters
 *   - At least one uppercase letter
 *   - At least one digit
 *
 * @param {string} password
 * @returns {string|null} Error message string, or null if valid
 */
function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

/**
 * Hashes a plaintext password using bcrypt.
 * Salt rounds are configurable via BCRYPT_SALT_ROUNDS env var (default: 12).
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 * @param {string} password  - Plaintext input
 * @param {string} hash      - Stored bcrypt hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, comparePassword, validatePasswordStrength };
