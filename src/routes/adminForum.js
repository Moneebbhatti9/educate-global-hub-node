const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  getForumStats,
  getAdminDiscussions,
  togglePin,
  toggleLock,
  deleteDiscussion,
} = require("../controllers/adminForumController");

router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

//  Forum overview
router.get("/stats", getForumStats);

//  Get discussions with filters
router.get("/list", getAdminDiscussions);

//  Pin/Unpin discussion
router.patch("/:id/pin", togglePin);

//  Lock/Unlock discussion
router.patch("/:id/lock", toggleLock);

//  Delete discussion
router.delete("/:id", deleteDiscussion);

module.exports = router;
