const { default: mongoose } = require("mongoose");
const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const { successResponse, errorResponse } = require("../utils/response");
const { createNotification } = require("./forumNotificationController");

exports.postReply = async (req, res) => {
  try {
    const { discussionId, content, parentReply, mentions } = req.body;

    if (!discussionId || !content?.trim()) {
      return errorResponse(res, "Discussion ID and content are required", 400);
    }

    // Check if discussion exists
    const discussion = await Discussion.findById(discussionId).populate(
      "createdBy",
      "_id"
    );
    if (!discussion) {
      return errorResponse(res, "Discussion not found", 404);
    }
    if (discussion.isLocked)
      return errorResponse(res, "Discussion is locked", 403);

    let depth = 0;
    let parentReplyData = null;

    // If parentReply provided, ensure it exists and belongs to same discussion
    if (parentReply) {
      parentReplyData = await Reply.findById(parentReply).populate(
        "createdBy",
        "_id"
      );
      if (
        !parentReplyData ||
        String(parentReplyData.discussion) !== String(discussionId)
      ) {
        return errorResponse(res, "Invalid parent reply", 400);
      }
      depth = (parentReplyData.depth || 0) + 1;
    }

    const reply = await Reply.create({
      discussion: discussionId,
      content: content.trim(),
      parentReply: parentReply || null,
      createdBy: req.user.userId,
      depth,
      mentions: mentions || [],
    });

    // Update discussion commentsCount and engagement score
    await Discussion.findByIdAndUpdate(discussionId, {
      $inc: { commentsCount: 1 },
      $set: {
        lastActivityAt: new Date(),
        engagementScore:
          discussion.likes.length * 2 +
          (discussion.commentsCount + 1) * 3 +
          discussion.views * 0.1,
      },
    });

    // Populate reply data for response
    await reply.populate("createdBy", "firstName lastName avatarUrl role");

    // Create notification for discussion owner (LinkedIn-style)
    let notification = null;
    if (!parentReply) {
      notification = await createNotification({
        recipient: discussion.createdBy._id,
        sender: req.user.userId,
        type: "comment",
        discussion: discussionId,
        comment: reply._id,
        message: `commented on your post "${discussion.title}"`,
      });
    } else {
      // Create notification for parent reply owner
      notification = await createNotification({
        recipient: parentReplyData.createdBy._id,
        sender: req.user.userId,
        type: "reply",
        discussion: discussionId,
        comment: reply._id,
        message: `replied to your comment`,
      });
    }

    // Create notifications for mentioned users
    if (mentions && mentions.length > 0) {
      for (const mentionedUserId of mentions) {
        const mentionNotification = await createNotification({
          recipient: mentionedUserId,
          sender: req.user.userId,
          type: "mention",
          discussion: discussionId,
          comment: reply._id,
          message: `mentioned you in a comment`,
        });

        // Emit mention notification in real-time
        const io = req.app.get("io");
        if (io && mentionNotification) {
          io.to(`user:${mentionedUserId}`).emit("notification:new", mentionNotification);
        }
      }
    }

    // Broadcast via socket to discussion room
    const io = req.app.get("io");
    if (io) {
      io.to(`discussion:${discussionId}`).emit("comment:new", reply);

      // Notify discussion/comment owner in real-time with full notification object
      const recipientId = parentReply ? parentReplyData.createdBy._id : discussion.createdBy._id;
      if (notification) {
        io.to(`user:${recipientId}`).emit("notification:new", notification);
      }
    }

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
      "firstName lastName avatarUrl _id"
    );
    if (!reply) return errorResponse(res, "Reply not found", 404);

    const alreadyLiked = reply.likes.includes(userId);
    let notification = null;
    if (alreadyLiked) {
      reply.likes.pull(userId);
    } else {
      reply.likes.push(userId);

      // Create notification for comment owner (LinkedIn-style)
      notification = await createNotification({
        recipient: reply.createdBy._id,
        sender: userId,
        type: "like",
        discussion: reply.discussion,
        comment: reply._id,
        message: `liked your comment`,
      });
    }

    await reply.save();

    // Broadcast like event to discussion room
    const io = req.app.get("io");
    if (io) {
      io.to(`discussion:${reply.discussion}`).emit("comment:updated", {
        commentId: id,
        likes: reply.likes.length,
      });

      // Real-time notification with full notification object
      if (!alreadyLiked && notification) {
        io.to(`user:${reply.createdBy._id}`).emit("notification:new", notification);
      }
    }

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
