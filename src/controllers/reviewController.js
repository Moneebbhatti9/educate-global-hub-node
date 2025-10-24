const mongoose = require("mongoose");
const Review = require("../models/Review");
const Sale = require("../models/Sale");
const Resource = require("../models/resource");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");

/**
 * Create a review
 * POST /api/v1/reviews
 */
async function createReview(req, res, next) {
  try {
    const { resourceId, saleId, rating, comment } = req.body;
    const reviewerId = req.user.userId;

    // Validate required fields
    if (!resourceId || !rating) {
      return errorResponse(res, "Resource ID and rating are required", 400);
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return errorResponse(res, "Rating must be between 1 and 5", 400);
    }

    // Convert to ObjectId
    const resourceObjectId = new mongoose.Types.ObjectId(resourceId);
    const reviewerObjectId = new mongoose.Types.ObjectId(reviewerId);

    // Check if resource exists
    const resource = await Resource.findById(resourceObjectId);
    if (!resource) {
      return notFoundResponse(res, "Resource not found");
    }

    // Check if user can review (has purchased and hasn't reviewed yet)
    const canReview = await Review.canUserReview(reviewerId, resourceId);
    if (!canReview.canReview) {
      return errorResponse(res, canReview.reason, 400);
    }

    // Use the sale ID from the check or from request
    const finalSaleId = saleId || canReview.saleId;
    if (!finalSaleId) {
      return errorResponse(res, "Sale reference not found", 400);
    }

    // Create review
    const review = await Review.create({
      resource: resourceObjectId,
      reviewer: reviewerObjectId,
      sale: new mongoose.Types.ObjectId(finalSaleId),
      rating,
      comment: comment || "",
      status: "approved", // Auto-approve for now
      reviewDate: new Date(),
    });

    // Populate reviewer info
    await review.populate("reviewer", "firstName lastName avatar");

    return successResponse(
      res,
      {
        review,
        message: "Thank you for your review!",
      },
      "Review submitted successfully",
      201
    );
  } catch (error) {
    console.error("Create review error:", error);

    // Handle duplicate review error
    if (error.code === 11000) {
      return errorResponse(
        res,
        "You have already reviewed this resource",
        400
      );
    }

    return errorResponse(res, error.message || "Failed to submit review", 500);
  }
}

/**
 * Get reviews for a resource
 * GET /api/v1/reviews/resource/:resourceId
 */
async function getResourceReviews(req, res, next) {
  try {
    const { resourceId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "reviewDate",
      sortOrder = "desc",
      minRating = 1,
    } = req.query;

    // Validate resource ID
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      return errorResponse(res, "Invalid resource ID", 400);
    }

    // Get reviews
    const result = await Review.getResourceReviews(resourceId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      minRating: parseInt(minRating),
    });

    // Get rating summary
    const ratingSummary = await Review.getResourceRating(resourceId);

    return successResponse(res, {
      reviews: result.reviews,
      pagination: result.pagination,
      summary: ratingSummary,
    });
  } catch (error) {
    console.error("Get resource reviews error:", error);
    return errorResponse(
      res,
      error.message || "Failed to fetch reviews",
      500
    );
  }
}

/**
 * Get user's reviews
 * GET /api/v1/reviews/my-reviews
 */
async function getMyReviews(req, res, next) {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const result = await Review.getUserReviews(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return successResponse(res, {
      reviews: result.reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get my reviews error:", error);
    return errorResponse(
      res,
      error.message || "Failed to fetch your reviews",
      500
    );
  }
}

/**
 * Update a review
 * PUT /api/v1/reviews/:reviewId
 */
async function updateReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.userId;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    // Check if user owns the review
    if (review.reviewer.toString() !== userId) {
      return errorResponse(res, "You can only update your own reviews", 403);
    }

    // Update review
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return errorResponse(res, "Rating must be between 1 and 5", 400);
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    // Reset status to pending if it was rejected
    if (review.status === "rejected") {
      review.status = "pending";
    }

    await review.save();
    await review.populate("reviewer", "firstName lastName avatar");

    return successResponse(
      res,
      { review },
      "Review updated successfully"
    );
  } catch (error) {
    console.error("Update review error:", error);
    return errorResponse(res, error.message || "Failed to update review", 500);
  }
}

/**
 * Delete a review
 * DELETE /api/v1/reviews/:reviewId
 */
async function deleteReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    // Check if user owns the review
    if (review.reviewer.toString() !== userId) {
      return errorResponse(res, "You can only delete your own reviews", 403);
    }

    // Delete review
    await Review.findByIdAndDelete(reviewId);

    return successResponse(res, null, "Review deleted successfully");
  } catch (error) {
    console.error("Delete review error:", error);
    return errorResponse(res, error.message || "Failed to delete review", 500);
  }
}

/**
 * Mark review as helpful
 * POST /api/v1/reviews/:reviewId/helpful
 */
async function markHelpful(req, res, next) {
  try {
    const { reviewId } = req.params;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    await review.markHelpful();

    return successResponse(
      res,
      { helpful: review.helpful },
      "Marked as helpful"
    );
  } catch (error) {
    console.error("Mark helpful error:", error);
    return errorResponse(
      res,
      error.message || "Failed to mark as helpful",
      500
    );
  }
}

/**
 * Mark review as not helpful
 * POST /api/v1/reviews/:reviewId/not-helpful
 */
async function markNotHelpful(req, res, next) {
  try {
    const { reviewId } = req.params;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    await review.markNotHelpful();

    return successResponse(
      res,
      { notHelpful: review.notHelpful },
      "Marked as not helpful"
    );
  } catch (error) {
    console.error("Mark not helpful error:", error);
    return errorResponse(
      res,
      error.message || "Failed to mark as not helpful",
      500
    );
  }
}

/**
 * Flag review (for moderation)
 * POST /api/v1/reviews/:reviewId/flag
 */
async function flagReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    if (!reason) {
      return errorResponse(res, "Reason is required for flagging", 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    await review.flagReview(reason);

    return successResponse(res, null, "Review flagged for moderation");
  } catch (error) {
    console.error("Flag review error:", error);
    return errorResponse(res, error.message || "Failed to flag review", 500);
  }
}

/**
 * Approve review (Admin only)
 * POST /api/v1/reviews/:reviewId/approve
 */
async function approveReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const adminId = req.user.userId;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    await review.approveReview(adminId);

    return successResponse(res, { review }, "Review approved");
  } catch (error) {
    console.error("Approve review error:", error);
    return errorResponse(res, error.message || "Failed to approve review", 500);
  }
}

/**
 * Reject review (Admin only)
 * POST /api/v1/reviews/:reviewId/reject
 */
async function rejectReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    // Validate review ID
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return errorResponse(res, "Invalid review ID", 400);
    }

    if (!reason) {
      return errorResponse(res, "Rejection reason is required", 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return notFoundResponse(res, "Review not found");
    }

    await review.rejectReview(adminId, reason);

    return successResponse(res, { review }, "Review rejected");
  } catch (error) {
    console.error("Reject review error:", error);
    return errorResponse(res, error.message || "Failed to reject review", 500);
  }
}

/**
 * Get pending reviews (Admin only)
 * GET /api/v1/reviews/pending
 */
async function getPendingReviews(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;

    const reviews = await Review.find({ status: "pending" })
      .populate("resource", "title coverPhoto")
      .populate("reviewer", "firstName lastName avatar")
      .sort({ reviewDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments({ status: "pending" });

    return successResponse(res, {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get pending reviews error:", error);
    return errorResponse(
      res,
      error.message || "Failed to fetch pending reviews",
      500
    );
  }
}

module.exports = {
  createReview,
  getResourceReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markHelpful,
  markNotHelpful,
  flagReview,
  approveReview,
  rejectReview,
  getPendingReviews,
};
