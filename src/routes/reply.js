const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getRepliesForDiscussion,
  postReply,
  toggleLikeReply,
} = require("../controllers/replyController");

// Add a reply to a discussion (or nested reply)
router.post("/add-reply", authenticateToken, postReply);

// Get all replies for a discussion (with pagination)
router.get("/get-replies/:discussionId", getRepliesForDiscussion);

// Like or unlike a reply
router.patch("/toggle-like/:id", authenticateToken, toggleLikeReply);

module.exports = router;
