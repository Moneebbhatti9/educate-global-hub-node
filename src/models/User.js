const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },

  // Role and Status
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['teacher', 'school', 'admin', 'supplier', 'recruiter'],
    default: 'teacher'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },

  // Verification Flags
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  isAdminVerified: {
    type: Boolean,
    default: false
  },

  // Profile Information
  avatarUrl: {
    type: String,
    default: null
  },

  // Authentication
  otp: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timestamps
  lastLogin: {
    type: Date,
    default: null
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  adminVerifiedAt: {
    type: Date,
    default: null
  },
  profileCompletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes (email index is automatically created by unique: true)
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ isAdminVerified: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for isActive (combines all verification flags)
userSchema.virtual('isActive').get(function() {
  return this.isEmailVerified && this.isAdminVerified && this.status === 'active';
});

// Pre-save middleware to hash password if modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance method to check if OTP is valid
userSchema.methods.isOtpValid = function() {
  if (!this.otp.code || !this.otp.expiresAt) return false;
  return new Date() < this.otp.expiresAt;
};

// Instance method to clear OTP
userSchema.methods.clearOtp = function() {
  this.otp = { code: null, expiresAt: null };
  return this.save();
};

// Instance method to add refresh token
userSchema.methods.addRefreshToken = function(token, expiresAt) {
  this.refreshTokens.push({ token, expiresAt });
  return this.save();
};

// Instance method to remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

// Instance method to clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(rt => rt.expiresAt > now);
  return this.save();
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({
    isEmailVerified: true,
    isAdminVerified: true,
    status: 'active'
  });
};

// JSON transformation
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.otp;
  delete userObject.refreshTokens;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
