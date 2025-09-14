const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/response");

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return unauthorizedResponse(res, "Access token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Attach user info to request
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
    };

    // If user is a school, also attach schoolId
    if (user.role === "school") {
      const SchoolProfile = require("../models/SchoolProfile");
      const schoolProfile = await SchoolProfile.findOne({
        userId: user._id,
      }).select("_id");
      if (schoolProfile) {
        req.user.schoolId = schoolProfile._id;
        console.log("School profile found:", schoolProfile._id);
      } else {
        console.log("No school profile found for user:", user._id);
      }
    }

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return unauthorizedResponse(res, "Invalid token");
    } else if (error.name === "TokenExpiredError") {
      return unauthorizedResponse(res, "Token expired");
    }
    return unauthorizedResponse(res, "Authentication failed");
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user) {
        req.user = {
          userId: user._id,
          email: user.email,
          role: user.role,
        };

        // If user is a school, also attach schoolId
        if (user.role === "school") {
          const SchoolProfile = require("../models/SchoolProfile");
          const schoolProfile = await SchoolProfile.findOne({
            userId: user._id,
          }).select("_id");
          if (schoolProfile) {
            req.user.schoolId = schoolProfile._id;
          }
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Authorize roles
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, "Authentication required");
    }

    console.log("User role:", req.user.role);
    console.log("Roles:", roles);

    if (!roles.includes(req.user.role)) {
      return forbiddenResponse(res, "Insufficient permissions");
    }

    next();
  };
};

// Require email verification
const requireEmailVerification = async (req, res, next) => {
  try {
    if (!req.user) {
      return unauthorizedResponse(res, "Authentication required");
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    if (!user.isEmailVerified) {
      return forbiddenResponse(res, "Email verification required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Require profile completion
const requireProfileCompletion = async (req, res, next) => {
  try {
    if (!req.user) {
      return unauthorizedResponse(res, "Authentication required");
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    if (!user.isProfileComplete) {
      return forbiddenResponse(res, "Profile completion required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check user status and redirect accordingly
const checkUserStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return unauthorizedResponse(res, "Authentication required");
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return forbiddenResponse(res, "Email verification required");
    }

    // Check profile completion first - this takes priority over status
    if (!user.isProfileComplete) {
      return forbiddenResponse(res, "Profile completion required");
    }

    // Only check user status AFTER profile is complete
    // Check user status for non-admin/teacher users
    if (user.role !== "admin" && user.role !== "teacher") {
      if (user.status !== "active") {
        return forbiddenResponse(res, "Account not active");
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  authorizeRoles,
  requireEmailVerification,
  requireProfileCompletion,
  checkUserStatus,
};
