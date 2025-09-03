const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getRepliesForDiscussion,
  postReply,
} = require("../controllers/replyController");

router.post("/add-reply", authenticateToken, postReply);
router.get("/get-replies/:discussionId", getRepliesForDiscussion);

module.exports = router;
