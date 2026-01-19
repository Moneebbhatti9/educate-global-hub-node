const JobApplication = require("../models/JobApplication");
const { errorResponse, successResponse } = require("../utils/response");

const getTeacherDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Count total applications sent
    const applicationsCount = await JobApplication.countDocuments({
      userId,
    });

    console.log("application counts", applicationsCount);

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
        resourcesUploaded: 12, // static for now
        resourcesDownloaded: 34, // static for now
        earnings: 120.5, // static for now
      },
      recentApplications,
    });
  } catch (err) {
    return errorResponse(res, "Failed to fetch dashboard data", err.message);
  }
};

module.exports = {
  getTeacherDashboard,
};
