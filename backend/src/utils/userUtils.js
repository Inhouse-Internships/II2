/**
 * Shared user utilities — deduplicated from authController and adminController.
 */

/**
 * Removes sensitive fields from a Mongoose user document before sending to client.
 * @param {Object} userDoc - Mongoose document or plain object
 * @returns {Object} Sanitized user object (no password)
 */
function sanitizeUser(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  delete user.tokenVersion; // never send tokenVersion to client
  return user;
}

/**
 * Escapes special regex characters in a string to prevent ReDoS / injection.
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes an email address: trims whitespace only.
 * Casing is preserved exactly as the user provides it.
 * @param {string} rawEmail
 * @returns {string}
 */
function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  return String(rawEmail).trim();
}

/**
 * Checks if an email uses a prohibited public domain.
 * Throws an AppError if prohibited.
 * @param {string} email
 */
function checkEmailProhibited(email) {
  if (!email) return;
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.endsWith('@gmail.com') || lowerEmail.endsWith('@outlook.com')) {
    const AppError = require('./appError'); // Local require to avoid circular dependency if any, but usually fine
    throw new AppError(400, 'Registration or login with @gmail.com or @outlook.com is strictly prohibited.');
  }
}

module.exports = { sanitizeUser, escapeRegex, normalizeEmail, checkEmailProhibited };
