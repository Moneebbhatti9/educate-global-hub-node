const express = require("express");
const {
  createDiscussion,
  toggleLikeDiscussion,
  getAllDiscussions,
  getDiscussionById,
  getDiscussionFeed,
  getDiscussionStats,
  getTrendingTopics,
  getRelatedDiscussions,
  reportDiscussion,
  getCategoryStats,
  getCommunityOverview,
} = require("../controllers/discussionController");

const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Create new discussion
router.post("/create-discussion", authenticateToken, createDiscussion);

// Like/unlike a discussion
router.post("/:id/like", authenticateToken, toggleLikeDiscussion);

// Report a discussion
router.post("/:id/report", authenticateToken, reportDiscussion);

// Fetch all discussions (for admin/debug, not usually used on frontend feed)
router.get("/get-all-discussions", getAllDiscussions);

// Get single discussion (with replies + pagination)
router.get("/get-specific-discussion/:id", getDiscussionById);

// Discussion feed with tabs (trending, recent, unanswered)
router.get("/feed", getDiscussionFeed);

// Stats (total discussions, replies, optional daily breakdown)
router.get("/overview", getDiscussionStats);

// Trending topics
router.get("/trending", getTrendingTopics);

// Related discussions (by category)
router.get("/:id/related", getRelatedDiscussions);

router.get("/categories/stats", getCategoryStats); // Category stats with posts & unique members

router.get("/community/overview", getCommunityOverview); // Community overview with members, discussions, replies

module.exports = router;
