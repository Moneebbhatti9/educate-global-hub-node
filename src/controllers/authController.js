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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, email, role);

    // Store refresh token
    const refreshTokenHash = await hashPassword(refreshToken);
    const expiresAt = dayjs().add(7, "day").toDate();
    await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

    // Send verification email
    try {
      const otp = generateOTP();
      await storeOTP(email, otp, "verification");
      await emailService.sendVerificationEmail(email, firstName, otp);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    return createdResponse(
      res,
      "User registered successfully. Please check your email for verification code.",
      {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
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

    if (type === "verification") {
      await User.updateOne({ email }, { isEmailVerified: true });

      // Send welcome email after successful verification
      try {
        const user = await User.findOne({ email });
        if (user) {
          await emailService.sendWelcomeEmail(email, user.firstName);
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    }

    return successResponse(
      res,
      null,
      type === "verification"
        ? "Email verified successfully. Welcome email sent!"
        : "OTP verified successfully"
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

    // Revoke old refresh token by finding it in the database
    const oldToken = await RefreshToken.findOne({
      userId: result.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (oldToken) {
      await oldToken.revoke();
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
};
