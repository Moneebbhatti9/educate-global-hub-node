const mongoose = require("mongoose");

const resourceFileSchema = new mongoose.Schema(
  {
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource" },
    fileType: {
      type: String,
      enum: ["cover", "preview", "main"],
      required: true,
    },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: {
      size: Number,
      format: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResourceFile", resourceFileSchema);
