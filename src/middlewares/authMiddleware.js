const { verifyAccessToken } = require('../config/jwt.config');
const { sendErrorResponse } = require('../utils/responseHandler');

/**
 * JWT Authentication Middleware
 * Verifies the access token from Authorization header
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return sendErrorResponse(res, 401, 'Access token is required');
    }

    // Verify the token
    const decoded = verifyAccessToken(token);
    
    // Add user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      emailVerified: decoded.emailVerified,
      adminApproved: decoded.adminApproved
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return sendErrorResponse(res, 401, 'Invalid or expired access token');
  }
};

/**
 * Optional Authentication Middleware
 * Verifies token if present, but doesn't fail if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        emailVerified: decoded.emailVerified,
        adminApproved: decoded.adminApproved
      };
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Email Verification Middleware
 * Ensures user's email is verified
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return sendErrorResponse(res, 401, 'Authentication required');
  }

  if (!req.user.emailVerified) {
    return sendErrorResponse(res, 403, 'Email verification required');
  }

  next();
};

/**
 * Admin Approval Middleware
 * Ensures user is approved by admin
 */
const requireAdminApproval = (req, res, next) => {
  if (!req.user) {
    return sendErrorResponse(res, 401, 'Authentication required');
  }

  if (!req.user.adminApproved) {
    return sendErrorResponse(res, 403, 'Account pending admin approval');
  }

  next();
};

/**
 * Complete Authentication Middleware
 * Combines token verification, email verification, and admin approval
 */
const requireFullAuth = [
  authenticateToken,
  requireEmailVerification,
  requireAdminApproval
];

module.exports = {
  authenticateToken,
  optionalAuth,
  requireEmailVerification,
  requireAdminApproval,
  requireFullAuth
};
