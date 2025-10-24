const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

/**
 * Review Routes
 * Base path: /api/v1/reviews
 */

// Public routes (anyone can view reviews)
router.get("/resource/:resourceId", reviewController.getResourceReviews);

// User review routes (authentication required)
router.post("/", authenticateToken, reviewController.createReview);
router.get("/my-reviews", authenticateToken, reviewController.getMyReviews);
router.put("/:reviewId", authenticateToken, reviewController.updateReview);
router.delete("/:reviewId", authenticateToken, reviewController.deleteReview);

// Review interaction routes (authentication required)
router.post("/:reviewId/helpful", authenticateToken, reviewController.markHelpful);
router.post("/:reviewId/not-helpful", authenticateToken, reviewController.markNotHelpful);
router.post("/:reviewId/flag", authenticateToken, reviewController.flagReview);

// Admin routes (admin only)
router.get(
  "/pending",
  authenticateToken,
  authorizeRoles(["admin"]),
  reviewController.getPendingReviews
);
router.post(
  "/:reviewId/approve",
  authenticateToken,
  authorizeRoles(["admin"]),
  reviewController.approveReview
);
router.post(
  "/:reviewId/reject",
  authenticateToken,
  authorizeRoles(["admin"]),
  reviewController.rejectReview
);

module.exports = router;
