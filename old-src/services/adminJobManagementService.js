const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const SchoolProfile = require("../models/SchoolProfile");

class AdminJobManagementService {
  // Get all jobs with pagination, search, and filters
  async getAllJobs({
    page = 1,
    limit = 10,
    search,
    status,
    jobType,
    country,
    city,
    educationLevel,
    sortBy = "createdAt",
    sortOrder = "desc",
  }) {
    try {
      const query = { deletedAt: { $exists: false } };

      // Search filter
      if (search) {
        query.$text = { $search: search };
      }

      // Status filter
      if (status && status !== "all") {
        query.status = status;
      }

      // Job type filter
      if (jobType && jobType !== "all") {
        query.jobType = jobType;
      }

      // Location filters
      if (country && country !== "all") {
        query.country = country;
      }
      if (city && city !== "all") {
        query.city = city;
      }

      // Education level filter
      if (educationLevel && educationLevel !== "all") {
        query.educationLevel = educationLevel;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [jobs, total] = await Promise.all([
        Job.find(query)
          .populate("schoolId", "name organization country city")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Job.countDocuments(query),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      // Transform jobs to include additional info
      const transformedJobs = jobs.map((job) => ({
        ...job,
        salaryRange: this.formatSalaryRange(job),
        daysPosted: this.calculateDaysPosted(job.publishedAt),
        isExpired: this.isJobExpired(job.applicationDeadline),
        statusDisplay: this.getStatusDisplay(job.status),
      }));

      return {
        jobs: transformedJobs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      console.error("Error in getAllJobs:", error);
      throw error;
    }
  }

  // Get job statistics
  async getJobStatistics() {
    try {
      const [totalJobs, activeJobs, pendingJobs, suspendedJobs, expiredJobs] =
        await Promise.all([
          Job.countDocuments({ deletedAt: { $exists: false } }),
          Job.countDocuments({
            status: "published",
            deletedAt: { $exists: false },
          }),
          Job.countDocuments({
            status: "draft",
            deletedAt: { $exists: false },
          }),
          Job.countDocuments({
            status: "closed",
            deletedAt: { $exists: false },
          }),
          Job.countDocuments({
            applicationDeadline: { $lte: new Date() },
            status: "published",
            deletedAt: { $exists: false },
          }),
        ]);

      return {
        totalJobs,
        activeJobs,
        pendingJobs,
        suspendedJobs,
        expiredJobs,
      };
    } catch (error) {
      console.error("Error in getJobStatistics:", error);
      throw error;
    }
  }

  // Get job by ID
  async getJobById(jobId) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        deletedAt: { $exists: false },
      })
        .populate("schoolId", "name organization country city")
        .lean();

      if (!job) {
        throw new Error("Job not found");
      }

      // Add computed fields
      job.salaryRange = this.formatSalaryRange(job);
      job.daysPosted = this.calculateDaysPosted(job.publishedAt);
      job.isExpired = this.isJobExpired(job.applicationDeadline);
      job.statusDisplay = this.getStatusDisplay(job.status);

      return job;
    } catch (error) {
      console.error("Error in getJobById:", error);
      throw error;
    }
  }

  // Update job status
  async updateJobStatus(jobId, status, reason) {
    try {
      const validStatuses = ["draft", "published", "closed", "expired"];

      if (!validStatuses.includes(status)) {
        throw new Error("Invalid status");
      }

      const job = await Job.findOne({
        _id: jobId,
        deletedAt: { $exists: false },
      });
      if (!job) {
        throw new Error("Job not found");
      }

      const oldStatus = job.status;
      job.status = status;

      // Handle status-specific logic
      if (status === "published" && oldStatus !== "published") {
        job.publishedAt = new Date();
      }

      if (status === "closed" || status === "expired") {
        job.closedAt = new Date();
      }

      // Add status change history
      if (!job.statusHistory) {
        job.statusHistory = [];
      }

      job.statusHistory.push({
        status,
        reason,
        changedAt: new Date(),
        changedBy: "admin", // In a real app, this would be the admin user ID
      });

      await job.save();

      return job;
    } catch (error) {
      console.error("Error in updateJobStatus:", error);
      throw error;
    }
  }

  // Delete job
  async deleteJob(jobId, reason) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        deletedAt: { $exists: false },
      });
      if (!job) {
        throw new Error("Job not found");
      }

      // Soft delete - mark as deleted instead of actually removing
      job.deletedAt = new Date();
      job.deletionReason = reason;
      job.status = "deleted";

      await job.save();

      return { success: true, message: "Job deleted successfully" };
    } catch (error) {
      console.error("Error in deleteJob:", error);
      throw error;
    }
  }

  // Export jobs
  async exportJobs({
    status,
    jobType,
    country,
    city,
    educationLevel,
    format = "csv",
  }) {
    try {
      const query = { deletedAt: { $exists: false } };

      if (status && status !== "all") query.status = status;
      if (jobType && jobType !== "all") query.jobType = jobType;
      if (country && country !== "all") query.country = country;
      if (city && city !== "all") query.city = city;
      if (educationLevel && educationLevel !== "all")
        query.educationLevel = educationLevel;

      const jobs = await Job.find(query)
        .populate("schoolId", "name organization")
        .lean();

      if (format === "csv") {
        return this.convertToCSV(jobs);
      } else {
        return { data: jobs };
      }
    } catch (error) {
      console.error("Error in exportJobs:", error);
      throw error;
    }
  }

  // Get job applications
  async getJobApplications(
    jobId,
    { page = 1, limit = 10, status, sortBy = "createdAt", sortOrder = "desc" }
  ) {
    try {
      // Verify job exists
      const job = await Job.findOne({
        _id: jobId,
        deletedAt: { $exists: false },
      });
      if (!job) {
        throw new Error("Job not found");
      }

      const query = { jobId };

      if (status && status !== "all") {
        query.status = status;
      }

      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      const [applications, total] = await Promise.all([
        JobApplication.find(query)
          .populate("applicantId", "firstName lastName email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        JobApplication.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        applications,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      console.error("Error in getJobApplications:", error);
      throw error;
    }
  }

  // Bulk update job statuses
  async bulkUpdateJobStatuses(jobIds, status, reason) {
    try {
      const validStatuses = ["draft", "published", "closed", "expired"];

      if (!validStatuses.includes(status)) {
        throw new Error("Invalid status");
      }

      const updateData = {
        status,
        $push: {
          statusHistory: {
            status,
            reason,
            changedAt: new Date(),
            changedBy: "admin",
          },
        },
      };

      if (status === "published") {
        updateData.publishedAt = new Date();
      }

      if (status === "closed" || status === "expired") {
        updateData.closedAt = new Date();
      }

      const result = await Job.updateMany(
        { _id: { $in: jobIds }, deletedAt: { $exists: false } },
        updateData
      );

      return {
        updatedCount: result.modifiedCount,
        totalRequested: jobIds.length,
        status,
      };
    } catch (error) {
      console.error("Error in bulkUpdateJobStatuses:", error);
      throw error;
    }
  }

  // Get job analytics
  async getJobAnalytics(period = "30d") {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const [
        totalJobsCreated,
        totalJobsPublished,
        totalApplications,
        rawTotalViewsResult,
        jobsByType,
        jobsByCountry,
        jobsByStatus,
      ] = await Promise.all([
        Job.countDocuments({
          createdAt: { $gte: startDate },
          deletedAt: { $exists: false },
        }),
        Job.countDocuments({
          publishedAt: { $gte: startDate },
          status: "published",
          deletedAt: { $exists: false },
        }),
        JobApplication.countDocuments({ createdAt: { $gte: startDate } }),
        Job.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              deletedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: null,
              totalViews: { $sum: "$viewsCount" },
            },
          },
        ]),
        Job.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              deletedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: "$jobType",
              count: { $sum: 1 },
            },
          },
        ]),
        Job.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              deletedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: "$country",
              count: { $sum: 1 },
            },
          },
        ]),
        Job.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              deletedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const totalViews =
        rawTotalViewsResult.length > 0
          ? rawTotalViewsResult[0].totalViews || 0
          : 0;

      return {
        period,
        startDate,
        endDate: now,
        totalJobsCreated,
        totalJobsPublished,
        totalApplications,
        totalViews,
        jobsByType: jobsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        jobsByCountry: jobsByCountry.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        jobsByStatus: jobsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Error in getJobAnalytics:", error);
      throw error;
    }
  }

  // Helper methods
  formatSalaryRange(job) {
    if (!job.salaryDisclose) {
      return "Competitive";
    }
    if (job.salaryMin && job.salaryMax) {
      return `${job.salaryMin} - ${job.salaryMax} ${job.currency || "USD"}`;
    }
    if (job.salaryMin) {
      return `From ${job.salaryMin} ${job.currency || "USD"}`;
    }
    if (job.salaryMax) {
      return `Up to ${job.salaryMax} ${job.currency || "USD"}`;
    }
    return "Competitive";
  }

  calculateDaysPosted(publishedAt) {
    if (!publishedAt) return null;
    const now = new Date();
    const diffTime = Math.abs(now - publishedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isJobExpired(applicationDeadline) {
    if (!applicationDeadline) return false;
    return new Date() > applicationDeadline;
  }

  getStatusDisplay(status) {
    const statusMap = {
      draft: "Pending",
      published: "Active",
      closed: "Suspended",
      expired: "Expired",
    };
    return statusMap[status] || status;
  }

  convertToCSV(jobs) {
    const headers = [
      "Job Title",
      "Organization",
      "Location",
      "Job Type",
      "Status",
      "Applications",
      "Views",
      "Salary Range",
      "Posted Date",
      "Expiry Date",
    ];

    const csvRows = [headers.join(",")];

    jobs.forEach((job) => {
      const row = [
        `"${job.title}"`,
        `"${job.organization}"`,
        `"${job.city}, ${job.country}"`,
        `"${job.jobType}"`,
        `"${this.getStatusDisplay(job.status)}"`,
        job.applicantsCount || 0,
        job.viewsCount || 0,
        `"${this.formatSalaryRange(job)}"`,
        job.publishedAt
          ? new Date(job.publishedAt).toISOString().split("T")[0]
          : "",
        job.applicationDeadline
          ? new Date(job.applicationDeadline).toISOString().split("T")[0]
          : "",
      ];
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }
}

module.exports = AdminJobManagementService;
