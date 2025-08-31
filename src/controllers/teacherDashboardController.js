const JobApplication = require("../models/JobApplication");

const getTeacherDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Count total applications sent
    const applicationsCount = await JobApplication.countDocuments({
      userId,
    });

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

    return res.json({
      success: true,
      data: {
        cards: {
          applicationsSent: applicationsCount,
          resourcesUploaded: 12, // static for now
          resourcesDownloaded: 34, // static for now
          earnings: 120.5, // static for now
        },
        recentApplications,
      },
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};

module.exports = {
  getTeacherDashboard,
};
