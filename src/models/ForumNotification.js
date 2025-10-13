const mongoose = require("mongoose");

/**
 * ForumNotification Schema - LinkedIn-style notifications for forum interactions
 * Handles like, comment, reply, and mention notifications
 */
const forumNotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "comment", "reply", "mention"],
      required: true,
    },
    discussion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reply",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    message: {
      type: String, // Pre-formatted message for quick display
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
forumNotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
forumNotificationSchema.index({ recipient: 1, createdAt: -1 });

// Auto-expire old read notifications after 30 days
forumNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isRead: true } }
);

module.exports = mongoose.model("ForumNotification", forumNotificationSchema);
