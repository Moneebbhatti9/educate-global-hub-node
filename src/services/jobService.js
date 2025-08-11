const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const JobView = require("../models/JobView");
const SavedJob = require("../models/SavedJob");
const JobNotification = require("../models/JobNotification");
const { sendEmail } = require("../config/email");

class JobService {
  /**
   * Create a new job
   */
  static async createJob(schoolId, jobData) {
    try {
      // Add school ID to job data
      const job = new Job({
        ...jobData,
        schoolId,
        status: "draft", // Default status
      });

      await job.save();

      // Create notification for school
      await JobNotification.createNotification({
        userId: schoolId,
        type: "job_posted",
        title: "Job Created Successfully",
        message: `Your job "${job.title}" has been created and is now in draft status.`,
        category: "job",
        priority: "medium",
        actionRequired: true,
        actionUrl: `/jobs/${job._id}/edit`,
        actionText: "Edit Job",
      });

      return job;
    } catch (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }
  }

  /**
   * Get job by ID with optional population
   */
  static async getJobById(jobId, options = {}) {
    try {
      const { populateSchool = false, populateApplications = false } = options;

      let query = Job.findById(jobId);

      if (populateSchool) {
        query = query.populate(
          "schoolId",
          "schoolName schoolEmail country city"
        );
      }

      if (populateApplications) {
        query = query.populate({
          path: "applications",
          populate: {
            path: "teacherId",
            select: "fullName email phoneNumber country city",
          },
        });
      }

      const job = await query.exec();

      if (!job) {
        throw new Error("Job not found");
      }

      return job;
    } catch (error) {
      throw new Error(`Failed to get job: ${error.message}`);
    }
  }

  /**
   * Update job by ID
   */
  static async updateJob(jobId, schoolId, updateData) {
    try {
      const job = await Job.findOne({ _id: jobId, schoolId });

      if (!job) {
        throw new Error("Job not found or access denied");
      }

      // Update job fields
      Object.assign(job, updateData);
      await job.save();

      // Create notification for school
      await JobNotification.createNotification({
        userId: schoolId,
        type: "job_updated",
        title: "Job Updated Successfully",
        message: `Your job "${job.title}" has been updated.`,
        category: "job",
        priority: "medium",
        actionRequired: false,
        actionUrl: `/jobs/${job._id}`,
        actionText: "View Job",
      });

      return job;
    } catch (error) {
      throw new Error(`Failed to update job: ${error.message}`);
    }
  }

  /**
   * Delete job by ID
   */
  static async deleteJob(jobId, schoolId) {
    try {
      const job = await Job.findOne({ _id: jobId, schoolId });

      if (!job) {
        throw new Error("Job not found or access denied");
      }

      // Check if job has applications
      const applicationCount = await JobApplication.countDocuments({ jobId });

      if (applicationCount > 0) {
        throw new Error("Cannot delete job with existing applications");
      }

      // Delete related records
      await JobView.deleteMany({ jobId });
      await SavedJob.deleteMany({ jobId });
      await JobNotification.deleteMany({ jobId });

      // Delete the job
      await Job.findByIdAndDelete(jobId);

      return { message: "Job deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete job: ${error.message}`);
    }
  }

  /**
   * Update job status
   */
  static async updateJobStatus(jobId, schoolId, newStatus, notes = "") {
    try {
      const job = await Job.findOne({ _id: jobId, schoolId });

      if (!job) {
        throw new Error("Job not found or access denied");
      }

      const oldStatus = job.status;
      job.status = newStatus;

      // Handle status-specific logic
      if (newStatus === "published" && oldStatus === "draft") {
        job.publishedAt = new Date();
        job.status = "active"; // Auto-activate published jobs
      }

      if (newStatus === "closed" || newStatus === "archived") {
        // Notify applicants about job closure
        await this.notifyApplicantsAboutJobClosure(jobId, newStatus);
      }

      await job.save();

      // Create notification for school
      await JobNotification.createNotification({
        userId: schoolId,
        type: `job_${newStatus}`,
        title: `Job ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: `Your job "${job.title}" has been ${newStatus}.`,
        category: "job",
        priority: "medium",
        actionRequired: false,
        actionUrl: `/jobs/${job._id}`,
        actionText: "View Job",
      });

      return job;
    } catch (error) {
      throw new Error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Search and filter jobs
   */
  static async searchJobs(filters = {}, pagination = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "relevance",
        sortOrder = "desc",
      } = pagination;
      const skip = (page - 1) * limit;

      // Build query
      const query = { status: "active" };

      // Text search
      if (filters.q) {
        query.$text = { $search: filters.q };
      }

      // Location filters
      if (filters.country) {
        query.country = { $regex: filters.country, $options: "i" };
      }

      if (filters.city) {
        query.city = { $regex: filters.city, $options: "i" };
      }

      if (filters.location) {
        query.$or = [
          { country: { $regex: filters.location, $options: "i" } },
          { city: { $regex: filters.location, $options: "i" } },
        ];
      }

      // Salary filters
      if (filters.salaryMin || filters.salaryMax) {
        query.salaryMin = {};
        if (filters.salaryMin) query.salaryMin.$gte = filters.salaryMin;
        if (filters.salaryMax) query.salaryMin.$lte = filters.salaryMax;
      }

      // Education level filter
      if (filters.educationLevel) {
        query.educationLevel = filters.educationLevel;
      }

      // Subjects filter
      if (filters.subjects && filters.subjects.length > 0) {
        query.subjects = { $in: filters.subjects };
      }

      // Job type filter
      if (filters.jobType) {
        query.jobType = filters.jobType;
      }

      // Visa sponsorship filter
      if (filters.visaSponsorship !== undefined) {
        query.visaSponsorship = filters.visaSponsorship;
      }

      // Quick apply filter
      if (filters.quickApply !== undefined) {
        query.quickApply = filters.quickApply;
      }

      // Urgent/Featured filters
      if (filters.isUrgent !== undefined) {
        query.isUrgent = filters.isUrgent;
      }

      if (filters.isFeatured !== undefined) {
        query.isFeatured = filters.isFeatured;
      }

      // Date filters
      if (filters.postedWithin) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filters.postedWithin);
        query.publishedAt = { $gte: cutoffDate };
      }

      if (filters.deadlineWithin) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + filters.deadlineWithin);
        query.applicationDeadline = { $lte: cutoffDate };
      }

      // Build sort
      let sort = {};
      switch (sortBy) {
        case "date":
          sort.publishedAt = sortOrder === "asc" ? 1 : -1;
          break;
        case "salary":
          sort.salaryMin = sortOrder === "asc" ? 1 : -1;
          break;
        case "deadline":
          sort.applicationDeadline = sortOrder === "asc" ? 1 : -1;
          break;
        case "views":
          sort.viewsCount = sortOrder === "asc" ? 1 : -1;
          break;
        case "relevance":
        default:
          if (filters.q) {
            sort.score = { $meta: "textScore" };
          } else {
            sort.publishedAt = -1;
          }
          break;
      }

      // Execute query
      const [jobs, total] = await Promise.all([
        Job.find(query)
          .populate("schoolId", "schoolName country city")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Job.countDocuments(query),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        jobs: jobs.map((job) => this.sanitizeJobForPublic(job)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        filters: this.buildAppliedFilters(filters),
      };
    } catch (error) {
      throw new Error(`Failed to search jobs: ${error.message}`);
    }
  }

  /**
   * Get jobs by school
   */
  static async getJobsBySchool(schoolId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, status } = pagination;
      const skip = (page - 1) * limit;

      const query = { schoolId };

      if (status && status !== "all") {
        query.status = status;
      }

      const [jobs, total] = await Promise.all([
        Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Job.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        jobs,
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
      throw new Error(`Failed to get school jobs: ${error.message}`);
    }
  }

  /**
   * Get related jobs
   */
  static async getRelatedJobs(jobId, limit = 5) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      const query = {
        _id: { $ne: jobId },
        status: "active",
        $or: [
          { subjects: { $in: job.subjects } },
          { educationLevel: job.educationLevel },
          { country: job.country },
          { city: job.city },
        ],
      };

      const relatedJobs = await Job.find(query)
        .populate("schoolId", "schoolName country city")
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();

      return relatedJobs.map((job) => this.sanitizeJobForPublic(job));
    } catch (error) {
      throw new Error(`Failed to get related jobs: ${error.message}`);
    }
  }

  /**
   * Record job view
   */
  static async recordJobView(jobId, viewerInfo = {}) {
    try {
      const {
        viewerId,
        viewerType,
        ipAddress,
        userAgent,
        referrer,
        sessionId,
      } = viewerInfo;

      // Create view record
      const jobView = new JobView({
        jobId,
        viewerId,
        viewerType: viewerType || "anonymous",
        ipAddress,
        userAgent,
        referrer,
        sessionId,
      });

      await jobView.save();

      // Increment job view count
      await Job.findByIdAndUpdate(jobId, { $inc: { viewsCount: 1 } });

      return jobView;
    } catch (error) {
      console.error("Failed to record job view:", error);
      // Don't throw error for view recording failures
    }
  }

  /**
   * Get job analytics
   */
  static async getJobAnalytics(jobId, schoolId) {
    try {
      const job = await Job.findOne({ _id: jobId, schoolId });
      if (!job) {
        throw new Error("Job not found or access denied");
      }

      const [viewStats, applicationStats, geographicStats, deviceStats] =
        await Promise.all([
          JobView.getJobStats(jobId, 30),
          JobApplication.aggregate([
            { $match: { jobId: job._id } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ]),
          JobView.getGeographicStats(jobId),
          JobView.getDeviceStats(jobId),
        ]);

      return {
        viewStats,
        applicationStats,
        geographicStats,
        deviceStats,
        totalViews: job.viewsCount,
        totalApplicants: job.applicantsCount,
      };
    } catch (error) {
      throw new Error(`Failed to get job analytics: ${error.message}`);
    }
  }

  /**
   * Get dashboard statistics for school
   */
  static async getSchoolDashboardStats(schoolId) {
    try {
      const [jobStats, applicationStats, viewStats] = await Promise.all([
        Job.aggregate([
          {
            $match: {
              schoolId: new require("mongoose").Types.ObjectId(schoolId),
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalViews: { $sum: "$viewsCount" },
              totalApplicants: { $sum: "$applicantsCount" },
            },
          },
        ]),
        JobApplication.aggregate([
          {
            $lookup: {
              from: "jobs",
              localField: "jobId",
              foreignField: "_id",
              as: "job",
            },
          },
          {
            $match: {
              "job.schoolId": new require("mongoose").Types.ObjectId(schoolId),
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
        JobView.aggregate([
          {
            $lookup: {
              from: "jobs",
              localField: "jobId",
              foreignField: "_id",
              as: "job",
            },
          },
          {
            $match: {
              "job.schoolId": new require("mongoose").Types.ObjectId(schoolId),
              createdAt: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              totalViews: { $sum: 1 },
              uniqueViews: { $sum: { $cond: ["$isUnique", 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      return {
        jobStats,
        applicationStats,
        viewStats,
      };
    } catch (error) {
      throw new Error(`Failed to get school dashboard stats: ${error.message}`);
    }
  }

  /**
   * Expire expired jobs
   */
  static async expireExpiredJobs() {
    try {
      const expiredJobs = await Job.findExpired();

      for (const job of expiredJobs) {
        job.status = "expired";
        await job.save();

        // Notify school about expired job
        await JobNotification.createNotification({
          userId: job.schoolId,
          type: "job_expired",
          title: "Job Expired",
          message: `Your job "${job.title}" has expired and is no longer accepting applications.`,
          category: "job",
          priority: "medium",
          actionRequired: true,
          actionUrl: `/jobs/${job._id}/edit`,
          actionText: "Repost Job",
        });
      }

      return { expiredCount: expiredJobs.length };
    } catch (error) {
      throw new Error(`Failed to expire jobs: ${error.message}`);
    }
  }

  /**
   * Sanitize job data for public viewing
   */
  static sanitizeJobForPublic(job) {
    const sanitized = { ...job };

    // Remove sensitive fields
    delete sanitized.schoolId;
    delete sanitized.applicantEmail;
    delete sanitized.viewsCount;
    delete sanitized.applicantsCount;

    // Add computed fields
    sanitized.salaryRange = this.calculateSalaryRange(job);
    sanitized.daysPosted = this.calculateDaysPosted(job.publishedAt);
    sanitized.isExpired = this.isJobExpired(job.applicationDeadline);

    return sanitized;
  }

  /**
   * Calculate salary range display
   */
  static calculateSalaryRange(job) {
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

  /**
   * Calculate days since posted
   */
  static calculateDaysPosted(publishedAt) {
    if (!publishedAt) return null;

    const now = new Date();
    const diffTime = Math.abs(now - publishedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if job is expired
   */
  static isJobExpired(applicationDeadline) {
    if (!applicationDeadline) return false;
    return new Date() > applicationDeadline;
  }

  /**
   * Build applied filters object
   */
  static buildAppliedFilters(filters) {
    const applied = {};

    Object.keys(filters).forEach((key) => {
      if (
        filters[key] !== undefined &&
        filters[key] !== null &&
        filters[key] !== ""
      ) {
        if (Array.isArray(filters[key]) && filters[key].length > 0) {
          applied[key] = filters[key];
        } else if (!Array.isArray(filters[key])) {
          applied[key] = filters[key];
        }
      }
    });

    return applied;
  }

  /**
   * Notify applicants about job closure
   */
  static async notifyApplicantsAboutJobClosure(jobId, status) {
    try {
      const applications = await JobApplication.find({
        jobId,
        status: { $nin: ["withdrawn", "rejected"] },
      });

      for (const application of applications) {
        await JobNotification.createNotification({
          userId: application.teacherId,
          type: `job_${status}`,
          title: "Job Update",
          message: `The job you applied for has been ${status}.`,
          category: "application",
          priority: "medium",
          actionRequired: false,
        });
      }
    } catch (error) {
      console.error("Failed to notify applicants about job closure:", error);
    }
  }
}

module.exports = JobService;
