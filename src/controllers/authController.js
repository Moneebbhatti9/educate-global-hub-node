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
  createSession,
  endSession,
  endAllSessions,
  endOtherSessions,
  getActiveSessions,
} = require("../utils/auth");
const Session = require("../models/Session");
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

// Login controller - Step 1: Validate credentials and send 2FA OTP
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // Check if account is locked
    if (user && user.isAccountLocked()) {
      const lockTimeRemaining = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return unauthorizedResponse(
        res,
        `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      // Increment failed attempts if user exists
      if (user) {
        await user.incrementFailedAttempts();
      }
      return unauthorizedResponse(res, "Invalid email or password");
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return unauthorizedResponse(
        res,
        "Please verify your email before logging in"
      );
    }

    // Check if 2FA is enabled (default: true for all users)
    if (user.is2FAEnabled) {
      // Generate and send 2FA OTP
      const otp = generateOTP();
      await storeOTP(email, otp, "signin");

      try {
        await emailService.send2FAEmail(email, user.firstName, otp);
      } catch (emailError) {
        console.error("Failed to send 2FA email:", emailError);
        return errorResponse(res, "Failed to send verification code", 500);
      }

      return successResponse(
        res,
        {
          requires2FA: true,
          email: user.email,
          method: user.twoFactorMethod,
        },
        "Verification code sent to your email"
      );
    }

    // If 2FA is disabled, proceed with login
    return await completeLogin(user, req, res);
  } catch (error) {
    next(error);
  }
};

// Login controller - Step 2: Verify 2FA OTP and complete login
const verify2FALogin = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      const lockTimeRemaining = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return unauthorizedResponse(
        res,
        `Account is locked. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    // Verify the 2FA OTP
    const result = await verifyOTP(email, otp, "signin");
    if (!result.isValid) {
      await user.incrementFailedAttempts();
      return validationErrorResponse(res, result.message);
    }

    // Complete the login
    return await completeLogin(user, req, res);
  } catch (error) {
    next(error);
  }
};

// Helper function to complete login after all checks pass
const completeLogin = async (user, req, res) => {
  // Reset failed attempts on successful login
  await user.resetFailedAttempts();

  // Update last login info
  user.lastLoginIp = req.ip || req.connection.remoteAddress;
  user.lastLoginAt = new Date();
  await user.save();

  // Store refresh token first to get the ID for session creation
  const refreshTokenHash = await hashPassword(
    `temp_${user._id}_${Date.now()}`
  );
  const expiresAt = dayjs().add(7, "day").toDate();
  const storedRefreshToken = await storeRefreshToken(
    user._id,
    refreshTokenHash,
    expiresAt
  );

  // Create session with device info
  const session = await createSession(user._id, storedRefreshToken._id, req);

  // Generate tokens with sessionId included
  const { accessToken, refreshToken } = generateTokens(
    user._id,
    user.email,
    user.role,
    session._id
  );

  // Update the refresh token hash with the actual token
  const actualRefreshTokenHash = await hashPassword(refreshToken);
  storedRefreshToken.tokenHash = actualRefreshTokenHash;
  await storedRefreshToken.save();

  return successResponse(
    res,
    {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
      sessionId: session._id,
    },
    "Login successful"
  );
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
      } else if (type === "signin") {
        await emailService.send2FAEmail(email, user.firstName, otp);
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
    const sessionId = req.sessionId;

    // End the current session if exists
    if (sessionId) {
      await endSession(sessionId, "user_logout");
    }

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

// Logout from all devices
const logoutAllDevices = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // End all sessions for the user
    await endAllSessions(userId, "forced_logout");

    // Revoke all refresh tokens
    await revokeAllRefreshTokens(userId);

    return successResponse(res, null, "Logged out from all devices successfully");
  } catch (error) {
    next(error);
  }
};

// Get active sessions
const getActiveSessionsController = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sessions = await getActiveSessions(userId);

    // Format sessions for response
    const formattedSessions = sessions.map((session) => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      location: session.location,
      loginAt: session.loginAt,
      lastActivityAt: session.lastActivityAt,
      isCurrent: req.sessionId && session._id.toString() === req.sessionId.toString(),
    }));

    return successResponse(
      res,
      { sessions: formattedSessions },
      "Active sessions retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Terminate a specific session
const terminateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // Find the session and verify it belongs to the user
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return notFoundResponse(res, "Session not found");
    }

    if (!session.isActive) {
      return errorResponse(res, "Session is already terminated", 400);
    }

    // Don't allow terminating current session via this endpoint
    if (req.sessionId && session._id.toString() === req.sessionId.toString()) {
      return errorResponse(res, "Cannot terminate current session. Use logout instead.", 400);
    }

    await endSession(sessionId, "forced_logout");

    return successResponse(res, null, "Session terminated successfully");
  } catch (error) {
    next(error);
  }
};

// Terminate all other sessions except current
const terminateOtherSessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const currentSessionId = req.sessionId;

    if (!currentSessionId) {
      return errorResponse(res, "Current session not found", 400);
    }

    // End all other sessions
    await endOtherSessions(userId, currentSessionId, "forced_logout");

    return successResponse(res, null, "All other sessions terminated successfully");
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
      kycStatus: user.kycStatus,
    };

    // Check email verification
    if (!user.isEmailVerified) {
      response.redirectTo = "verify-email";
      return successResponse(res, response, "Email verification required");
    }

    // Check profile completion
    if (!user.isProfileComplete) {
      response.redirectTo = "complete-profile";
      return successResponse(res, response, "Profile completion required");
    }

    // Check KYC status for teachers and schools
    if (user.role === "teacher" || user.role === "school") {
      if (user.kycStatus === "not_submitted") {
        response.redirectTo = "kyc-submission";
        return successResponse(res, response, "KYC submission required");
      }

      if (user.kycStatus === "pending" || user.kycStatus === "under_review") {
        response.redirectTo = "kyc-pending";
        return successResponse(res, response, "KYC review pending");
      }

      if (user.kycStatus === "rejected") {
        response.redirectTo = "kyc-rejected";
        response.kycRejectionReason = user.kycRejectionReason;
        return successResponse(res, response, "KYC was rejected");
      }

      if (user.kycStatus === "resubmission_required") {
        response.redirectTo = "kyc-resubmission";
        response.kycRejectionReason = user.kycRejectionReason;
        return successResponse(res, response, "KYC resubmission required");
      }
    }

    // Check user status for non-admin users
    if (user.role !== "admin") {
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
};
