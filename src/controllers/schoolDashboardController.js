const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const { successResponse, errorResponse } = require("../utils/response");

const getSchoolDashboard = async (req, res) => {
  try {
    const schoolId = req.user._id; // from JWT

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

module.exports = { getSchoolDashboard };
