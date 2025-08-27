const { sendErrorResponse } = require('../utils/responseHandler');

/**
 * Role-based Access Control Middleware
 * Checks if user has the required role(s)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendErrorResponse(res, 401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return sendErrorResponse(res, 403, `Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
const requireAdmin = requireRole('admin');

/**
 * School-only middleware
 */
const requireSchool = requireRole('school');

/**
 * Teacher-only middleware
 */
const requireTeacher = requireRole('teacher');

/**
 * Supplier-only middleware
 */
const requireSupplier = requireRole('supplier');

/**
 * Recruiter-only middleware
 */
const requireRecruiter = requireRole('recruiter');

/**
 * School or Admin middleware
 */
const requireSchoolOrAdmin = requireRole('school', 'admin');

/**
 * Teacher or Admin middleware
 */
const requireTeacherOrAdmin = requireRole('teacher', 'admin');

/**
 * Any authenticated user middleware
 */
const requireAnyRole = requireRole('school', 'teacher', 'supplier', 'recruiter', 'admin');

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources
 */
const requireOwnership = (resourceIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return sendErrorResponse(res, 401, 'Authentication required');
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];
    
    if (resourceId && resourceId !== req.user.id) {
      return sendErrorResponse(res, 403, 'Access denied. You can only access your own resources.');
    }

    next();
  };
};

/**
 * Profile completion middleware
 * Ensures user has completed their profile setup
 */
const requireProfileCompletion = (req, res, next) => {
  if (!req.user) {
    return sendErrorResponse(res, 401, 'Authentication required');
  }

  // Admin doesn't need profile completion
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user has completed their profile
  // This will be implemented based on the specific role requirements
  // For now, we'll assume profile is complete if user is authenticated
  next();
};

module.exports = {
  requireRole,
  requireAdmin,
  requireSchool,
  requireTeacher,
  requireSupplier,
  requireRecruiter,
  requireSchoolOrAdmin,
  requireTeacherOrAdmin,
  requireAnyRole,
  requireOwnership,
  requireProfileCompletion
};
