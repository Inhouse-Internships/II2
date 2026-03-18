/**
 * OTP Service — in-memory store with the following hardening additions:
 *
 * Changes from original:
 * 1. Added per-OTP attempt counter — after 5 failed verifications, the OTP
 *    is invalidated and must be re-requested. Prevents 6-digit brute force.
 * 2. `MAX_ATTEMPTS` constant for easy configuration.
 *
 * NOTE: This store is in-process memory. For multi-instance deployments,
 * replace Map with Redis: `SET key value EX ttlSeconds NX`
 */

const crypto = require('crypto');

const MAX_ATTEMPTS = 5;
const otpStore = new Map();

function buildKey(purpose, email) {
  return `${purpose}:${String(email).toLowerCase()}`;
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Issues a new OTP for the given email + purpose.
 * Overwrites any existing pending OTP for the same key.
 */
function issueOtp({ email, purpose, ttlMinutes }) {
  const key = buildKey(purpose, email);
  const otp = generateOtp();
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

  otpStore.set(key, {
    otp,
    purpose,
    email: String(email).toLowerCase(),
    expiresAt,
    verified: false,
    attempts: 0        // FIX QA-1: track failed attempt count
  });

  return otp;
}

/**
 * Verifies an OTP (marks it as verified but does NOT consume/delete it).
 * Used in the two-step registration flow: verifyOtp → then register with consumeOtp.
 */
function verifyOtp({ email, purpose, otp }) {
  const key = buildKey(purpose, email);
  const entry = otpStore.get(key);

  if (!entry) return { valid: false, reason: 'OTP not found or already used' };
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(key);
    return { valid: false, reason: 'OTP expired' };
  }

  // FIX QA-1: Enforce attempt limit
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, reason: 'Too many invalid attempts. Please request a new OTP.' };
  }

  if (entry.otp !== String(otp)) {
    entry.attempts += 1;
    otpStore.set(key, entry);
    const remaining = MAX_ATTEMPTS - entry.attempts;
    return {
      valid: false,
      reason: remaining > 0
        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many invalid attempts. Please request a new OTP.'
    };
  }

  entry.verified = true;
  entry.attempts = 0;
  otpStore.set(key, entry);
  return { valid: true };
}

/**
 * Verifies AND consumes (deletes) an OTP.
 * Used for final submission: password reset, registration completion.
 */
function consumeOtp({ email, purpose, otp, requireVerified = false }) {
  const key = buildKey(purpose, email);
  const entry = otpStore.get(key);

  if (!entry) return { valid: false, reason: 'OTP not found or already used' };
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(key);
    return { valid: false, reason: 'OTP expired' };
  }

  // FIX QA-1: Enforce attempt limit
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, reason: 'Too many invalid attempts. Please request a new OTP.' };
  }

  if (entry.otp !== String(otp)) {
    entry.attempts += 1;
    otpStore.set(key, entry);
    const remaining = MAX_ATTEMPTS - entry.attempts;
    return {
      valid: false,
      reason: remaining > 0
        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many invalid attempts. Please request a new OTP.'
    };
  }

  if (requireVerified && !entry.verified) {
    return { valid: false, reason: 'OTP has not been verified yet' };
  }

  otpStore.delete(key); // consume — one-time use
  return { valid: true };
}

// Periodic cleanup of expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 60 * 1000).unref();

module.exports = { issueOtp, verifyOtp, consumeOtp };
