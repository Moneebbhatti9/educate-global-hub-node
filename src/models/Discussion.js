const mongoose = require("mongoose");

const discussionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String }, // full description or question body
    category: {
      type: String,
      enum: [
        "Teaching Tips & Strategies",
        "Curriculum & Resources",
        "Career Advice",
        "Help & Support",
      ],
      required: true,
    },
    tags: [{ type: String }], // e.g. ["mathematics", "engagement"]
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    views: { type: Number, default: 0 }, // track discussion views
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    reports: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // LinkedIn-style enhancements
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ], // Optional post images
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Tagged users
    commentsCount: {
      type: Number,
      default: 0,
    }, // Denormalized for performance
    lastActivityAt: {
      type: Date,
      default: Date.now,
    }, // For "trending" algorithm
    engagementScore: {
      type: Number,
      default: 0,
    }, // Calculated: likes + comments + views weighted
  },
  { timestamps: true }
);
discussionSchema.index({ createdAt: -1 });
discussionSchema.index({ views: -1 });
discussionSchema.index({ category: 1 });
discussionSchema.index({ tags: 1 });
discussionSchema.index({ isPinned: -1, createdAt: -1 });
discussionSchema.index({ isLocked: 1, isActive: 1 });
// LinkedIn-style indexes for performance
discussionSchema.index({ engagementScore: -1, lastActivityAt: -1 });
discussionSchema.index({ mentions: 1 });
discussionSchema.index({ lastActivityAt: -1 });

module.exports = mongoose.model("Discussion", discussionSchema);
