/**
 * Custom Error Classes
 * Provides specific error types with appropriate HTTP status codes
 */

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class ValidationError extends Error {
  constructor(message = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class UnprocessableEntityError extends Error {
  constructor(message = 'Unprocessable entity') {
    super(message);
    this.name = 'UnprocessableEntityError';
    this.statusCode = 422;
  }
}

class EmailError extends Error {
  constructor(message = 'Email sending failed') {
    super(message);
    this.name = 'EmailError';
    this.statusCode = 500;
  }
}

class OTPError extends Error {
  constructor(message = 'OTP operation failed') {
    super(message);
    this.name = 'OTPError';
    this.statusCode = 400;
  }
}

class AdminApprovalError extends Error {
  constructor(message = 'Account pending admin approval') {
    super(message);
    this.name = 'AdminApprovalError';
    this.statusCode = 403;
  }
}

class EmailVerificationError extends Error {
  constructor(message = 'Email not verified') {
    super(message);
    this.name = 'EmailVerificationError';
    this.statusCode = 403;
  }
}

class AccountSuspendedError extends Error {
  constructor(message = 'Account is suspended') {
    super(message);
    this.name = 'AccountSuspendedError';
    this.statusCode = 403;
  }
}

module.exports = {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  EmailError,
  OTPError,
  AdminApprovalError,
  EmailVerificationError,
  AccountSuspendedError
};
