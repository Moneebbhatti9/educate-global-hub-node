const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const SchoolProfile = require("../models/SchoolProfile");

class AdminJobManagementService {
  // Get all jobs with pagination, search, and filters
  static async getAllJobs({
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
    schoolId = null,
  }) {
    try {
      console.log("getAllJobs called with params:", {
        page,
        limit,
        search,
        status,
        jobType,
        country,
        city,
        educationLevel,
        sortBy,
        sortOrder,
        schoolId,
      });

      const query = { deletedAt: { $exists: false } };

      // Filter by school if provided
      if (schoolId) {
        query.schoolId = schoolId;
      }

      // Search filter
      if (search && search.trim()) {
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

      console.log("Final query:", JSON.stringify(query, null, 2));

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      console.log("Sort:", sort, "Skip:", skip, "Limit:", limit);

      // Execute query
      let jobs, total;
      try {
        [jobs, total] = await Promise.all([
          Job.find(query)
            .populate("schoolId", "name organization country city")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
          Job.countDocuments(query),
        ]);
        console.log(
          "Query executed successfully. Jobs found:",
          jobs.length,
          "Total:",
          total
        );
      } catch (queryError) {
        console.error("Database query error:", queryError);
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      // Transform jobs to include additional info
      let transformedJobs;
      try {
        transformedJobs = jobs.map((job) => ({
          ...job,
          salaryRange: AdminJobManagementService.formatSalaryRange(job),
          daysPosted: AdminJobManagementService.calculateDaysPosted(
            job.publishedAt
          ),
          isExpired: AdminJobManagementService.isJobExpired(
            job.applicationDeadline
          ),
          statusDisplay: AdminJobManagementService.getStatusDisplay(job.status),
        }));
        console.log("Jobs transformed successfully");
      } catch (transformError) {
        console.error("Job transformation error:", transformError);
        throw new Error(`Job transformation failed: ${transformError.message}`);
      }

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
  static async getJobStatistics(schoolId = null) {
    try {
      // Build base query - filter by school if provided
      const baseQuery = { deletedAt: { $exists: false } };
      if (schoolId) {
        baseQuery.schoolId = schoolId;
      }

      const [totalJobs, activeJobs, pendingJobs, suspendedJobs, expiredJobs] =
        await Promise.all([
          Job.countDocuments(baseQuery),
          Job.countDocuments({
            ...baseQuery,
            status: "published",
          }),
          Job.countDocuments({
            ...baseQuery,
            status: "draft",
          }),
          Job.countDocuments({
            ...baseQuery,
            status: "closed",
          }),
          Job.countDocuments({
            ...baseQuery,
            applicationDeadline: { $lte: new Date() },
            status: "published",
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
  static async getJobById(jobId) {
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
  static async updateJobStatus(jobId, status, reason) {
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
  static async deleteJob(jobId, reason) {
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
  static async exportJobs({
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
  static async getJobApplications(
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

      // Map appliedAt to createdAt since they represent the same thing
      let actualSortBy = sortBy;
      if (sortBy === "appliedAt") {
        actualSortBy = "createdAt";
      }

      const skip = (page - 1) * limit;

      let applications, total;

      // Handle teacherName sorting with aggregation pipeline
      if (sortBy === "teacherName") {
        const pipeline = [
          { $match: query },
          {
            $lookup: {
              from: "teacherprofiles",
              localField: "teacherId",
              foreignField: "_id",
              as: "teacherProfile",
            },
          },
          { $unwind: "$teacherProfile" },
          {
            $lookup: {
              from: "users",
              localField: "teacherProfile.userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          {
            $addFields: {
              teacherFullName: {
                $concat: ["$user.firstName", " ", "$user.lastName"],
              },
            },
          },
          {
            $sort: {
              teacherFullName: sortOrder === "desc" ? -1 : 1,
            },
          },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "teacherprofiles",
              localField: "teacherId",
              foreignField: "_id",
              as: "teacherProfile",
            },
          },
          { $unwind: "$teacherProfile" },
          {
            $lookup: {
              from: "users",
              localField: "teacherProfile.userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          {
            $project: {
              _id: 1,
              jobId: 1,
              teacherId: 1,
              coverLetter: 1,
              expectedSalary: 1,
              availableFrom: 1,
              reasonForApplying: 1,
              additionalComments: 1,
              screeningAnswers: 1,
              status: 1,
              resumeUrl: 1,
              documents: 1,
              notes: 1,
              reviewedBy: 1,
              reviewedAt: 1,
              rejectionReason: 1,
              interviewDate: 1,
              interviewNotes: 1,
              isWithdrawn: 1,
              withdrawnAt: 1,
              withdrawnReason: 1,
              createdAt: 1,
              updatedAt: 1,
              teacher: {
                fullName: {
                  $concat: ["$user.firstName", " ", "$user.lastName"],
                },
                email: "$user.email",
                location: {
                  country: "$teacherProfile.country",
                  city: "$teacherProfile.city",
                  province: "$teacherProfile.province",
                  address: "$teacherProfile.address",
                  zipCode: "$teacherProfile.zipCode",
                },
                phoneNumber: "$teacherProfile.phoneNumber",
                qualification: "$teacherProfile.qualification",
                subject: "$teacherProfile.subject",
                yearsOfTeachingExperience:
                  "$teacherProfile.yearsOfTeachingExperience",
              },
            },
          },
        ];

        [applications, total] = await Promise.all([
          JobApplication.aggregate(pipeline),
          JobApplication.countDocuments(query),
        ]);
      } else {
        // Standard sorting for other fields
        const sort = {};
        sort[actualSortBy] = sortOrder === "desc" ? -1 : 1;

        [applications, total] = await Promise.all([
          JobApplication.find(query)
            .populate({
              path: "teacherId",
              populate: {
                path: "userId",
                select: "firstName lastName email",
              },
            })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
          JobApplication.countDocuments(query),
        ]);

        // Transform the data to include teacher information in a consistent format
        applications = applications.map((app) => {
          const teacher = app.teacherId;
          const user = teacher?.userId;

          return {
            ...app,
            teacher: {
              fullName: user
                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                : "",
              email: user?.email || "",
              location: {
                country: teacher?.country || "",
                city: teacher?.city || "",
                province: teacher?.province || "",
                address: teacher?.address || "",
                zipCode: teacher?.zipCode || "",
              },
              phoneNumber: teacher?.phoneNumber || "",
              qualification: teacher?.qualification || "",
              subject: teacher?.subject || "",
              yearsOfTeachingExperience:
                teacher?.yearsOfTeachingExperience || 0,
            },
            teacherId: app.teacherId?._id || app.teacherId,
          };
        });
      }

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
  static async bulkUpdateJobStatuses(jobIds, status, reason) {
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
  static async getJobAnalytics(period = "30d") {
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
  static formatSalaryRange(job) {
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

  static calculateDaysPosted(publishedAt) {
    if (!publishedAt) return null;
    const now = new Date();
    const diffTime = Math.abs(now - publishedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static isJobExpired(applicationDeadline) {
    if (!applicationDeadline) return false;
    return new Date() > applicationDeadline;
  }

  static getStatusDisplay(status) {
    const statusMap = {
      draft: "Pending",
      published: "Active",
      closed: "Suspended",
      expired: "Expired",
    };
    return statusMap[status] || status;
  }

  static convertToCSV(jobs) {
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
        `"${AdminJobManagementService.getStatusDisplay(job.status)}"`,
        job.applicantsCount || 0,
        job.viewsCount || 0,
        `"${AdminJobManagementService.formatSalaryRange(job)}"`,
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
