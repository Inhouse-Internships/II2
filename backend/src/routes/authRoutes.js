const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authRateLimit = require('../middlewares/authRateLimit');

// Public — no auth required
router.get('/config', authController.getConfig);

// Brute-force sensitive — apply strict rate limit
router.post('/send-otp',        authRateLimit, authController.sendOtp);
router.post('/verify-otp',      authRateLimit, authController.verifyOtp);
router.post('/register',        authRateLimit, authController.register);
router.post('/login',           authRateLimit, authController.login);
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password',  authRateLimit, authController.resetPassword);

module.exports = router;
