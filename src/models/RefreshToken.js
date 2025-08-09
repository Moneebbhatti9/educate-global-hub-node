const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ tokenHash: 1 });
refreshTokenSchema.index({ expiresAt: 1 });
refreshTokenSchema.index({ isRevoked: 1 });

// TTL index to automatically delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if token is expired
refreshTokenSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Method to revoke token
refreshTokenSchema.methods.revoke = function () {
  this.isRevoked = true;
  return this.save();
};

// Static method to find valid token
refreshTokenSchema.statics.findValidToken = function (userId) {
  return this.findOne({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllForUser = function (userId) {
  return this.updateMany({ userId }, { isRevoked: true });
};

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
