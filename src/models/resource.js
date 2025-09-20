const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: { type: String },

    type: {
      type: String,
      enum: [
        "worksheet",
        "assessment",
        "lesson plan",
        "presentation",
        "scheme of work",
        "display",
        "activity",
        "game",
        "video",
        "other",
      ],
      required: true,
    },

    license: {
      type: String,
      enum: [
        "single teacher license",
        "school license",
        "multiple use license",
        "commercial license",
      ],
      required: true,
    },

    isFree: { type: Boolean, default: false }, // Conditional validation for currency and price
    currency: {
      type: String,
      enum: ["USD", "EUR", "GBP", "PKR"],
      validate: {
        validator: function (v) {
          return this.isFree || (v !== undefined && v !== null);
        },
        message: "Currency is required for non-free resources.",
      },
    },
    price: {
      type: Number,
      validate: {
        validator: function (v) {
          return this.isFree || (v !== undefined && v !== null);
        },
        message: "Price is required for non-free resources.",
      },
    },

    publishing: {
      type: String,
      enum: ["public", "private", "school only", "unlisted"],
      default: "private",
    },

    createdBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        enum: ["teacher", "school", "admin"],
        required: true,
      },
    },

    // File references
    coverPhoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResourceFile",
      required: true,
    },
    previewImages: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ResourceFile" },
    ],
    mainFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResourceFile",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

resourceSchema.index({ "createdBy.userId": 1 });
resourceSchema.index({ status: 1 });
resourceSchema.index({ type: 1 });

module.exports = mongoose.model("Resource", resourceSchema);
