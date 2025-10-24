const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // Resource being reviewed
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: [true, "Resource is required"],
      index: true,
    },

    // Reviewer (buyer)
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reviewer is required"],
      index: true,
    },

    // Associated sale (ensures only purchasers can review)
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: [true, "Sale reference is required"],
      index: true,
    },

    // Rating (1-5 stars)
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },

    // Review comment
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },

    // Review status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // Auto-approve for now, can be changed to "pending" for moderation
    },

    // Moderation
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: {
      type: Date,
    },
    moderationReason: {
      type: String,
    },

    // Helpful votes
    helpful: {
      type: Number,
      default: 0,
    },
    notHelpful: {
      type: Number,
      default: 0,
    },

    // Flagged for review
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
    },

    // Review date
    reviewDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one review per sale
reviewSchema.index({ resource: 1, reviewer: 1, sale: 1 }, { unique: true });

// Index for fetching approved reviews
reviewSchema.index({ resource: 1, status: 1, rating: -1 });

// Methods

/**
 * Mark review as helpful
 */
reviewSchema.methods.markHelpful = async function () {
  this.helpful += 1;
  return await this.save();
};

/**
 * Mark review as not helpful
 */
reviewSchema.methods.markNotHelpful = async function () {
  this.notHelpful += 1;
  return await this.save();
};

/**
 * Flag review for moderation
 */
reviewSchema.methods.flagReview = async function (reason) {
  this.flagged = true;
  this.flagReason = reason;
  this.status = "pending";
  return await this.save();
};

/**
 * Approve review
 */
reviewSchema.methods.approveReview = async function (moderatorId) {
  this.status = "approved";
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.flagged = false;
  return await this.save();
};

/**
 * Reject review
 */
reviewSchema.methods.rejectReview = async function (moderatorId, reason) {
  this.status = "rejected";
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.moderationReason = reason;
  return await this.save();
};

// Static Methods

/**
 * Get average rating for a resource
 */
reviewSchema.statics.getResourceRating = async function (resourceId) {
  const result = await this.aggregate([
    {
      $match: {
        resource: new mongoose.Types.ObjectId(resourceId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$resource",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratings: {
          $push: "$rating",
        },
      },
    },
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  // Calculate rating distribution
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  result[0].ratings.forEach((rating) => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
    totalReviews: result[0].totalReviews,
    distribution,
  };
};

/**
 * Get reviews for a resource
 */
reviewSchema.statics.getResourceReviews = async function (
  resourceId,
  options = {}
) {
  const {
    page = 1,
    limit = 10,
    sortBy = "reviewDate",
    sortOrder = "desc",
    minRating = 1,
    status = "approved",
  } = options;

  const query = {
    resource: new mongoose.Types.ObjectId(resourceId),
    status,
  };

  if (minRating > 1) {
    query.rating = { $gte: minRating };
  }

  const reviews = await this.find(query)
    .populate("reviewer", "firstName lastName avatar")
    .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Check if user has purchased and can review
 */
reviewSchema.statics.canUserReview = async function (userId, resourceId) {
  const Sale = mongoose.model("Sale");

  // Check if user has purchased the resource
  const purchase = await Sale.findOne({
    buyer: userId,
    resource: resourceId,
    status: "completed",
  });

  if (!purchase) {
    return { canReview: false, reason: "You must purchase the resource first" };
  }

  // Check if user has already reviewed
  const existingReview = await this.findOne({
    reviewer: userId,
    resource: resourceId,
  });

  if (existingReview) {
    return {
      canReview: false,
      reason: "You have already reviewed this resource",
      existingReview,
    };
  }

  return { canReview: true, saleId: purchase._id };
};

/**
 * Get user's reviews
 */
reviewSchema.statics.getUserReviews = async function (userId, options = {}) {
  const { page = 1, limit = 10 } = options;

  const reviews = await this.find({ reviewer: userId })
    .populate("resource", "title coverPhoto type")
    .sort({ reviewDate: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await this.countDocuments({ reviewer: userId });

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Hooks

// After saving a review, update resource average rating
reviewSchema.post("save", async function () {
  if (this.status === "approved") {
    try {
      const Resource = mongoose.model("Resource");
      const rating = await this.constructor.getResourceRating(this.resource);
      await Resource.findByIdAndUpdate(this.resource, {
        rating: rating.averageRating,
        reviewCount: rating.totalReviews,
      });
    } catch (error) {
      console.error("Error updating resource rating:", error);
    }
  }
});

// After deleting a review, update resource average rating
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.status === "approved") {
    try {
      const Resource = mongoose.model("Resource");
      const rating = await doc.constructor.getResourceRating(doc.resource);
      await Resource.findByIdAndUpdate(doc.resource, {
        rating: rating.averageRating,
        reviewCount: rating.totalReviews,
      });
    } catch (error) {
      console.error("Error updating resource rating after deletion:", error);
    }
  }
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
