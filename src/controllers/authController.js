const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");

const User = require("../models/User");
const OTPCode = require("../models/OTPCode");
const RefreshToken = require("../models/RefreshToken");
const emailService = require("../config/email");
const {
  generateTokens,
  hashPassword,
  comparePassword,
  generateOTP,
  sanitizeUser,
  storeOTP,
  verifyOTP,
  storeRefreshToken,
  verifyRefreshToken,
  revokeAllRefreshTokens,
} = require("../utils/auth");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  conflictResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/response");

// Signup controller
const signup = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return conflictResponse(res, "User with this email already exists");
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const user = new User({
      email,
      passwordHash,
      firstName,
      lastName,
      role,
    });

    await user.save();

    // Send verification email
    try {
      const otp = generateOTP();
      await storeOTP(email, otp, "verification");
      await emailService.sendVerificationEmail(email, firstName, otp);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return errorResponse(res, "Failed to send verification email", 500);
    }

    return createdResponse(
      res,
      "User registered successfully. Please check your email for verification code.",
      {
        user: sanitizeUser(user),
      }
    );
  } catch (error) {
    next(error);
  }
};

// Login controller
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return unauthorizedResponse(res, "Invalid email or password");
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return unauthorizedResponse(
        res,
        "Please verify your email before logging in"
      );
    }

    // Check user status for non-admin/teacher users
    if (user.role !== "admin" && user.role !== "teacher") {
      if (user.status !== "active") {
        return unauthorizedResponse(
          res,
          "Your account is not active. Please contact support."
        );
      }
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.email,
      user.role
    );

    // Store refresh token
    const refreshTokenHash = await hashPassword(refreshToken);
    const expiresAt = dayjs().add(7, "day").toDate();
    await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

    return successResponse(
      res,
      {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      },
      "Login successful"
    );
  } catch (error) {
    next(error);
  }
};

// Send OTP controller
const sendOTP = async (req, res, next) => {
  try {
    const { email, type = "verification" } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const otp = generateOTP();
    await storeOTP(email, otp, type);

    try {
      if (type === "verification") {
        await emailService.sendVerificationEmail(email, user.firstName, otp);
      } else if (type === "reset") {
        await emailService.sendPasswordResetEmail(email, user.firstName, otp);
      }
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      return errorResponse(res, "Failed to send OTP email", 500);
    }

    return successResponse(res, null, "OTP sent successfully");
  } catch (error) {
    next(error);
  }
};

// Verify OTP controller
const verifyOTPController = async (req, res, next) => {
  try {
    const { email, otp, type = "verification" } = req.body;

    const result = await verifyOTP(email, otp, type);
    if (!result.isValid) {
      return validationErrorResponse(res, result.message);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (type === "verification") {
      await User.updateOne({ email }, { isEmailVerified: true });

      // Fetch the updated user data after the database update
      const updatedUser = await User.findOne({ email });
      if (!updatedUser) {
        return notFoundResponse(res, "User not found after update");
      }

      // Send welcome email after successful verification
      try {
        await emailService.sendWelcomeEmail(email, updatedUser.firstName);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      // Generate tokens only after email verification
      const { accessToken, refreshToken } = generateTokens(
        updatedUser._id,
        updatedUser.email,
        updatedUser.role
      );

      // Store refresh token
      const refreshTokenHash = await hashPassword(refreshToken);
      const expiresAt = dayjs().add(7, "day").toDate();
      await storeRefreshToken(updatedUser._id, refreshTokenHash, expiresAt);

      return successResponse(
        res,
        {
          user: sanitizeUser(updatedUser),
          accessToken,
          refreshToken,
        },
        "Email verified successfully. Welcome email sent!"
      );
    }

    // For password reset OTP verification, don't generate tokens
    return successResponse(
      res,
      null,
      "OTP verified successfully. You can now reset your password."
    );
  } catch (error) {
    next(error);
  }
};

// Password reset controller
const passwordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const otp = generateOTP();
    await storeOTP(email, otp, "reset");

    try {
      await emailService.sendPasswordResetEmail(email, user.firstName, otp);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return errorResponse(res, "Failed to send password reset email", 500);
    }

    return successResponse(res, null, "Password reset email sent successfully");
  } catch (error) {
    next(error);
  }
};

// Password reset confirm controller
const passwordResetConfirm = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    const result = await verifyOTP(email, otp, "reset");
    if (!result.isValid) {
      return validationErrorResponse(res, result.message);
    }

    const passwordHash = await hashPassword(newPassword);
    await User.updateOne({ email }, { passwordHash });

    // Revoke all refresh tokens
    const user = await User.findOne({ email });
    if (user) {
      await revokeAllRefreshTokens(user._id);
    }

    return successResponse(res, null, "Password reset successfully");
  } catch (error) {
    next(error);
  }
};

// Refresh token controller
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return unauthorizedResponse(res, "Refresh token is required");
    }

    const result = await verifyRefreshToken(refreshToken);
    if (!result.isValid) {
      return unauthorizedResponse(
        res,
        result.message || "Invalid refresh token"
      );
    }

    const user = await User.findById(result.userId);
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id,
      user.email,
      user.role
    );

    // Store new refresh token
    const refreshTokenHash = await hashPassword(newRefreshToken);
    const expiresAt = dayjs().add(7, "day").toDate();
    await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

    // Revoke the specific refresh token that was used
    if (result.token) {
      await result.token.revoke();
    }

    return successResponse(
      res,
      {
        accessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Logout controller
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Find and revoke the specific refresh token
      const token = await RefreshToken.findOne({
        userId: req.user.userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (token) {
        await token.revoke();
      }
    }

    return successResponse(res, null, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

// Get current user controller
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponse(
      res,
      {
        user: sanitizeUser(user),
      },
      "User retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Change password controller
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return unauthorizedResponse(res, "Current password is incorrect");
    }

    // Check if new password is same as current password
    const isSamePassword = await comparePassword(
      newPassword,
      user.passwordHash
    );
    if (isSamePassword) {
      return validationErrorResponse(
        res,
        "New password must be different from current password"
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await User.updateOne({ _id: userId }, { passwordHash: newPasswordHash });

    // Revoke all refresh tokens for security
    await revokeAllRefreshTokens(userId);

    return successResponse(
      res,
      null,
      "Password changed successfully. Please login again with your new password."
    );
  } catch (error) {
    next(error);
  }
};

// Check user status and profile completion for frontend routing
const checkUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    const response = {
      user: sanitizeUser(user),
      redirectTo: null,
    };

    // Check email verification
    if (!user.isEmailVerified) {
      response.redirectTo = "verify-email";
      return successResponse(res, response, "Email verification required");
    }

    // Check profile completion first - this takes priority over status
    if (!user.isProfileComplete) {
      response.redirectTo = "complete-profile";
      return successResponse(res, response, "Profile completion required");
    }

    // Only check user status AFTER profile is complete
    // Check user status for non-admin/teacher users
    if (user.role !== "admin" && user.role !== "teacher") {
      if (user.status !== "active") {
        response.redirectTo = "pending-approval";
        return successResponse(res, response, "Account pending approval");
      }
    }

    // All checks passed, user can access dashboard
    response.redirectTo = "dashboard";
    return successResponse(res, response, "User status verified");
  } catch (error) {
    next(error);
  }
};

// Mark profile as complete and check status
const completeProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Update user profile completion status
    await User.updateOne({ _id: userId }, { isProfileComplete: true });

    // Get updated user
    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    const response = {
      user: sanitizeUser(user),
      redirectTo: null,
    };

    // After profile completion, check user status for non-admin/teacher users
    if (user.role !== "admin" && user.role !== "teacher") {
      if (user.status !== "active") {
        response.redirectTo = "pending-approval";
        return successResponse(
          res,
          response,
          "Profile completed. Account pending approval."
        );
      }
    }

    // All checks passed, user can access dashboard
    response.redirectTo = "dashboard";
    return successResponse(res, response, "Profile completed successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
