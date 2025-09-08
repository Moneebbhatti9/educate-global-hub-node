const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    discussion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      required: true,
    },
    content: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentReply: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reply",
      default: null,
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);
replySchema.index({ discussion: 1, createdAt: -1 });

module.exports = mongoose.model("Reply", replySchema);
