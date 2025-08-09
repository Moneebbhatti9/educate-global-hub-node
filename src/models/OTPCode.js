const mongoose = require("mongoose");

const otpCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otpCode: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["verification", "reset"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
otpCodeSchema.index({ email: 1, type: 1 });
otpCodeSchema.index({ expiresAt: 1 });
otpCodeSchema.index({ isUsed: 1 });

// TTL index to automatically delete expired OTPs
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if OTP is expired
otpCodeSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Method to mark OTP as used
otpCodeSchema.methods.markAsUsed = function () {
  this.isUsed = true;
  return this.save();
};

// Static method to find valid OTP
otpCodeSchema.statics.findValidOTP = function (email, otpCode, type) {
  return this.findOne({
    email,
    otpCode,
    type,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model("OTPCode", otpCodeSchema);
