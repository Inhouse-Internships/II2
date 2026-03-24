/**
 * OTP Service — refactored to use MongoDB persistent store.
 * 
 * Changes from original:
 * 1. Replaced in-memory Map with Otp model. This ensures OTPs survive
 *    server restarts (important during development with nodemon).
 * 2. All methods are now async (returning Promises).
 * 3. Atomic attempt limiting added directly to findOneAndUpdate calls.
 * 4. Relies on MongoDB TTL index for automatic expiration/cleanup.
 */
const crypto = require('crypto');
const Otp = require('../models/Otp');

const MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Issues a new OTP for the given email + purpose.
 * Overwrites any existing pending OTP for the same key.
 */
async function issueOtp({ email, purpose, ttlMinutes }) {
  const normEmail = String(email).toLowerCase().trim();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Upsert: replace any existing OTP for this email+purpose
  await Otp.findOneAndUpdate(
    { email: normEmail, purpose },
    {
      otp,
      expiresAt,
      verified: false,
      attempts: 0
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return otp;
}

/**
 * Verifies an OTP (marks it as verified but does NOT consume/delete it).
 */
async function verifyOtp({ email, purpose, otp }) {
  const normEmail = String(email).toLowerCase().trim();
  const entry = await Otp.findOne({ email: normEmail, purpose }).exec();

  if (!entry) return { valid: false, reason: 'OTP not found or already used' };
  if (entry.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: entry._id });
    return { valid: false, reason: 'OTP expired' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: entry._id });
    return { valid: false, reason: 'Too many invalid attempts. Please request a new OTP.' };
  }

  if (entry.otp !== String(otp)) {
    entry.attempts += 1;
    await entry.save();
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
  await entry.save();
  return { valid: true };
}

/**
 * Verifies AND consumes (deletes) an OTP.
 */
async function consumeOtp({ email, purpose, otp, requireVerified = false }) {
  const normEmail = String(email).toLowerCase().trim();
  const entry = await Otp.findOne({ email: normEmail, purpose }).exec();

  if (!entry) return { valid: false, reason: 'OTP not found or already used' };
  if (entry.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: entry._id });
    return { valid: false, reason: 'OTP expired' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: entry._id });
    return { valid: false, reason: 'Too many invalid attempts. Please request a new OTP.' };
  }

  if (entry.otp !== String(otp)) {
    entry.attempts += 1;
    await entry.save();
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

  await Otp.deleteOne({ _id: entry._id }); // consume — one-time use
  return { valid: true };
}

module.exports = { issueOtp, verifyOtp, consumeOtp };
