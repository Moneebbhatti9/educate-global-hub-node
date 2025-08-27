const JobService = require("../services/jobService");
const ApplicationService = require("../services/applicationService");
const SavedJobService = require("../services/savedJobService");
const {
  successResponse,
  errorResponse,
  sendResponse,
} = require("../utils/response");

class JobController {
  /**
   * Create a new job
   */
  static async createJob(req, res) {
    try {
      console.log("User object:", req.user);
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        console.log("No userId or role is not school in req.user");
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        console.log("No schoolId found in req.user");
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const jobData = req.body;
      console.log("Received job data:", jobData);

      // Determine job status based on action
      const isDraft = req.body.action === "save_draft";
      jobData.status = isDraft ? "draft" : "published";
      console.log("Job status set to:", jobData.status);

      // If publishing, set published date
      if (!isDraft) {
        jobData.publishedAt = new Date();
        jobData.status = "published"; // Published jobs are live and accepting applications
      }

      // Auto-determine isUrgent based on application deadline
      if (jobData.applicationDeadline) {
        const deadline = new Date(jobData.applicationDeadline);
        const now = new Date();
        const daysUntilDeadline = Math.ceil(
          (deadline - now) / (1000 * 60 * 60 * 24)
        );

        // Mark as urgent if deadline is within 7 days
        jobData.isUrgent = daysUntilDeadline <= 7;
        console.log(
          `Deadline in ${daysUntilDeadline} days, isUrgent set to: ${jobData.isUrgent}`
        );
      }

      // Auto-determine isFeatured based on job criteria
      if (!isDraft) {
        const isHighSalary = jobData.salaryMax && jobData.salaryMax > 50000;
        const isVisaSponsorship = jobData.visaSponsorship === true;
        const isQuickApply = jobData.quickApply === true;
        const hasGoodBenefits =
          jobData.benefits && jobData.benefits.length >= 3;

        // Featured if meets multiple criteria
        const featureScore = [
          isHighSalary,
          isVisaSponsorship,
          isQuickApply,
          hasGoodBenefits,
        ].filter(Boolean).length;

        // Allow frontend to override, otherwise use auto-determination
        if (req.body.isFeatured !== undefined) {
          jobData.isFeatured = req.body.isFeatured;
          console.log(
            `Frontend override: isFeatured set to: ${jobData.isFeatured}`
          );
        } else {
          jobData.isFeatured = featureScore >= 2;
          console.log(
            `Auto-determination: Feature score: ${featureScore}, isFeatured set to: ${jobData.isFeatured}`
          );
        }
      }

      // Allow frontend to override isUrgent if needed
      if (req.body.isUrgent !== undefined) {
        jobData.isUrgent = req.body.isUrgent;
        console.log(`Frontend override: isUrgent set to: ${jobData.isUrgent}`);
      }

      console.log("About to create job with data:", { schoolId, jobData });

      const job = await JobService.createJob(schoolId, jobData, userId);
      console.log("Job created successfully:", job._id);

      const message = isDraft
        ? "Job saved as draft successfully"
        : "Job published successfully";

      console.log("About to send response with message:", message);
      const response = sendResponse(res, 201, true, message, { job });
      console.log("Response sent successfully");
      return response;
    } catch (error) {
      console.log("Error in createJob:", error);
      console.log("Error stack:", error.stack);
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get job by ID - Public route for viewing job details
   */
  static async getJobById(req, res) {
    try {
      const { jobId } = req.params;

      // Check if user is authenticated (optional)
      const isAuthenticated = !!req.user;
      const userId = req.user?.userId;
      const role = req.user?.role;

      // Record job view (with or without user info)
      try {
        await JobService.recordJobView(jobId, {
          viewerId: userId || null,
          viewerType: role || "anonymous",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referrer"),
        });
      } catch (viewError) {
        console.log("Failed to record job view:", viewError.message);
        // Don't fail the request if view recording fails
      }

      // Get job with school info
      const job = await JobService.getJobById(jobId, { populateSchool: true });

      // Get related jobs
      const relatedJobs = await JobService.getRelatedJobs(jobId);

      // Check if job is saved by current user (if authenticated teacher)
      let isSaved = false;
      if (isAuthenticated && role === "teacher" && userId) {
        try {
          isSaved = await SavedJobService.isJobSaved(userId, jobId);
        } catch (savedError) {
          console.log("Failed to check if job is saved:", savedError.message);
        }
      }

      // Check if user has applied (if authenticated teacher)
      let hasApplied = false;
      if (isAuthenticated && role === "teacher" && userId) {
        try {
          const application = await require("../models/JobApplication").findOne(
            {
              jobId,
              teacherId: userId,
            }
          );
          hasApplied = !!application;
        } catch (applicationError) {
          console.log(
            "Failed to check application status:",
            applicationError.message
          );
        }
      }

      // Always sanitize data before sending to frontend to remove Mongoose internals
      return sendResponse(res, 200, true, "Job retrieved successfully", {
        job: JobService.sanitizeJobForPublic(job),
        school: {
          name: job.schoolId.schoolName,
          country: job.schoolId.country,
          city: job.schoolId.city,
          description: job.schoolId.aboutSchool,
        },
        relatedJobs,
        isSaved,
        hasApplied,
        isAuthenticated, // Let frontend know if user is logged in
      });
    } catch (error) {
      console.log("Error in getJobById:", error);
      return sendResponse(res, 404, false, error.message);
    }
  }

  /**
   * Update job
   */
  static async updateJob(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;
      const updateData = req.body;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const job = await JobService.updateJob(
        jobId,
        schoolId,
        updateData,
        userId
      );

      return sendResponse(res, 200, true, "Job updated successfully", { job });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Delete job
   */
  static async deleteJob(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const result = await JobService.deleteJob(jobId, schoolId);

      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Update job status
   */
  static async updateJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;
      const { status, notes } = req.body;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const job = await JobService.updateJobStatus(
        jobId,
        schoolId,
        status,
        notes,
        userId
      );

      return sendResponse(res, 200, true, "Job status updated successfully", {
        job,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Update job flags (urgent/featured)
   */
  static async updateJobFlags(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;
      const { isUrgent, isFeatured } = req.body;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      // Validate flags
      if (typeof isUrgent !== "boolean" && isUrgent !== undefined) {
        return sendResponse(res, 400, false, "isUrgent must be a boolean");
      }

      if (typeof isFeatured !== "boolean" && isFeatured !== undefined) {
        return sendResponse(res, 400, false, "isFeatured must be a boolean");
      }

      const updateData = {};
      if (isUrgent !== undefined) updateData.isUrgent = isUrgent;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

      const job = await JobService.updateJob(jobId, schoolId, updateData);

      return sendResponse(res, 200, true, "Job flags updated successfully", {
        job,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Search and filter jobs
   */
  static async searchJobs(req, res) {
    try {
      const filters = req.query;
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortBy: req.query.sortBy || "relevance",
        sortOrder: req.query.sortOrder || "desc",
      };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Jobs retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get jobs by school
   */
  static async getJobsBySchool(req, res) {
    try {
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const filters = {
        status: req.query.status || "all",
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      };

      const result = await JobService.getJobsBySchool(
        schoolId,
        filters,
        pagination
      );

      return sendResponse(
        res,
        200,
        true,
        "School jobs retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get job applications
   */
  static async getJobApplications(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;

      console.log("userId", userId);
      console.log("role", role);
      console.log("schoolId", schoolId);

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const filters = {
        status: req.query.status || "all",
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      };

      const result = await ApplicationService.getApplicationsByJob(
        jobId,
        schoolId,
        filters,
        pagination
      );

      return sendResponse(
        res,
        200,
        true,
        "Job applications retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get job analytics
   */
  static async getJobAnalytics(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const analytics = await JobService.getJobAnalytics(jobId, schoolId);

      return sendResponse(
        res,
        200,
        true,
        "Job analytics retrieved successfully",
        analytics
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get school dashboard stats
   */
  static async getSchoolDashboardStats(req, res) {
    try {
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      const stats = await JobService.getSchoolDashboardStats(schoolId);

      return sendResponse(
        res,
        200,
        true,
        "Dashboard stats retrieved successfully",
        stats
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get featured jobs
   */
  static async getFeaturedJobs(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;

      const filters = { isFeatured: true };
      const pagination = { page: 1, limit, sortBy: "date", sortOrder: "desc" };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Featured jobs retrieved successfully",
        {
          jobs: result.jobs,
          total: result.pagination.total,
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get urgent jobs
   */
  static async getUrgentJobs(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;

      const filters = { isUrgent: true };
      const pagination = {
        page: 1,
        limit,
        sortBy: "deadline",
        sortOrder: "asc",
      };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Urgent jobs retrieved successfully",
        {
          jobs: result.jobs,
          total: result.pagination.total,
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get jobs by category
   */
  static async getJobsByCategory(req, res) {
    try {
      const { category } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      const filters = { positionCategory: category };
      const pagination = { page: 1, limit, sortBy: "date", sortOrder: "desc" };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Jobs by category retrieved successfully",
        {
          jobs: result.jobs,
          total: result.pagination.total,
          category,
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get jobs by location
   */
  static async getJobsByLocation(req, res) {
    try {
      const { country, city } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      const filters = { country, city };
      const pagination = { page: 1, limit, sortBy: "date", sortOrder: "desc" };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Jobs by location retrieved successfully",
        {
          jobs: result.jobs,
          total: result.pagination.total,
          location: { country, city },
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get job recommendations for teacher
   */
  static async getJobRecommendations(req, res) {
    try {
      const { teacherId } = req.user;
      const limit = parseInt(req.query.limit) || 10;

      // Get teacher's saved jobs to understand preferences
      const savedJobs = await SavedJobService.getSavedJobs(
        teacherId,
        {},
        { page: 1, limit: 50 }
      );

      // Extract preferences from saved jobs
      const preferences = this.extractTeacherPreferences(savedJobs.savedJobs);

      // Search jobs based on preferences
      const filters = {
        subjects: preferences.subjects,
        educationLevel: preferences.educationLevel,
        country: preferences.country,
        city: preferences.city,
      };

      const pagination = {
        page: 1,
        limit,
        sortBy: "relevance",
        sortOrder: "desc",
      };

      const result = await JobService.searchJobs(filters, pagination);

      return sendResponse(
        res,
        200,
        true,
        "Job recommendations retrieved successfully",
        {
          jobs: result.jobs,
          total: result.pagination.total,
          preferences,
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Extract teacher preferences from saved jobs
   */
  static extractTeacherPreferences(savedJobs) {
    const preferences = {
      subjects: [],
      educationLevel: [],
      country: [],
      city: [],
    };

    savedJobs.forEach((savedJob) => {
      if (savedJob.jobId) {
        if (savedJob.jobId.subjects) {
          preferences.subjects.push(...savedJob.jobId.subjects);
        }
        if (savedJob.jobId.educationLevel) {
          preferences.educationLevel.push(savedJob.jobId.educationLevel);
        }
        if (savedJob.jobId.country) {
          preferences.country.push(savedJob.jobId.country);
        }
        if (savedJob.jobId.city) {
          preferences.city.push(savedJob.jobId.city);
        }
      }
    });

    // Remove duplicates
    Object.keys(preferences).forEach((key) => {
      preferences[key] = [...new Set(preferences[key])];
    });

    return preferences;
  }

  /**
   * Bulk update job statuses
   */
  static async bulkUpdateJobStatuses(req, res) {
    try {
      const { userId, role, schoolId } = req.user;
      const { jobIds, status, notes } = req.body;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
        return sendResponse(res, 400, false, "Job IDs array is required");
      }

      const results = [];

      for (const jobId of jobIds) {
        try {
          const result = await JobService.updateJobStatus(
            jobId,
            schoolId,
            status,
            notes,
            userId
          );
          results.push({ jobId, success: true, data: result });
        } catch (error) {
          results.push({ jobId, success: false, error: error.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return sendResponse(
        res,
        200,
        true,
        `Bulk update completed. ${successCount} successful, ${failureCount} failed.`,
        {
          results,
          summary: { successCount, failureCount, total: jobIds.length },
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get job statistics
   */
  static async getJobStatistics(req, res) {
    try {
      const { userId, role, schoolId } = req.user;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const stats = await JobService.getSchoolDashboardStats(schoolId);

      return sendResponse(
        res,
        200,
        true,
        "Job statistics retrieved successfully",
        stats
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Export jobs data
   */
  static async exportJobs(req, res) {
    try {
      const { userId, role, schoolId } = req.user;
      const { format = "json", status } = req.query;

      if (!userId || role !== "school") {
        return sendResponse(
          res,
          403,
          false,
          "Access denied. User must be a school."
        );
      }

      if (!schoolId) {
        return sendResponse(
          res,
          403,
          false,
          "School profile not found. Access denied."
        );
      }

      const filters = { status: status || "all" };
      const pagination = { page: 1, limit: 1000 }; // Get all jobs

      const result = await JobService.getJobsBySchool(
        schoolId,
        filters,
        pagination
      );

      if (format === "csv") {
        // Convert to CSV format
        const csvData = this.convertJobsToCSV(result.jobs);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=jobs.csv");
        return res.send(csvData);
      }

      // Default JSON format
      return sendResponse(res, 200, true, "Jobs exported successfully", result);
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Convert jobs to CSV format
   */
  static convertJobsToCSV(jobs) {
    const headers = [
      "Title",
      "Description",
      "Status",
      "Country",
      "City",
      "Job Type",
      "Education Level",
      "Subjects",
      "Requirements",
      "Salary Range",
      "Application Deadline",
      "Created At",
    ];

    const csvRows = [headers.join(",")];

    jobs.forEach((job) => {
      const row = [
        `"${job.title}"`,
        `"${job.description}"`,
        job.status,
        `"${job.country}"`,
        `"${job.city}"`,
        job.jobType,
        job.educationLevel,
        `"${job.subjects.join("; ")}"`,
        `"${job.requirements.join("; ")}"`,
        `"${JobService.calculateSalaryRange(job)}"`,
        job.applicationDeadline,
        job.createdAt,
      ];

      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }
}

module.exports = JobController;
