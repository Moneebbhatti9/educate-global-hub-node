const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const { successResponse, errorResponse } = require("../utils/response");

// Forum overview stats
exports.getForumStats = async (req, res) => {
  try {
    const [
      totalDiscussions,
      activeDiscussions,
      reported,
      pinned,
      totalReplies,
    ] = await Promise.all([
      Discussion.countDocuments(),
      Discussion.countDocuments({ isActive: true }),
      Discussion.countDocuments({ "reports.0": { $exists: true } }),
      Discussion.countDocuments({ isPinned: true }),
      Reply.countDocuments(),
    ]);

    return successResponse(res, {
      totalDiscussions,
      active: activeDiscussions,
      reported,
      pinned,
      totalReplies,
    });
  } catch (err) {
    return errorResponse(res, "Failed to fetch forum stats", err);
  }
};

//  Admin list discussions with filters
exports.getAdminDiscussions = async (req, res) => {
  try {
    const {
      status,
      category,
      sortBy = "recent",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (status === "active") filter.isActive = true;
    if (status === "reported") filter["reports.0"] = { $exists: true };
    if (status === "pinned") filter.isPinned = true;
    if (category) filter.category = category;

    let sort = { createdAt: -1 };
    if (sortBy === "trending") sort = { views: -1 };
    if (sortBy === "recent") sort = { createdAt: -1 };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Discussion.find(filter)
        .populate("createdBy", "firstName lastName avatarUrl")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Discussion.countDocuments(filter),
    ]);

    return successResponse(res, { data, total, page, limit });
  } catch (err) {
    return errorResponse(res, "Failed to fetch admin discussions", err);
  }
};

//  Pin/Unpin discussion
exports.togglePin = async (req, res) => {
  try {
    const { id } = req.params;
    const discussion = await Discussion.findById(id);
    if (!discussion)
      return errorResponse(res, "Discussion not found", null, 404);

    discussion.isPinned = !discussion.isPinned;
    await discussion.save();

    return successResponse(res, {
      message: `Discussion ${
        discussion.isPinned ? "pinned" : "unpinned"
      } successfully`,
    });
  } catch (err) {
    return errorResponse(res, "Failed to update pin status", err);
  }
};

//  Lock/Unlock discussion
exports.toggleLock = async (req, res) => {
  try {
    const { id } = req.params;
    const discussion = await Discussion.findById(id);
    if (!discussion)
      return errorResponse(res, "Discussion not found", null, 404);

    discussion.isLocked = !discussion.isLocked;
    await discussion.save();

    return successResponse(res, {
      message: `Discussion ${
        discussion.isLocked ? "locked" : "unlocked"
      } successfully`,
    });
  } catch (err) {
    return errorResponse(res, "Failed to update lock status", err);
  }
};

// Soft delete discussion
exports.deleteDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const discussion = await Discussion.findById(id);
    if (!discussion)
      return errorResponse(res, "Discussion not found", null, 404);

    discussion.isActive = false; // keep data for audit
    await discussion.save();

    return successResponse(res, { message: "Discussion deleted successfully" });
  } catch (err) {
    return errorResponse(res, "Failed to delete discussion", err);
  }
};
