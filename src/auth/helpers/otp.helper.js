/**
 * OTP Helper Functions
 * Handles OTP generation, verification, and management
 */

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate OTP expiry time
 * @param {number} minutes - Minutes until expiry (default: 10)
 * @returns {Date} - Expiry timestamp
 */
const generateOtpExpiry = (minutes = 10) => {
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + minutes);
  return expiryTime;
};

/**
 * Check if OTP is expired
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {boolean} - True if expired
 */
const isOtpExpired = (expiryTime) => {
  return new Date() > new Date(expiryTime);
};

/**
 * Verify OTP code
 * @param {string} providedOtp - OTP provided by user
 * @param {string} storedOtp - OTP stored in database
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {Object} - Verification result
 */
const verifyOtp = (providedOtp, storedOtp, expiryTime) => {
  // Check if OTP exists
  if (!storedOtp) {
    return {
      isValid: false,
      message: 'No OTP found. Please request a new OTP.'
    };
  }

  // Check if OTP is expired
  if (isOtpExpired(expiryTime)) {
    return {
      isValid: false,
      message: 'OTP has expired. Please request a new OTP.'
    };
  }

  // Check if OTP matches
  if (providedOtp !== storedOtp) {
    return {
      isValid: false,
      message: 'Invalid OTP. Please check and try again.'
    };
  }

  return {
    isValid: true,
    message: 'OTP verified successfully.'
  };
};

/**
 * Format OTP for display (add spaces for readability)
 * @param {string} otp - 6-digit OTP
 * @returns {string} - Formatted OTP (e.g., "123 456")
 */
const formatOtp = (otp) => {
  if (!otp || otp.length !== 6) return otp;
  return `${otp.slice(0, 3)} ${otp.slice(3)}`;
};

/**
 * Generate OTP for email verification
 * @returns {Object} - OTP data
 */
const generateEmailVerificationOtp = () => {
  const otp = generateOtp();
  const expiryTime = generateOtpExpiry(10); // 10 minutes

  return {
    code: otp,
    expiresAt: expiryTime,
    formattedOtp: formatOtp(otp)
  };
};

/**
 * Generate OTP for password reset
 * @returns {Object} - OTP data
 */
const generatePasswordResetOtp = () => {
  const otp = generateOtp();
  const expiryTime = generateOtpExpiry(15); // 15 minutes

  return {
    code: otp,
    expiresAt: expiryTime,
    formattedOtp: formatOtp(otp)
  };
};

/**
 * Generate OTP for general purposes
 * @param {number} expiryMinutes - Minutes until expiry
 * @returns {Object} - OTP data
 */
const generateGeneralOtp = (expiryMinutes = 10) => {
  const otp = generateOtp();
  const expiryTime = generateOtpExpiry(expiryMinutes);

  return {
    code: otp,
    expiresAt: expiryTime,
    formattedOtp: formatOtp(otp)
  };
};

/**
 * Get remaining time for OTP
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {Object} - Remaining time in minutes and seconds
 */
const getOtpRemainingTime = (expiryTime) => {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const diff = expiry - now;

  if (diff <= 0) {
    return {
      minutes: 0,
      seconds: 0,
      expired: true
    };
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    minutes,
    seconds,
    expired: false
  };
};

/**
 * Validate OTP format
 * @param {string} otp - OTP to validate
 * @returns {boolean} - True if valid format
 */
const isValidOtpFormat = (otp) => {
  return /^\d{6}$/.test(otp);
};

module.exports = {
  generateOtp,
  generateOtpExpiry,
  isOtpExpired,
  verifyOtp,
  formatOtp,
  generateEmailVerificationOtp,
  generatePasswordResetOtp,
  generateGeneralOtp,
  getOtpRemainingTime,
  isValidOtpFormat
};
