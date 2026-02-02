const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { isValidPhoneNumber } = require("../utils/phoneUtils");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["teacher", "school", "recruiter", "supplier", "admin"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "pending",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    // KYC status tracking
    kycStatus: {
      type: String,
      enum: ["not_submitted", "pending", "under_review", "approved", "rejected", "resubmission_required"],
      default: "not_submitted",
    },
    kycSubmittedAt: {
      type: Date,
      default: null,
    },
    kycApprovedAt: {
      type: Date,
      default: null,
    },
    kycRejectionReason: {
      type: String,
      default: null,
    },
    // 2FA settings
    is2FAEnabled: {
      type: Boolean,
      default: true, // Enabled by default for all users
    },
    twoFactorMethod: {
      type: String,
      enum: ["email", "sms"],
      default: "email",
    },
    // Session management
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    accountLockedUntil: {
      type: Date,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
      validate: {
        validator: function (value) {
          // Allow null/undefined values (optional field)
          if (!value) return true;
          return isValidPhoneNumber(value);
        },
        message: "Phone number must include country code (e.g., +1234567890)",
      },
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    // Stripe-related fields
    stripeCustomerId: {
      type: String,
      sparse: true,
      index: true,
      default: null,
    },
    // Stripe Connect account ID (for sellers receiving payouts)
    stripeAccountId: {
      type: String,
      sparse: true,
      index: true,
      default: null,
    },
    stripeAccountStatus: {
      type: String,
      enum: ["pending", "active", "restricted", "disabled", null],
      default: null,
    },
    // GDPR-related fields
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    deletionReason: {
      type: String,
      default: null,
    },
    inactivityWarningAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// Note: email index is automatically created by unique: true constraint
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ lastActive: 1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ lastLoginAt: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual populate for teacher profile
userSchema.virtual("teacherProfile", {
  ref: "TeacherProfile",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Virtual populate for school profile
userSchema.virtual("schoolProfile", {
  ref: "SchoolProfile",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Virtual populate for KYC submission
userSchema.virtual("kycSubmission", {
  ref: "KYCSubmission",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to hash password
userSchema.methods.hashPassword = async function (password) {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

// Pre-save middleware to hash password if modified
userSchema.pre("save", async function (next) {
  if (this.isModified("passwordHash")) {
    // Password is already hashed when passed to this model
    next();
  } else {
    next();
  }
});

// Pre-save middleware to ensure phone number has country code
userSchema.pre("save", function (next) {
  if (this.phone && !this.phone.startsWith("+")) {
    // If phone number doesn't start with +, we can't auto-format without country info
    // This will be caught by the validation and show an error
    next();
  } else {
    next();
  }
});

// Method to sanitize user data for response
userSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function () {
  if (!this.accountLockedUntil) return false;
  return new Date() < this.accountLockedUntil;
};

// Method to increment failed login attempts
userSchema.methods.incrementFailedAttempts = async function () {
  this.failedLoginAttempts += 1;
  // Lock account after 5 failed attempts for 30 minutes
  if (this.failedLoginAttempts >= 5) {
    this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  return this.save();
};

// Method to reset failed login attempts
userSchema.methods.resetFailedAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.accountLockedUntil = null;
  this.lastLoginAt = new Date();
  return this.save();
};

// Method to update KYC status
userSchema.methods.updateKYCStatus = async function (status, reason = null) {
  this.kycStatus = status;
  if (status === "pending" || status === "under_review") {
    this.kycSubmittedAt = this.kycSubmittedAt || new Date();
  } else if (status === "approved") {
    this.kycApprovedAt = new Date();
    this.kycRejectionReason = null;
  } else if (status === "rejected" || status === "resubmission_required") {
    this.kycRejectionReason = reason;
  }
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
