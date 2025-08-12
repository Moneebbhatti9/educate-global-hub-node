const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bio: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    roleSpecificData: {
      type: mongoose.Schema.Types.Mixed, // JSONB equivalent
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
userProfileSchema.index({ userId: 1 }, { unique: true });

// Virtual populate for user data
userProfileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included when converting to JSON
userProfileSchema.set("toJSON", { virtuals: true });
userProfileSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("UserProfile", userProfileSchema);
