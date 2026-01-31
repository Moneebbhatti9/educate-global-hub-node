const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");

const User = require("../models/User");
const OTPCode = require("../models/OTPCode");
const RefreshToken = require("../models/RefreshToken");
const Session = require("../models/Session");

// Inactivity timeout (30 minutes)
const INACTIVITY_TIMEOUT_MS = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MS) || 30 * 60 * 1000;

// Generate JWT tokens with optional sessionId
const generateTokens = (userId, email, role, sessionId = null) => {
  const accessTokenPayload = { userId, email, role };
  const refreshTokenPayload = { userId, email, role };

  // Include sessionId if provided
  if (sessionId) {
    accessTokenPayload.sessionId = sessionId;
    refreshTokenPayload.sessionId = sessionId;
  }

  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );

  const refreshToken = jwt.sign(
    refreshTokenPayload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

  return { accessToken, refreshToken };
};

// Parse user agent string to extract device info
const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return {
      userAgent: "Unknown",
      browser: "Unknown",
      os: "Unknown",
      device: "Unknown",
      isMobile: false,
    };
  }

  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  let browser = "Unknown";
  let os = "Unknown";
  let device = isMobile ? "Mobile" : "Desktop";

  // Detect browser
  if (userAgent.includes("Chrome") && !userAgent.includes("Edge")) {
    browser = "Chrome";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  } else if (userAgent.includes("Edge")) {
    browser = "Edge";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    browser = "Opera";
  }

  // Detect OS
  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    os = "macOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
  }

  return {
    userAgent,
    browser,
    os,
    device,
    isMobile,
  };
};

// Create a new session
const createSession = async (userId, refreshTokenId, req) => {
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = req.ip || req.connection?.remoteAddress || "Unknown";
  const deviceInfo = parseUserAgent(userAgent);

  const session = new Session({
    userId,
    refreshTokenId,
    deviceInfo,
    ipAddress,
    expiresAt: new Date(Date.now() + INACTIVITY_TIMEOUT_MS),
    loginAt: new Date(),
    lastActivityAt: new Date(),
  });

  return await session.save();
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Verify JWT token
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw error;
  }
};

// Decode JWT token without verification
const decodeToken = (token) => {
  return jwt.decode(token);
};

// Generate password reset token
const generatePasswordResetToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: "password_reset" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

// Generate email verification token
const generateEmailVerificationToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: "email_verification" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

// Validate password strength
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!hasLowerCase) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!hasNumbers) {
    errors.push("Password must contain at least one number");
  }
  if (!hasSpecialChar) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject ? user.toObject() : user;

  // Remove sensitive fields
  delete userObj.passwordHash;
  delete userObj.__v;

  // Convert MongoDB ObjectId to string
  if (userObj._id) {
    userObj.id = userObj._id.toString();
    delete userObj._id;
  }

  return userObj;
};

// Store OTP in database
const storeOTP = async (email, otpCode, type) => {
  const expiresAt = dayjs().add(10, "minute").toDate();

  const otp = new OTPCode({
    email,
    otpCode,
    type,
    expiresAt,
  });

  return await otp.save();
};

// Verify OTP from database
const verifyOTP = async (email, otpCode, type) => {
  const otp = await OTPCode.findValidOTP(email, otpCode, type);

  if (!otp) {
    return { isValid: false, message: "Invalid or expired OTP" };
  }

  // Mark OTP as used
  await otp.markAsUsed();

  return { isValid: true, otp };
};

// Store refresh token
const storeRefreshToken = async (userId, tokenHash, expiresAt) => {
  const refreshToken = new RefreshToken({
    userId,
    tokenHash,
    expiresAt,
  });

  return await refreshToken.save();
};

// Verify refresh token
const verifyRefreshToken = async (refreshToken) => {
  try {
    // First decode the refresh token to get user info
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find all valid tokens for this user
    const tokens = await RefreshToken.find({
      userId: decoded.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!tokens || tokens.length === 0) {
      return { isValid: false, message: "Invalid refresh token" };
    }

    // Check if any of the tokens match the provided refresh token
    let validToken = null;
    for (const token of tokens) {
      const isHashValid = await comparePassword(refreshToken, token.tokenHash);
      if (isHashValid) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      return { isValid: false, message: "Invalid refresh token" };
    }

    return { isValid: true, userId: decoded.userId, token: validToken };
  } catch (error) {
    return { isValid: false, message: "Invalid refresh token" };
  }
};

// Revoke refresh token
const revokeRefreshToken = async (userId, tokenHash) => {
  return await RefreshToken.updateOne(
    { userId, tokenHash },
    { isRevoked: true }
  );
};

// Revoke all refresh tokens for a user
const revokeAllRefreshTokens = async (userId) => {
  return await RefreshToken.revokeAllForUser(userId);
};

// End a user's session
const endSession = async (sessionId, reason = "user_logout") => {
  const session = await Session.findById(sessionId);
  if (session && session.isActive) {
    return await session.endSession(reason);
  }
  return null;
};

// End all sessions for a user
const endAllSessions = async (userId, reason = "forced_logout") => {
  return await Session.endAllSessions(userId, reason);
};

// End all sessions except current
const endOtherSessions = async (userId, currentSessionId, reason = "forced_logout") => {
  return await Session.endOtherSessions(userId, currentSessionId, reason);
};

// Get all active sessions for a user
const getActiveSessions = async (userId) => {
  return await Session.getActiveSessions(userId);
};

module.exports = {
  generateTokens,
  hashPassword,
  comparePassword,
  generateOTP,
  verifyToken,
  decodeToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  validatePasswordStrength,
  sanitizeUser,
  storeOTP,
  verifyOTP,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  // Session management
  parseUserAgent,
  createSession,
  endSession,
  endAllSessions,
  endOtherSessions,
  getActiveSessions,
  INACTIVITY_TIMEOUT_MS,
};
