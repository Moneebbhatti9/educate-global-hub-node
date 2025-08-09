const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");

const User = require("../models/User");
const OTPCode = require("../models/OTPCode");
const RefreshToken = require("../models/RefreshToken");

// Generate JWT tokens
const generateTokens = (userId, email, role) => {
  const accessToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );

  const refreshToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

  return { accessToken, refreshToken };
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
const verifyRefreshToken = async (userId, tokenHash) => {
  const token = await RefreshToken.findOne({
    userId,
    tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });

  return token;
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
};
