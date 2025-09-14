const express = require("express");
const rateLimit = require("express-rate-limit");
const { validate } = require("../middleware/validation");
const { authenticateToken } = require("../middleware/auth");
const {
  signup,
  login,
  sendOTP,
  verifyOTPController,
  passwordReset,
  passwordResetConfirm,
  refresh,
  logout,
  getCurrentUser,
  changePassword,
  checkUserStatus,
  completeProfile,
} = require("../controllers/authController");

const router = express.Router();

// // Rate limiting for auth endpoints
// const authLimiter = rateLimit({
//   windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // limit each IP to 5 requests per windowMs
//   message: {
//     success: false,
//     message: "Too many authentication attempts, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // Apply rate limiting to all auth routes
// router.use(authLimiter);

// @route   POST /api/v1/auth/signup
// @desc    Register a new user
// @access  Public
router.post("/signup", validate("signup"), signup);

// @route   POST /api/v1/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", validate("login"), login);

// @route   POST /api/v1/auth/send-otp
// @desc    Send OTP for email verification or password reset
// @access  Public
router.post("/send-otp", validate("sendOTP"), sendOTP);

// @route   POST /api/v1/auth/verify-otp
// @desc    Verify OTP and mark email as verified
// @access  Public
router.post("/verify-otp", validate("verifyOTP"), verifyOTPController);

// @route   POST /api/v1/auth/password-reset
// @desc    Send password reset email
// @access  Public
router.post("/password-reset", validate("passwordReset"), passwordReset);

// @route   POST /api/v1/auth/password-reset-confirm
// @desc    Reset password with OTP
// @access  Public
router.post(
  "/password-reset-confirm",
  validate("passwordResetConfirm"),
  passwordResetConfirm
);

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", validate("refresh"), refresh);

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", validate("logout"), logout);

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

module.exports = router;
