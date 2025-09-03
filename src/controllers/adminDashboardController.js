const User = require("../models/User");
const Job = require("../models/Job");
const SchoolProfile = require("../models/SchoolProfile");
const { successResponse, errorResponse } = require("../utils/response");

const getAdminDashboard = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Active jobs
    const activeJobs = await Job.countDocuments({ status: "published" });

    // Recent jobs
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("schoolId", "schoolName");

    // Recently completed school profiles
    const schools = await SchoolProfile.find({ isProfileComplete: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "name email");

    // Merge activities
    const recentActivities = [
      ...schools.map((s) => ({
        type: "school",
        name: s.schoolName,
        createdAt: s.createdAt,
      })),
      ...jobs.map((j) => ({
        type: "job",
        title: j.title,
        createdAt: j.createdAt,
      })),
    ].sort((a, b) => b.createdAt - a.createdAt);

    // Response
    return successResponse(res, "Admin dashboard data retrieved", {
      stats: {
        totalUsers,
        activeJobs,
        forumPosts: 148, // TODO: Replace with real data
        platformRevenue: 43222, // TODO: Replace with real data
      },
      recentActivities,
    });
  } catch (error) {
    return errorResponse(res, "Failed to fetch dashboard data", error);
  }
};

module.exports = { getAdminDashboard };
