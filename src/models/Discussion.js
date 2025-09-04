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
  },
  { timestamps: true }
);
discussionSchema.index({ createdAt: -1 });
discussionSchema.index({ views: -1 });
discussionSchema.index({ category: 1 });
discussionSchema.index({ tags: 1 });

module.exports = mongoose.model("Discussion", discussionSchema);
