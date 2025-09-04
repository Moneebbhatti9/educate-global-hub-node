const express = require("express");
const {
  createDiscussion,
  getAllDiscussions,
  getDiscussionById,
  getDiscussionFeed,
  getDiscussionStats,
  getTrendingTopics,
} = require("../controllers/discussionController");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

router.post("/create-discussion", authenticateToken, createDiscussion);
router.get("/get-all-discussions", getAllDiscussions);
router.get("/get-specific-discussion/:id", getDiscussionById);
router.get("/feed", getDiscussionFeed);
router.get("/overview", getDiscussionStats);
router.get("/trending", getTrendingTopics);

module.exports = router;
