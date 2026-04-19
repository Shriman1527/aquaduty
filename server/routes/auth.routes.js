const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();

const authController = require('../controllers/auth.controller');
const { protect }    = require('../middleware/auth');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../middleware/validation');

// ─── Strict rate limiter for sensitive auth routes ────────────────────────────
// Max 10 attempts per 15 minutes per IP
// Prevents brute force attacks on login, register, and password reset
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again in 15 minutes.',
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Public routes — no login needed
// ─────────────────────────────────────────────────────
// Register a new account
router.post(
  '/register',
  authLimiter,
  registerValidator,
  authController.register
);

// Log in
router.post(
  '/login',
  authLimiter,
  loginValidator,
  authController.login
);

// Verify email via link (token comes in query string)
// e.g. GET /api/auth/verify-email?token=abc123
router.get(
  '/verify-email',
  authController.verifyEmail
);

// Resend verification email
router.post(
  '/resend-verification',
  authLimiter,
  authController.resendVerification
);

// Forgot password — sends reset link to email
router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidator,
  authController.forgotPassword
);

// Reset password using token from email
router.post(
  '/reset-password',
  authLimiter,
  resetPasswordValidator,
  authController.resetPassword
);

// Refresh access token using httpOnly cookie
// No auth middleware needed — cookie is read directly
router.post(
  '/refresh-token',
  authController.refreshToken
);

// ─────────────────────────────────────────────────────
// Private routes — login required
// ─────────────────────────────────────────────────────

// Logout current session
router.post(
  '/logout',
  protect,
  authController.logout
);

// Toggle vacation mode
router.patch(
  '/vacation',
  protect,
  authController.toggleVacationMode
);
// Get currently logged-in user's data
router.get(
  '/me',
  protect,
  authController.getMe
);

module.exports = router;