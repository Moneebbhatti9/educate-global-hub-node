const mongoose = require("mongoose");

const schoolMediaSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolProfile",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "document"],
      default: "image",
    },
    caption: {
      type: String,
      trim: true,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    size: {
      type: Number, // in bytes
      default: 0,
    },
    format: {
      type: String,
      default: null,
    },
    width: Number,
    height: Number,
  },
  { timestamps: true }
);

// Index for faster queries
schoolMediaSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model("SchoolMedia", schoolMediaSchema);
