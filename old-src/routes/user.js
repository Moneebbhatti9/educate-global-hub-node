const express = require("express");
const { validate } = require("../middleware/validation");
const {
  authenticateToken,
  requireEmailVerification,
  requireProfileCompletion,
} = require("../middleware/auth");
const {
  completeProfile,
  updateProfile,
  getCurrentUserProfile,
  getPublicUserProfile,
  getUsers,
  updateAvatar,
  deleteAccount,
} = require("../controllers/userController");

const router = express.Router();

// @route   POST /api/v1/users/complete-profile
// @desc    Complete user profile
// @access  Private
router.post(
  "/complete-profile",
  authenticateToken,
  requireEmailVerification,
  validate("completeProfile"),
  completeProfile
);

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  authenticateToken,
  requireEmailVerification,
  validate("updateProfile"),
  updateProfile
);

// @route   GET /api/v1/users/profile
// @desc    Get current user profile
// @access  Private
router.get(
  "/profile",
  authenticateToken,
  requireEmailVerification,
  getCurrentUserProfile
);

// @route   GET /api/v1/users/:id
// @desc    Get public user profile by ID
// @access  Public
router.get("/:id", getPublicUserProfile);

// @route   GET /api/v1/users
// @desc    Get users list with filtering and pagination
// @access  Public
router.get("/", getUsers);

// @route   PUT /api/v1/users/avatar
// @desc    Update user avatar
// @access  Private
router.put(
  "/avatar",
  authenticateToken,
  requireEmailVerification,
  updateAvatar
);

// @route   DELETE /api/v1/users/account
// @desc    Delete user account
// @access  Private
router.delete(
  "/account",
  authenticateToken,
  requireEmailVerification,
  deleteAccount
);

module.exports = router;
