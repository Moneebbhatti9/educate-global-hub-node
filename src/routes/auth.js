const express = require("express");
const rateLimit = require("express-rate-limit");
const { validate } = require("../middleware/validation");
const { authenticateToken } = require("../middleware/auth");
const {
  signup,
  login,
  verify2FALogin,
  sendOTP,
  verifyOTPController,
  passwordReset,
  passwordResetConfirm,
  refresh,
  logout,
  logoutAllDevices,
  getCurrentUser,
  changePassword,
  checkUserStatus,
  completeProfile,
  getActiveSessionsController,
  terminateSession,
  terminateOtherSessions,
} = require("../controllers/authController");

const router = express.Router();

// Rate limiting for sensitive auth endpoints (login, signup, password reset)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 OTP requests per 5 minutes
  message: {
    success: false,
    message: "Too many OTP requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/v1/auth/signup
// @desc    Register a new user
// @access  Public
router.post("/signup", authLimiter, validate("signup"), signup);

// @route   POST /api/v1/auth/login
// @desc    Authenticate user & get token (Step 1: credentials check, sends 2FA OTP)
// @access  Public
router.post("/login", authLimiter, validate("login"), login);

// @route   POST /api/v1/auth/verify-2fa
// @desc    Verify 2FA OTP and complete login (Step 2)
// @access  Public
router.post("/verify-2fa", authLimiter, validate("verify2FA"), verify2FALogin);

// @route   POST /api/v1/auth/send-otp
// @desc    Send OTP for email verification or password reset
// @access  Public
router.post("/send-otp", otpLimiter, validate("sendOTP"), sendOTP);

// @route   POST /api/v1/auth/verify-otp
// @desc    Verify OTP and mark email as verified
// @access  Public
router.post("/verify-otp", authLimiter, validate("verifyOTP"), verifyOTPController);

// @route   POST /api/v1/auth/password-reset
// @desc    Send password reset email
// @access  Public
router.post("/password-reset", otpLimiter, validate("passwordReset"), passwordReset);

// @route   POST /api/v1/auth/password-reset-confirm
// @desc    Reset password with OTP
// @access  Public
router.post(
  "/password-reset-confirm",
  authLimiter,
  validate("passwordResetConfirm"),
  passwordResetConfirm
);

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", validate("refresh"), refresh);

// @route   POST /api/v1/auth/logout
// @desc    Logout user and end current session
// @access  Private
router.post("/logout", authenticateToken, logout);

// @route   POST /api/v1/auth/logout-all
// @desc    Logout from all devices and end all sessions
// @access  Private
router.post("/logout-all", authenticateToken, logoutAllDevices);

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", authenticateToken, getCurrentUser);

// @route   POST /api/v1/auth/change-password
// @desc    Change user password
// @access  Private
router.post(
  "/change-password",
  authenticateToken,
  validate("changePassword"),
  changePassword
);

// @route   GET /api/v1/auth/check-status
// @desc    Check user status and profile completion for frontend routing
// @access  Private
router.get("/check-status", authenticateToken, checkUserStatus);

// @route   POST /api/v1/auth/complete-profile
// @desc    Mark profile as complete and check user status
// @access  Private
router.post("/complete-profile", authenticateToken, completeProfile);

// ============================================
// Session Management Routes
// ============================================

// @route   GET /api/v1/auth/sessions
// @desc    Get all active sessions for current user
// @access  Private
router.get("/sessions", authenticateToken, getActiveSessionsController);

// @route   DELETE /api/v1/auth/sessions/:sessionId
// @desc    Terminate a specific session
// @access  Private
router.delete("/sessions/:sessionId", authenticateToken, terminateSession);

// @route   DELETE /api/v1/auth/sessions
// @desc    Terminate all other sessions except current
// @access  Private
router.delete("/sessions", authenticateToken, terminateOtherSessions);

module.exports = router;
