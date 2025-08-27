const User = require('../../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../config/jwt.config');
const { generateEmailVerificationOtp, generatePasswordResetOtp, verifyOtp } = require('../helpers/otp.helper');
const { sendOtpEmail, sendWelcomeEmail, sendVerificationSuccessEmail, sendPasswordResetSuccessEmail } = require('../helpers/email.helper');
const { hashPassword, comparePassword } = require('../../utils/password.util');
const {
  AuthenticationError,
  ValidationError,
  ConflictError,
  NotFoundError,
  EmailError,
  OTPError,
  AdminApprovalError,
  EmailVerificationError,
  AccountSuspendedError
} = require('../../utils/customErrors');

/**
 * Authentication Service
 * Handles all authentication-related business logic
 */

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} - Registration result
 */
const registerUser = async (userData) => {
  try {
    const { firstName, lastName, email, password, role } = userData;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash: password, // Will be hashed by pre-save middleware
      role,
      status: 'pending',
      isEmailVerified: false,
      isAdminVerified: false,
      isProfileComplete: false
    });

    // Generate OTP for email verification
    const otpData = generateEmailVerificationOtp();
    user.otp = {
      code: otpData.code,
      expiresAt: otpData.expiresAt
    };

    // Save user
    await user.save();

    // Send welcome email with OTP
    try {
      await sendOtpEmail(email, otpData.formattedOtp, 'verification');
      await sendWelcomeEmail(email, firstName, role);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail registration if email fails, but log it
      // The user can request a new OTP later
    }

    // Return user data (without sensitive information)
    const userResponse = user.toJSON();
    return {
      success: true,
      message: 'User registered successfully. Please check your email for verification OTP.',
      data: {
        user: userResponse,
        emailSent: true
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Login user
 * @param {Object} loginData - Login credentials
 * @returns {Promise<Object>} - Login result
 */
const loginUser = async (loginData) => {
  try {
    const { email, password } = loginData;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (user.status === 'suspended') {
      throw new AccountSuspendedError('Account has been suspended. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new EmailVerificationError('Please verify your email address before logging in');
    }

    // Check if admin has approved the account
    if (!user.isAdminVerified) {
      throw new AdminApprovalError('Your account is pending admin approval. You will be notified once approved.');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
      emailVerified: user.isEmailVerified,
      adminApproved: user.isAdminVerified
    });

    const refreshToken = generateRefreshToken({
      id: user._id,
      email: user.email
    });

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days
    await user.addRefreshToken(refreshToken, refreshTokenExpiry);

    // Clean expired tokens
    await user.cleanExpiredTokens();

    // Return user data and tokens
    const userResponse = user.toJSON();
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60 * 1000 // 15 minutes in milliseconds
        }
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Send OTP for email verification
 * @param {string} email - User email
 * @returns {Promise<Object>} - OTP sending result
 */
const sendVerificationOtp = async (email) => {
  try {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new ConflictError('Email is already verified');
    }

    // Generate new OTP
    const otpData = generateEmailVerificationOtp();
    user.otp = {
      code: otpData.code,
      expiresAt: otpData.expiresAt
    };

    // Save user
    await user.save();

    // Send OTP email
    await sendOtpEmail(email, otpData.formattedOtp, 'verification');

    return {
      success: true,
      message: 'OTP sent successfully. Please check your email.',
      data: {
        email,
        expiresIn: 10 * 60 * 1000 // 10 minutes in milliseconds
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP for email verification
 * @param {Object} otpData - OTP verification data
 * @returns {Promise<Object>} - OTP verification result
 */
const verifyEmailOtp = async (otpData) => {
  try {
    const { email, otp } = otpData;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new ConflictError('Email is already verified');
    }

    // Verify OTP
    const verificationResult = verifyOtp(otp, user.otp.code, user.otp.expiresAt);
    if (!verificationResult.isValid) {
      throw new OTPError(verificationResult.message);
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.otp = { code: null, expiresAt: null }; // Clear OTP
    await user.save();

    // Send verification success email
    await sendVerificationSuccessEmail(email, user.firstName);

    return {
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.toJSON()
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Send OTP for password reset
 * @param {string} email - User email
 * @returns {Promise<Object>} - OTP sending result
 */
const sendPasswordResetOtp = async (email) => {
  try {
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate new OTP
    const otpData = generatePasswordResetOtp();
    user.otp = {
      code: otpData.code,
      expiresAt: otpData.expiresAt
    };

    // Save user
    await user.save();

    // Send OTP email
    await sendOtpEmail(email, otpData.formattedOtp, 'reset');

    return {
      success: true,
      message: 'Password reset OTP sent successfully. Please check your email.',
      data: {
        email,
        expiresIn: 15 * 60 * 1000 // 15 minutes in milliseconds
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Reset password with OTP
 * @param {Object} resetData - Password reset data
 * @returns {Promise<Object>} - Password reset result
 */
const resetPassword = async (resetData) => {
  try {
    const { email, otp, newPassword } = resetData;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify OTP
    const verificationResult = verifyOtp(otp, user.otp.code, user.otp.expiresAt);
    if (!verificationResult.isValid) {
      throw new OTPError(verificationResult.message);
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    user.otp = { code: null, expiresAt: null }; // Clear OTP
    await user.save();

    // Send password reset success email
    await sendPasswordResetSuccessEmail(email, user.firstName);

    return {
      success: true,
      message: 'Password reset successfully',
      data: {
        user: user.toJSON()
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - Token refresh result
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if refresh token exists in user's tokens
    const tokenExists = user.refreshTokens.find(rt => rt.token === refreshToken);
    if (!tokenExists) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date() > tokenExists.expiresAt) {
      // Remove expired token
      await user.removeRefreshToken(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
      emailVerified: user.isEmailVerified,
      adminApproved: user.isAdminVerified
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: 15 * 60 * 1000 // 15 minutes in milliseconds
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Logout user
 * @param {string} refreshToken - Refresh token to invalidate
 * @returns {Promise<Object>} - Logout result
 */
const logoutUser = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove refresh token
    await user.removeRefreshToken(refreshToken);

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get current user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Current user data
 */
const getCurrentUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      success: true,
      message: 'Current user retrieved successfully',
      data: {
        user: user.toJSON()
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Profile update data
 * @returns {Promise<Object>} - Profile update result
 */
const updateUserProfile = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update allowed fields
    const allowedFields = ['firstName', 'lastName', 'avatarUrl'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    }

    await user.save();

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Change password
 * @param {string} userId - User ID
 * @param {Object} passwordData - Password change data
 * @returns {Promise<Object>} - Password change result
 */
const changePassword = async (userId, passwordData) => {
  try {
    const { currentPassword, newPassword } = passwordData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Check if new password is different
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  sendVerificationOtp,
  verifyEmailOtp,
  sendPasswordResetOtp,
  resetPassword,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  updateUserProfile,
  changePassword
};
