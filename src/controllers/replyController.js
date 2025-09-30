const { default: mongoose } = require("mongoose");
const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const { successResponse, errorResponse } = require("../utils/response");

exports.postReply = async (req, res) => {
  try {
    const { discussionId, content, parentReply } = req.body;

    if (!discussionId || !content?.trim()) {
      return errorResponse(res, "Discussion ID and content are required", 400);
    }

    // Check if discussion exists
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return errorResponse(res, "Discussion not found", 404);
    }
    if (discussion.isLocked)
      return errorResponse(res, "Discussion is locked", 403);

    // If parentReply provided, ensure it exists and belongs to same discussion
    if (parentReply) {
      const parent = await Reply.findById(parentReply);
      if (!parent || String(parent.discussion) !== String(discussionId)) {
        return errorResponse(res, "Invalid parent reply", 400);
      }
    }

    const reply = await Reply.create({
      discussion: discussionId,
      content: content.trim(),
      parentReply: parentReply || null,
      createdBy: req.user.userId,
    });

    // Broadcast via socket
    const io = req.app.get("io");
    if (io) io.emit("newReply", reply);

    return successResponse(res, reply, "Reply posted successfully", 201);
  } catch (err) {
    console.error("postReply error:", err);
    return errorResponse(res, "Failed to post reply", 500);
  }
};

exports.getRepliesForDiscussion = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    const replies = await Reply.aggregate([
      {
        $match: {
          discussion: new mongoose.Types.ObjectId(discussionId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      {
        $lookup: {
          from: "replies",
          let: { parentId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$parentReply", "$$parentId"] } } },
            {
              $lookup: {
                from: "users",
                localField: "createdBy",
                foreignField: "_id",
                as: "author",
              },
            },
            { $unwind: "$author" },
          ],
          as: "children",
        },
      },
      { $sort: { createdAt: 1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]);

    const total = await Reply.countDocuments({ discussion: discussionId });

    return successResponse(
      res,
      {
        page: pageNum,
        limit: pageSize,
        total,
        data: replies,
      },
      "Replies fetched successfully"
    );
  } catch (err) {
    console.error("getRepliesForDiscussion error:", err);
    return errorResponse(res, "Failed to fetch replies", 500);
  }
};

//   try {
//     const { discussionId } = req.params;
//     const { page = 1, limit = 10 } = req.query;

//     const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//     const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
//     const skip = (pageNum - 1) * pageSize;

//     const replies = await Reply.find({ discussion: discussionId })
//       .populate("createdBy", "firstName lastName avatarUrl")
//       .populate({
//         path: "parentReply",
//         select: "content createdBy",
//         populate: {
//           path: "createdBy",
//           select: "firstName lastName avatarUrl",
//         },
//       })
//       .sort({ createdAt: 1 })
//       .skip(skip)
//       .limit(pageSize);

//     const total = await Reply.countDocuments({ discussion: discussionId });

//     return successResponse(
//       res,
//       {
//         page: pageNum,
//         limit: pageSize,
//         total,
//         data: replies,
//       },
//       "Replies fetched succesfully"
//     );
//   } catch (err) {
//     console.error("getRepliesForDiscussion error:", err);
//     return errorResponse(res, "Failed to fetch replies", 500);
//   }
// };

exports.toggleLikeReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const reply = await Reply.findById(id).populate(
      "createdBy",
      "firstName lastName avatarUrl"
    );
    if (!reply) return errorResponse(res, "Reply not found", 404);

    const alreadyLiked = reply.likes.includes(userId);
    if (alreadyLiked) {
      reply.likes.pull(userId);
    } else {
      reply.likes.push(userId);
    }

    await reply.save();

    // Broadcast like event
    const io = req.app.get("io");
    if (io) io.emit("likeReply", { replyId: id, userId, liked: !alreadyLiked });

    return successResponse(
      res,
      {
        replyId: id,
        likeCount: reply.likes.length,
        liked: !alreadyLiked,
      },
      "Like status updated!"
    );
  } catch (err) {
    console.error("toggleLikeReply error:", err);
    return errorResponse(res, "Failed to like reply", 500);
  }
};
