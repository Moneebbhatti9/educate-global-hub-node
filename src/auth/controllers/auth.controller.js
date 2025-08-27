const authService = require('../services/auth.service');
const { sendSuccessResponse, sendErrorResponse, sendCreatedResponse } = require('../../utils/responseHandler');
const { asyncHandler } = require('../../middlewares/errorHandler');

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.registerUser(validatedData);
  
  return sendCreatedResponse(res, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.loginUser(validatedData);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP for email verification
 * @access  Public
 */
const sendOtp = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.sendVerificationOtp(validatedData.email);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP for email verification
 * @access  Public
 */
const verifyOtp = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.verifyEmailOtp(validatedData);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP for email verification
 * @access  Public
 */
const resendOtp = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.sendVerificationOtp(validatedData.email);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send OTP for password reset
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.sendPasswordResetOtp(validatedData.email);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.resetPassword(validatedData);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.refreshAccessToken(validatedData.refreshToken);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  const { validatedData } = req;
  
  const result = await authService.logoutUser(validatedData.refreshToken);
  
  return sendSuccessResponse(res, 200, result.message);
});

/**
 * @route   GET /api/v1/auth/current-user
 * @desc    Get current user
 * @access  Private
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const { user } = req;
  
  const result = await authService.getCurrentUser(user.id);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { user } = req;
  const { validatedData } = req;
  
  const result = await authService.updateUserProfile(user.id, validatedData);
  
  return sendSuccessResponse(res, 200, result.message, result.data);
});

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { user } = req;
  const { validatedData } = req;
  
  const result = await authService.changePassword(user.id, validatedData);
  
  return sendSuccessResponse(res, 200, result.message);
});

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword
};
