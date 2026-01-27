const JobApplication = require("../models/JobApplication");
const Resource = require("../models/resource");
const ResourcePurchase = require("../models/resourcePurchase");
const BalanceLedger = require("../models/BalanceLedger");
const { errorResponse, successResponse } = require("../utils/response");

const getTeacherDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Count total applications sent
    const applicationsCount = await JobApplication.countDocuments({
      userId,
    });

    // Count resources uploaded by this user
    const resourcesUploaded = await Resource.countDocuments({
      "createdBy.userId": userId,
      isDeleted: false,
    });

    // Count total downloads (purchases) of this user's resources
    const userResources = await Resource.find(
      { "createdBy.userId": userId, isDeleted: false },
      { _id: 1 }
    ).lean();
    const resourceIds = userResources.map((r) => r._id);

    const resourcesDownloaded = await ResourcePurchase.countDocuments({
      resourceId: { $in: resourceIds },
      status: "completed",
    });

    // Get total earnings from BalanceLedger (in cents)
    const earningsResult = await BalanceLedger.aggregate([
      {
        $match: {
          userId: userId.toString(),
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$amount" },
        },
      },
    ]);

    // Earnings are in cents
    const totalEarningsInCents = earningsResult[0]?.totalEarnings || 0;

    // Get 5 most recent applications
    const recentApplications = await JobApplication.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "jobId",
        select: "title organization country city applicationDeadline",
        populate: {
          path: "schoolId",
          select: "name logo",
        },
      })
      .lean();

    return successResponse(res, {
      cards: {
        applicationsSent: applicationsCount,
        resourcesUploaded,
        resourcesDownloaded,
        earnings: totalEarningsInCents, // In cents, frontend divides by 100
      },
      recentApplications,
    });
  } catch (err) {
    console.error("getTeacherDashboard error:", err);
    return errorResponse(res, "Failed to fetch dashboard data", err.message);
  }
};

module.exports = {
  getTeacherDashboard,
};
