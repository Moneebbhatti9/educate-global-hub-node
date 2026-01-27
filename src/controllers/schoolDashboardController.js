const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");

const { successResponse, errorResponse } = require("../utils/response");

const getSchoolDashboard = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; // from JWT

    // 1. Total Job Posted
    const totalJobs = await Job.countDocuments({ school: schoolId });

    // 2. Active Job Postings
    const activeJobs = await Job.countDocuments({
      school: schoolId,
      status: "active",
    });

    // 3. Total Applicants (applications across all jobs)
    const totalApplicants = await JobApplication.countDocuments({
      school: schoolId,
    });

    // 4. Hiring Ratio (hired applicants / total applicants)
    const hiredApplicants = await JobApplication.countDocuments({
      school: schoolId,
      status: "hired",
    });
    const hiringRatio =
      totalApplicants > 0
        ? ((hiredApplicants / totalApplicants) * 100).toFixed(2)
        : 0;

    return successResponse(res, {
      totalJobs,
      activeJobs,
      totalApplicants,
      hiringRatio,
    });
  } catch (err) {
    return errorResponse(res, "Failed to fetch dashboard data", err.message);
  }
};

const getRecentCandidates = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; // from JWT

    if (!schoolId) {
      return errorResponse(res, "School ID missing in token", 400);
    }

    const jobIds = await Job.find({ schoolId }, "_id").lean();

    if (!jobIds.length) {
      return successResponse(res, { data: [] }, "No jobs found for this school");
    }

    const applications = await JobApplication.find({
      jobId: { $in: jobIds.map((j) => j._id) },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "teacherId",
        model: TeacherProfile,
        select: "professionalTitle yearsOfTeachingExperience userId",
        populate: {
          path: "userId",
          model: User,
          select: "firstName lastName avatarUrl",
        },
      })
      .lean();

    const candidates = applications.map((app) => {
      const teacher = app.teacherId;
      const user = teacher?.userId;

      return {
        avatar: user?.avatarUrl || null,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        position: teacher?.professionalTitle || "N/A",
        experience:
          teacher?.yearsOfTeachingExperience != null
            ? `${teacher.yearsOfTeachingExperience} years`
            : "N/A",
        appliedDate: app.createdAt,
        status: app.status || "pending",
      };
    });

    return successResponse(res, candidates, "Recent candidates fetched", 200);
  } catch (err) {
    console.error("getRecentCandidates error:", err);
    return errorResponse(res, "Failed to fetch recent candidates", 500);
  }
};

module.exports = { getSchoolDashboard, getRecentCandidates };
