const mongoose = require("mongoose");

const resourcePurchaseSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pricePaid: { type: Number, required: true }, // snapshot at time of purchase
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
    },
    purchasedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResourcePurchase", resourcePurchaseSchema);
