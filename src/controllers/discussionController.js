const { default: mongoose } = require("mongoose");
const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const { successResponse, errorResponse } = require("../utils/response");
const { createNotification } = require("./forumNotificationController");
const { cloudinary } = require("../config/cloudinary");

exports.createDiscussion = async (req, res) => {
  try {
    const { title, content, category, tags, images } = req.body;

    if (!title || !category) {
      return errorResponse(res, "Title and category are required", 400);
    }

    const allowedCategories = [
      "Teaching Tips & Strategies",
      "Curriculum & Resources",
      "Career Advice",
      "Help & Support",
    ];
    if (!allowedCategories.includes(category)) {
      return errorResponse(res, "Invalid category", 400);
    }

    // Handle image uploads to Cloudinary
    const uploadedImages = [];
    if (images && Array.isArray(images) && images.length > 0) {
      for (const imageData of images.slice(0, 4)) { // Max 4 images
        try {
          const uploadResponse = await cloudinary.uploader.upload(imageData, {
            folder: "forum_posts",
            resource_type: "auto",
            transformation: [
              { width: 1200, height: 1200, crop: "limit" },
              { quality: "auto:good" },
              { fetch_format: "auto" }
            ]
          });

          uploadedImages.push({
            url: uploadResponse.secure_url,
            publicId: uploadResponse.public_id,
          });
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
          // Continue with other images if one fails
        }
      }
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      content: content?.trim() || "",
      category,
      tags: Array.isArray(tags) ? tags : [],
      images: uploadedImages,
      createdBy: req.user.userId,
    });
    await discussion.populate("createdBy", "firstName lastName avatarUrl");
    const io = req.app.get("io");
    if (io) io.emit("newDiscussion", discussion);

    return successResponse(res, discussion, "Discussion created successfully");
  } catch (err) {
    console.log(err);
    return errorResponse(res, "Failed to create discussion", 500);
  }
};

exports.toggleLikeDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const discussion = await Discussion.findById(id).populate(
      "createdBy",
      "firstName lastName avatarUrl"
    );
    if (!discussion) return errorResponse(res, "Discussion not found", 404);

    const alreadyLiked = discussion.likes.includes(userId);
    if (alreadyLiked) {
      discussion.likes.pull(userId);
    } else {
      discussion.likes.push(userId);

      // Create notification for post owner (LinkedIn-style)
      await createNotification({
        recipient: discussion.createdBy._id,
        sender: userId,
        type: "like",
        discussion: discussion._id,
        message: `liked your post "${discussion.title}"`,
      });

      // Emit real-time event via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${discussion.createdBy._id}`).emit("notification:new", {
          type: "like",
          message: `Someone liked your post "${discussion.title}"`,
        });
      }
    }

    // Update engagement score
    discussion.engagementScore =
      discussion.likes.length * 2 +
      discussion.commentsCount * 3 +
      discussion.views * 0.1;
    discussion.lastActivityAt = new Date();

    await discussion.save();

    // Broadcast updated like count to all users viewing this discussion
    const io = req.app.get("io");
    if (io) {
      io.to(`discussion:${id}`).emit("post:updated", {
        discussionId: id,
        likes: discussion.likes.length,
      });
    }

    return successResponse(
      res,
      {
        likeCount: discussion.likes.length,
        liked: !alreadyLiked,
      },
      "Like updated successfully"
    );
  } catch (err) {
    console.error("toggleLikeDiscussion error:", err);
    return errorResponse(res, "Failed to like discussion", 500);
  }
};

exports.reportDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return errorResponse(res, "Report reason is required", 400);
    }

    const discussion = await Discussion.findByIdAndUpdate(
      id,
      {
        $push: {
          reports: {
            user: req.user.userId,
            reason,
            reportedAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate("createdBy", "firstName lastName avatarUrl");

    if (!discussion) return errorResponse(res, "Discussion not found", 404);

    return successResponse(res, discussion, "Discussion reported successfully");
  } catch (err) {
    return errorResponse(res, "Failed to report discussion", 500);
  }
};

exports.getAllDiscussions = async (req, res) => {
  try {
    const discussions = await Discussion.find()
      .populate("createdBy", "firstName lastName avatarUrl")
      .sort({ createdAt: -1 });

    return successResponse(res, discussions, "Fetched all discussions");
  } catch (err) {
    return errorResponse(res, "Failed to fetch discussions", 500);
  }
};

exports.getDiscussionById = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    // bump views count
    const discussion = await Discussion.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate("createdBy", "firstName lastName avatarUrl");

    if (!discussion) {
      return errorResponse(res, "Discussion not found", 404);
    }

    // replies with nested children (1 level deep)
    const replies = await Reply.aggregate([
      {
        $match: {
          discussion: new mongoose.Types.ObjectId(id),
          parentReply: null, // only top-level
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
            { $sort: { createdAt: 1 } },
          ],
          as: "children",
        },
      },
      { $sort: { createdAt: 1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]);

    const totalReplies = await Reply.countDocuments({ discussion: id });

    return successResponse(res, {
      discussion,
      replies,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalReplies,
        totalPages: Math.ceil(totalReplies / pageSize),
      },
    });
  } catch (err) {
    console.error("getDiscussionById error:", err);
    return errorResponse(res, "Failed to fetch discussion", 500);
  }
};

exports.getDiscussionFeed = async (req, res) => {
  try {
    const { tab = "recent", page = 1, limit = 10, category, tag } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    const match = {};
    if (category) match.category = category;
    if (tag) match.tags = tag;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "replies",
          let: { discussionId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$discussion", "$$discussionId"] } } },
            {
              $group: {
                _id: "$discussion",
                count: { $sum: 1 },
                lastReplyAt: { $max: "$createdAt" },
              },
            },
          ],
          as: "replyStats",
        },
      },
      {
        $addFields: {
          replyCount: {
            $ifNull: [{ $arrayElemAt: ["$replyStats.count", 0] }, 0],
          },
          lastReplyAt: {
            $ifNull: [
              { $arrayElemAt: ["$replyStats.lastReplyAt", 0] },
              "$createdAt",
            ],
          },
        },
      },
      {
        $addFields: {
          hoursSinceCreated: {
            $divide: [
              {
                $dateDiff: {
                  startDate: "$createdAt",
                  endDate: "$$NOW",
                  unit: "hour",
                },
              },
              1,
            ],
          },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $divide: [
              {
                $add: [
                  { $multiply: ["$replyCount", 3] },
                  { $ifNull: ["$views", 0] },
                ],
              },
              { $pow: [{ $add: ["$hoursSinceCreated", 2] }, 1.5] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
        },
      },
      { $unwind: "$createdByUser" },
      {
        $project: {
          _id: 1,
          title: 1,
          content: 1,
          category: 1,
          tags: 1,
          images: { $ifNull: ["$images", []] },
          views: 1,
          likes: 1,
          createdAt: 1,
          updatedAt: 1,
          replyCount: 1,
          lastReplyAt: 1,
          trendingScore: 1,
          createdBy: {
            _id: "$createdByUser._id",
            firstName: "$createdByUser.firstName",
            lastName: "$createdByUser.lastName",
            avatarUrl: "$createdByUser.avatarUrl",
            role: "$createdByUser.role",
          },
        },
      },
    ];

    if (tab === "trending") {
      pipeline.push({ $sort: { trendingScore: -1, createdAt: -1 } });
    } else if (tab === "unanswered") {
      pipeline.push({ $match: { replyCount: 0 } });
      pipeline.push({ $sort: { createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: pageSize }],
          total: [{ $count: "count" }],
        },
      },
      {
        $addFields: {
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
      }
    );

    const result = await Discussion.aggregate(pipeline);
    const { data, total } = result[0] || { data: [], total: 0 };

    return successResponse(res, {
      page: pageNum,
      limit: pageSize,
      total,
      data,
    });
  } catch (err) {
    return errorResponse(res, "Failed to fetch feed", 500);
  }
};

exports.getDiscussionStats = async (req, res) => {
  try {
    const withToday =
      String(req.query.withToday || "false").toLowerCase() === "true";

    const [discussionAgg, replyAgg] = await Promise.all([
      Discussion.aggregate([{ $count: "count" }]),
      Reply.aggregate([{ $count: "count" }]),
    ]);

    const totals = {
      totalDiscussions: discussionAgg[0]?.count || 0,
      totalReplies: replyAgg[0]?.count || 0,
    };

    if (withToday) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const [todayDiscussions, todayReplies] = await Promise.all([
        Discussion.countDocuments({ createdAt: { $gte: startOfDay } }),
        Reply.countDocuments({ createdAt: { $gte: startOfDay } }),
      ]);

      totals.today = { discussions: todayDiscussions, replies: todayReplies };
    }

    return successResponse(res, totals, "Discussion stats fetched succesfully");
  } catch (err) {
    return errorResponse(res, "Failed to fetch stats", 500);
  }
};

exports.getTrendingTopics = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const { category, tag } = req.query;

    const match = {};
    if (category) match.category = category;
    if (tag) match.tags = tag;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "replies",
          let: { discussionId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$discussion", "$$discussionId"] } } },
            {
              $group: {
                _id: "$discussion",
                count: { $sum: 1 },
                lastReplyAt: { $max: "$createdAt" },
              },
            },
          ],
          as: "replyStats",
        },
      },
      {
        $addFields: {
          replyCount: {
            $ifNull: [{ $arrayElemAt: ["$replyStats.count", 0] }, 0],
          },
          lastReplyAt: {
            $ifNull: [
              { $arrayElemAt: ["$replyStats.lastReplyAt", 0] },
              "$createdAt",
            ],
          },
        },
      },
      {
        $addFields: {
          hoursSinceCreated: {
            $divide: [
              {
                $dateDiff: {
                  startDate: "$createdAt",
                  endDate: "$$NOW",
                  unit: "hour",
                },
              },
              1,
            ],
          },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $divide: [
              {
                $add: [
                  { $multiply: ["$replyCount", 3] },
                  { $ifNull: ["$views", 0] },
                ],
              },
              { $pow: [{ $add: ["$hoursSinceCreated", 2] }, 1.5] },
            ],
          },
        },
      },
      {
        $project: {
          title: 1,
          category: 1,
          tags: 1,
          views: 1,
          replyCount: 1,
          trendingScore: 1,
          createdAt: 1,
        },
      },
      { $sort: { trendingScore: -1, createdAt: -1 } },
      { $limit: limit },
    ];

    const data = await Discussion.aggregate(pipeline);

    return successResponse(res, data, "Trending Topics fetched succesfully");
  } catch (err) {
    return errorResponse(res, "Failed to fetch trending topics", 500);
  }
};

exports.getRelatedDiscussions = async (req, res) => {
  try {
    const { id } = req.params;

    const discussion = await Discussion.findById(id);
    if (!discussion) return errorResponse(res, "Discussion not found", 404);

    const related = await Discussion.find({
      _id: { $ne: id },
      category: discussion.category,
    })
      .populate("createdBy", "firstName lastName avatarUrl")
      .sort({ createdAt: -1 })
      .limit(5);

    return successResponse(res, related, "Related discussions fetched!");
  } catch (err) {
    return errorResponse(res, "Failed to fetch related discussions", 500);
  }
};

exports.getCategoryStats = async (req, res) => {
  try {
    const stats = await Discussion.aggregate([
      {
        $group: {
          _id: "$category",
          posts: { $sum: 1 },
          users: { $addToSet: "$createdBy" },
          discussionIds: { $addToSet: "$_id" },
        },
      },
      {
        $lookup: {
          from: "replies",
          localField: "discussionIds",
          foreignField: "discussion",
          as: "replies",
        },
      },
      {
        $addFields: {
          replyUsers: {
            $map: { input: "$replies", as: "r", in: "$$r.createdBy" },
          },
        },
      },
      {
        $project: {
          category: "$_id",
          posts: 1,
          members: {
            $size: { $setUnion: ["$users", "$replyUsers"] },
          },
        },
      },
      { $sort: { category: 1 } },
    ]);

    return successResponse(res, stats, "Category stats fetched successfully");
  } catch (err) {
    console.error("getCategoryStats error:", err);
    return errorResponse(res, "Failed to fetch category stats");
  }
};

//  Community overview using aggregation
exports.getCommunityOverview = async (req, res) => {
  try {
    const [discussionAgg, replyAgg] = await Promise.all([
      Discussion.aggregate([
        {
          $group: {
            _id: null,
            totalDiscussions: { $sum: 1 },
            discussionUsers: { $addToSet: "$createdBy" },
          },
        },
      ]),
      Reply.aggregate([
        {
          $group: {
            _id: null,
            totalReplies: { $sum: 1 },
            replyUsers: { $addToSet: "$createdBy" },
          },
        },
      ]),
    ]);

    const totalDiscussions = discussionAgg[0]?.totalDiscussions || 0;
    const totalReplies = replyAgg[0]?.totalReplies || 0;

    const discussionUsers = discussionAgg[0]?.discussionUsers || [];
    const replyUsers = replyAgg[0]?.replyUsers || [];

    const activeMembers = new Set([
      ...discussionUsers.map((u) => u.toString()),
      ...replyUsers.map((u) => u.toString()),
    ]).size;

    const overview = {
      activeMembers,
      totalDiscussions,
      totalReplies,
    };

    return successResponse(
      res,
      overview,
      "Community overview fetched successfully"
    );
  } catch (err) {
    console.error("getCommunityOverview error:", err);
    return errorResponse(res, "Failed to fetch community overview");
  }
};
