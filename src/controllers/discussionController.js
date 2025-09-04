const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");

exports.createDiscussion = async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;

    if (!title || !category) {
      return res
        .status(400)
        .json({ message: "Title and category are required" });
    }

    const allowedCategories = [
      "Teaching Tips & Strategies",
      "Curriculum & Resources",
      "Career Advice",
      "Help & Support",
    ];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      content: content?.trim() || "",
      category,
      tags: Array.isArray(tags) ? tags : [],
      createdBy: req.user._id,
    });

    const io = req.app.get("io");
    if (io) io.emit("newDiscussion", discussion);

    res.status(201).json(discussion);
  } catch (err) {
    console.error("Error creating discussion:", err);
    res.status(500).json({ message: "Failed to create discussion" });
  }
};

exports.getAllDiscussions = async (req, res) => {
  try {
    const discussions = await Discussion.find()
      .populate("createdBy", "firstName lastName avatarUrl")
      .sort({ createdAt: -1 });

    res.status(200).json(discussions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch discussions" });
  }
};

exports.getDiscussionById = async (req, res) => {
  try {
    const { id } = req.params;

    const discussion = await Discussion.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } }, // increase views
      { new: true }
    ).populate("createdBy", "firstName lastName avatarUrl");

    if (!discussion) {
      return res.status(404).json({ message: "Discussion not found" });
    }

    const replies = await Reply.find({ discussion: id })
      .populate("createdBy", "firstName lastName avatarUrl")
      .sort({ createdAt: 1 });

    res.status(200).json({ discussion, replies });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch discussion" });
  }
};

exports.getDiscussionFeed = async (req, res) => {
  try {
    const { tab = "recent", page = 1, limit = 10, category, tag } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    // Base filters
    const match = {};
    if (category) match.category = category;
    if (tag) match.tags = tag;

    // Aggregation
    const pipeline = [
      { $match: match },

      // Join replies and compute replyCount & lastReplyAt
      {
        $lookup: {
          from: "replies",
          let: { discussionId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$discussion", "$$discussionId"] } } },
            { $sort: { createdAt: -1 } },
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

      // Compute a trending score with time decay:
      // score = (replyCount*3 + views) / pow(hoursSinceCreated + 2, 1.5)
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

      // Keep only what frontend needs (tweak freely)
      {
        $project: {
          title: 1,
          content: 1,
          category: 1,
          tags: 1,
          createdBy: 1,
          attachments: 1,
          views: 1,
          createdAt: 1,
          updatedAt: 1,
          replyCount: 1,
          lastReplyAt: 1,
          trendingScore: 1,
        },
      },
    ];

    // Sort depending on tab
    if (tab === "trending") {
      pipeline.push({ $sort: { trendingScore: -1, createdAt: -1 } });
    } else if (tab === "unanswered") {
      pipeline.push({ $match: { replyCount: 0 } });
      pipeline.push({ $sort: { createdAt: -1 } });
    } else {
      // recent (default)
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    // Pagination with totalCount
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

    res.status(200).json({
      success: true,
      page: pageNum,
      limit: pageSize,
      total,
      data,
    });
  } catch (err) {
    console.error("getDiscussionFeed error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch feed" });
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

      totals.today = {
        discussions: todayDiscussions,
        replies: todayReplies,
      };
    }

    res.status(200).json({ success: true, ...totals });
  } catch (err) {
    console.error("getDiscussionStats error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
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

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getTrendingTopics error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch trending topics" });
  }
};
