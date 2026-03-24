const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, lowercase: true, trim: true },
        otp: { type: String, required: true },
        purpose: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        verified: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 }
    },
    { timestamps: true }
);

// Auto-delete document when it expires (standard MongoDB TTL)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('Otp', otpSchema);
