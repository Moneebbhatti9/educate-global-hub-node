const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshToken",
      required: true,
    },
    // Device and browser info
    deviceInfo: {
      userAgent: { type: String },
      browser: { type: String },
      os: { type: String },
      device: { type: String },
      isMobile: { type: Boolean, default: false },
    },
    // IP and location
    ipAddress: {
      type: String,
      required: true,
    },
    location: {
      country: { type: String },
      city: { type: String },
      region: { type: String },
    },
    // Session status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Activity tracking
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    // Session expiry (30 min inactivity timeout)
    expiresAt: {
      type: Date,
      required: true,
    },
    // Login timestamp
    loginAt: {
      type: Date,
      default: Date.now,
    },
    // Logout info
    logoutAt: {
      type: Date,
      default: null,
    },
    logoutReason: {
      type: String,
      enum: ["user_logout", "inactivity_timeout", "token_expired", "forced_logout", "password_changed", "security_concern"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
sessionSchema.index({ isActive: 1 });
sessionSchema.index({ lastActivityAt: 1 });
sessionSchema.index({ expiresAt: 1 });
sessionSchema.index({ userId: 1, isActive: 1 });

// TTL index to automatically clean up old sessions (after 30 days)
sessionSchema.index({ logoutAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { logoutAt: { $exists: true } } });

// Method to check if session has timed out due to inactivity
sessionSchema.methods.hasTimedOut = function (inactivityTimeoutMs = 30 * 60 * 1000) {
  const now = new Date();
  const lastActivity = new Date(this.lastActivityAt);
  return (now - lastActivity) > inactivityTimeoutMs;
};

// Method to update activity timestamp
sessionSchema.methods.updateActivity = async function () {
  this.lastActivityAt = new Date();
  // Extend session expiry by 30 minutes from now
  this.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  return this.save();
};

// Method to end session
sessionSchema.methods.endSession = async function (reason = "user_logout") {
  this.isActive = false;
  this.logoutAt = new Date();
  this.logoutReason = reason;
  return this.save();
};

// Static method to find active session by user and refresh token
sessionSchema.statics.findActiveSession = function (userId, refreshTokenId) {
  return this.findOne({
    userId,
    refreshTokenId,
    isActive: true,
  });
};

// Static method to get all active sessions for a user
sessionSchema.statics.getActiveSessions = function (userId) {
  return this.find({
    userId,
    isActive: true,
  }).sort({ lastActivityAt: -1 });
};

// Static method to end all sessions for a user
sessionSchema.statics.endAllSessions = async function (userId, reason = "forced_logout") {
  return this.updateMany(
    { userId, isActive: true },
    {
      isActive: false,
      logoutAt: new Date(),
      logoutReason: reason,
    }
  );
};

// Static method to end all sessions except current
sessionSchema.statics.endOtherSessions = async function (userId, currentSessionId, reason = "forced_logout") {
  return this.updateMany(
    { userId, isActive: true, _id: { $ne: currentSessionId } },
    {
      isActive: false,
      logoutAt: new Date(),
      logoutReason: reason,
    }
  );
};

// Static method to clean up timed out sessions
sessionSchema.statics.cleanupTimedOutSessions = async function () {
  const inactivityTimeout = 30 * 60 * 1000; // 30 minutes
  const cutoffTime = new Date(Date.now() - inactivityTimeout);

  return this.updateMany(
    {
      isActive: true,
      lastActivityAt: { $lt: cutoffTime },
    },
    {
      isActive: false,
      logoutAt: new Date(),
      logoutReason: "inactivity_timeout",
    }
  );
};

// Static method to get session statistics for admin
sessionSchema.statics.getStatistics = async function () {
  const now = new Date();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [activeCount, last24HoursCount, last7DaysCount, byDevice] = await Promise.all([
    this.countDocuments({ isActive: true }),
    this.countDocuments({ loginAt: { $gte: last24Hours } }),
    this.countDocuments({ loginAt: { $gte: last7Days } }),
    this.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$deviceInfo.device",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    activeSessions: activeCount,
    sessionsLast24Hours: last24HoursCount,
    sessionsLast7Days: last7DaysCount,
    byDevice,
  };
};

module.exports = mongoose.model("Session", sessionSchema);
