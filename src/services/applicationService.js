const mongoose = require("mongoose");
const JobApplication = require("../models/JobApplication");
const Job = require("../models/Job");
const SavedJob = require("../models/SavedJob");
const JobNotification = require("../models/JobNotification");
const {
  sendApplicationConfirmationEmail,
  sendNewApplicationNotificationEmail,
} = require("../config/email");

class ApplicationService {
  /**
   * Submit a job application
   */
  static async submitApplication(jobId, teacherId, applicationData) {
    try {
      // Check if job exists and is active
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      if (!job.isAcceptingApplications()) {
        throw new Error("Job is not accepting applications");
      }

      // Check if teacher has already applied
      const existingApplication = await JobApplication.findOne({
        jobId,
        teacherId,
      });

      if (existingApplication) {
        throw new Error("You have already applied for this job");
      }

      // Create application
      // Ensure required fields are not overridden by request body
      const applicationFields = {
        ...applicationData,
        jobId,
        teacherId,
        status: "pending",
      };

      // Remove any undefined or null values that might cause validation issues
      Object.keys(applicationFields).forEach((key) => {
        if (
          applicationFields[key] === undefined ||
          applicationFields[key] === null
        ) {
          delete applicationFields[key];
        }
      });

      // Ensure required fields are present
      if (!applicationFields.teacherId) {
        throw new Error("teacherId is required");
      }
      if (!applicationFields.jobId) {
        throw new Error("jobId is required");
      }

      // Convert availableFrom to Date if it's a string
      if (
        applicationFields.availableFrom &&
        typeof applicationFields.availableFrom === "string"
      ) {
        applicationFields.availableFrom = new Date(
          applicationFields.availableFrom
        );
      }

      const application = new JobApplication(applicationFields);
      await application.save();

      // Increment job applicants count
      await job.incrementApplicants();

      // Mark job as saved if it was in saved jobs
      await SavedJob.findOneAndUpdate(
        { jobId, teacherId },
        { isApplied: true, appliedAt: new Date() },
        { upsert: false }
      );

      // Create notifications
      await Promise.all([
        // Notify teacher
        JobNotification.createNotification({
          userId: teacherId,
          type: "application_submitted",
          title: "Application Submitted Successfully",
          message: `Your application for "${job.title}" has been submitted successfully.`,
          category: "application",
          priority: "medium",
          actionRequired: false,
          // Remove actionUrl to avoid validation error
          actionText: "View Application",
        }),

        // Notify school (get school ID from job)
        JobNotification.createNotification({
          userId: job.schoolId,
          type: "new_candidate",
          title: "New Job Application",
          message: `A new candidate has applied for "${job.title}".`,
          category: "application",
          priority: "medium",
          actionRequired: true,
          // Remove actionUrl to avoid validation error
          actionText: "Review Applications",
        }),
      ]);

      // Populate job and teacher data for emails
      const populatedJob = await Job.findById(jobId)
        .populate("schoolId", "schoolName")
        .lean();

      const populatedTeacher = await require("../models/TeacherProfile")
        .findById(teacherId)
        .select("fullName email country city experience subjects")
        .lean();

      // Send email notifications
      await this.sendApplicationEmails(
        application,
        populatedJob,
        populatedTeacher
      );

      return application;
    } catch (error) {
      throw new Error(`Failed to submit application: ${error.message}`);
    }
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(applicationId, options = {}) {
    try {
      const { populateJob = false, populateTeacher = false } = options;

      let query = JobApplication.findById(applicationId);

      if (populateJob) {
        query = query.populate(
          "jobId",
          "title schoolId status applicationDeadline"
        );
      }

      if (populateTeacher) {
        query = query.populate(
          "teacherId",
          "fullName email phoneNumber country city"
        );
      }

      const application = await query.exec();

      if (!application) {
        throw new Error("Application not found");
      }

      return application;
    } catch (error) {
      throw new Error(`Failed to get application: ${error.message}`);
    }
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(applicationId, schoolId, updateData) {
    try {
      const { status, notes, rejectionReason, interviewDate, interviewNotes } =
        updateData;

      // Get application and verify school ownership
      const application = await this.getApplicationById(applicationId, {
        populateJob: true,
      });

      if (
        !application.jobId ||
        application.jobId.schoolId.toString() !== schoolId
      ) {
        throw new Error("Access denied to this application");
      }

      const oldStatus = application.status;

      // Update application
      if (status) {
        await application.updateStatus(status, notes);
      }

      if (rejectionReason) {
        application.rejectionReason = rejectionReason;
      }

      if (interviewDate) {
        application.interviewDate = interviewDate;
      }

      if (interviewNotes) {
        application.interviewNotes = interviewNotes;
      }

      await application.save();

      // Create notifications based on status change
      await this.createStatusChangeNotifications(
        application,
        oldStatus,
        status
      );

      // Send email notifications
      await this.sendStatusChangeEmails(application, oldStatus, status);

      return application;
    } catch (error) {
      throw new Error(`Failed to update application status: ${error.message}`);
    }
  }

  /**
   * Withdraw application
   */
  static async withdrawApplication(applicationId, teacherId, reason = "") {
    try {
      const application = await JobApplication.findOne({
        _id: applicationId,
        teacherId,
      });

      if (!application) {
        throw new Error("Application not found or access denied");
      }

      if (application.status === "withdrawn") {
        throw new Error("Application is already withdrawn");
      }

      if (application.status === "accepted") {
        throw new Error("Cannot withdraw accepted application");
      }

      // Withdraw application
      await application.withdraw(reason);

      // Decrement job applicants count
      const job = await Job.findById(application.jobId);
      if (job) {
        await job.decrementApplicants();
      }

      // Create notification for school
      await JobNotification.createNotification({
        userId: job.schoolId,
        type: "application_withdrawn",
        title: "Application Withdrawn",
        message: `A candidate has withdrawn their application for "${job.title}".`,
        category: "application",
        priority: "medium",
        actionRequired: false,
        actionUrl: `/jobs/${job._id}/applications`,
        actionText: "View Applications",
      });

      return application;
    } catch (error) {
      throw new Error(`Failed to withdraw application: ${error.message}`);
    }
  }

  /**
   * Get applications for a specific job
   */
  static async getApplicationsByJob(
    jobId,
    schoolId,
    filters = {},
    pagination = {}
  ) {
    try {
      // Verify school ownership of job
      const job = await Job.findOne({ _id: jobId, schoolId });
      if (!job) {
        throw new Error("Job not found or access denied");
      }

      const { page = 1, limit = 10, status } = pagination;
      const skip = (page - 1) * limit;

      const query = { jobId };

      if (status && status !== "all") {
        query.status = status;
      }

      const [applications, total] = await Promise.all([
        JobApplication.find(query)
          .populate("teacherId", "fullName email phoneNumber country city")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        JobApplication.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        applications: applications.map((app) =>
          this.sanitizeApplicationForSchool(app)
        ),
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
      throw new Error(`Failed to get job applications: ${error.message}`);
    }
  }

  /**
   * Get applications by teacher
   */
  static async getApplicationsByTeacher(
    teacherId,
    filters = {},
    pagination = {}
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        dateFrom,
        dateTo,
      } = pagination;
      const skip = (page - 1) * limit;

      const query = { teacherId };

      console.log("Debug - Query params:", { teacherId, filters, pagination });
      console.log("Debug - Initial query:", query);

      if (status && status !== "all") {
        query.status = status;
      }

      // Add date range filtering if provided
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          query.createdAt.$lte = new Date(dateTo);
        }
      }

      console.log("Debug - Final query:", query);

      // Use aggregation pipeline for search functionality
      let applications, total;

      if (search) {
        // Search in job title and school name
        const pipeline = [
          { $match: query },
          {
            $lookup: {
              from: "jobs",
              localField: "jobId",
              foreignField: "_id",
              as: "job",
            },
          },
          {
            $lookup: {
              from: "schoolprofiles",
              localField: "job.schoolId",
              foreignField: "_id",
              as: "school",
            },
          },
          {
            $match: {
              $or: [
                { "job.title": { $regex: search, $options: "i" } },
                { "school.schoolName": { $regex: search, $options: "i" } },
              ],
            },
          },
          {
            $addFields: {
              jobId: {
                _id: "$job._id",
                title: "$job.title",
                status: "$job.status",
                applicationDeadline: "$job.applicationDeadline",
                jobType: "$job.jobType",
                educationLevel: "$job.educationLevel",
                minSalary: "$job.minSalary",
                maxSalary: "$job.maxSalary",
                city: "$job.city",
                country: "$job.country",
                schoolName: { $arrayElemAt: ["$school.schoolName", 0] },
                stateProvince: { $arrayElemAt: ["$school.stateProvince", 0] },
              },
            },
          },
          {
            $project: {
              job: 0,
              school: 0,
            },
          },
          {
            $facet: {
              applications: [
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
              ],
              total: [{ $count: "count" }],
            },
          },
        ];

        console.log("Debug - Using aggregation pipeline for search");
        const result = await JobApplication.aggregate(pipeline);
        applications = result[0].applications;
        total = result[0].total[0]?.count || 0;
      } else {
        // Simple query without search - but with enhanced population
        console.log("Debug - Using simple query with enhanced population");

        // First get applications with basic job population
        const basicApplications = await JobApplication.find(query)
          .populate(
            "jobId",
            "title schoolId status applicationDeadline jobType educationLevel minSalary maxSalary city country"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        // Then enhance with school information
        const SchoolProfile = require("../models/SchoolProfile");
        applications = await Promise.all(
          basicApplications.map(async (app) => {
            if (app.jobId && app.jobId.schoolId) {
              // If job already has city/country, use those; otherwise fetch from SchoolProfile
              if (!app.jobId.city || !app.jobId.country) {
                const schoolProfile = await SchoolProfile.findById(
                  app.jobId.schoolId
                )
                  .select("schoolName city country stateProvince")
                  .lean();

                if (schoolProfile) {
                  app.jobId.schoolName = schoolProfile.schoolName;
                  // Only override if not already present
                  if (!app.jobId.city) app.jobId.city = schoolProfile.city;
                  if (!app.jobId.country)
                    app.jobId.country = schoolProfile.country;
                  app.jobId.stateProvince = schoolProfile.stateProvince;
                }
              } else {
                // Job has city/country, just fetch school name
                const schoolProfile = await SchoolProfile.findById(
                  app.jobId.schoolId
                )
                  .select("schoolName stateProvince")
                  .lean();

                if (schoolProfile) {
                  app.jobId.schoolName = schoolProfile.schoolName;
                  app.jobId.stateProvince = schoolProfile.stateProvince;
                }
              }
            }
            return app;
          })
        );

        total = await JobApplication.countDocuments(query);
      }

      console.log("Debug - Found applications:", applications.length);
      console.log("Debug - Total count:", total);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        applications: applications.map((app) =>
          this.sanitizeApplicationForTeacher(app)
        ),
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
      console.error("Debug - Error in getApplicationsByTeacher:", error);
      throw new Error(`Failed to get teacher applications: ${error.message}`);
    }
  }

  /**
   * Get all applications from all jobs posted by a school
   */
  static async getAllApplicationsBySchool(
    schoolId,
    filters = {},
    pagination = {}
  ) {
    try {
      const { page = 1, limit = 10, status, jobId } = pagination;
      const skip = (page - 1) * limit;

      // First, let's check if the school has any jobs
      // Note: schoolId might be the User ID, not the SchoolProfile ID

      // Try to find jobs by schoolId (which might be the User ID)
      let schoolJobs = await Job.find({ schoolId }).select(
        "_id title schoolId"
      );

      // If no jobs found, try to find by looking up the SchoolProfile
      if (schoolJobs.length === 0) {
        const SchoolProfile = require("../models/SchoolProfile");
        const schoolProfile = await SchoolProfile.findOne({ userId: schoolId });
        if (schoolProfile) {
          schoolJobs = await Job.find({ schoolId: schoolProfile._id }).select(
            "_id title schoolId"
          );
        }
      }

      if (schoolJobs.length === 0) {
        return {
          applications: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          summary: {
            totalApplications: 0,
            totalJobs: 0,
            applicationsByStatus: [],
          },
        };
      }

      // Build aggregation pipeline with better error handling
      const pipeline = [
        // Lookup job information
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "job",
          },
        },
        // Unwind the job array
        {
          $unwind: "$job",
        },
        // Match applications for jobs posted by the school
        // We need to match by the actual schoolId from the jobs
        {
          $match: {
            "job.schoolId": { $in: schoolJobs.map((job) => job.schoolId) },
          },
        },
        // Apply additional filters
        ...(status && status !== "all" ? [{ $match: { status } }] : []),
        ...(jobId ? [{ $match: { "job._id": jobId } }] : []),
        // Lookup teacher information
        {
          $lookup: {
            from: "teacherprofiles",
            localField: "teacherId",
            foreignField: "_id",
            as: "teacher",
          },
        },
        // Unwind the teacher array (preserve applications without teachers)
        {
          $unwind: {
            path: "$teacher",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Apply search filters if provided
        ...(filters.search
          ? [
              {
                $match: {
                  $or: [
                    {
                      "teacher.fullName": {
                        $regex: filters.search,
                        $options: "i",
                      },
                    },
                    { "job.title": { $regex: filters.search, $options: "i" } },
                    { coverLetter: { $regex: filters.search, $options: "i" } },
                    {
                      reasonForApplying: {
                        $regex: filters.search,
                        $options: "i",
                      },
                    },
                  ],
                },
              },
            ]
          : []),
        // Apply date range filters if provided
        ...(filters.dateFrom
          ? [
              {
                $match: { createdAt: { $gte: new Date(filters.dateFrom) } },
              },
            ]
          : []),
        ...(filters.dateTo
          ? [
              {
                $match: { createdAt: { $lte: new Date(filters.dateTo) } },
              },
            ]
          : []),
        // Apply salary range filters if provided
        ...(filters.minSalary
          ? [
              {
                $match: { expectedSalary: { $gte: filters.minSalary } },
              },
            ]
          : []),
        ...(filters.maxSalary
          ? [
              {
                $match: { expectedSalary: { $lte: filters.maxSalary } },
              },
            ]
          : []),
        // Apply experience filters if provided
        ...(filters.minExperience
          ? [
              {
                $match: {
                  $and: [
                    { teacher: { $exists: true, $ne: null } },
                    { "teacher.experience": { $gte: filters.minExperience } },
                  ],
                },
              },
            ]
          : []),
        // Sort by application creation date (newest first)
        {
          $sort: { createdAt: -1 },
        },
        // Add pagination
        {
          $facet: {
            applications: [
              { $skip: skip },
              { $limit: limit },
              // Project the final structure
              {
                $project: {
                  _id: 1,
                  status: 1,
                  coverLetter: 1,
                  expectedSalary: 1,
                  availableFrom: 1,
                  reasonForApplying: 1,
                  notes: 1,
                  rejectionReason: 1,
                  interviewDate: 1,
                  interviewNotes: 1,
                  createdAt: 1,
                  reviewedAt: 1,
                  withdrawnAt: 1,
                  withdrawnReason: 1,
                  job: {
                    _id: "$job._id",
                    title: "$job.title",
                    status: "$job.status",
                    applicationDeadline: "$job.applicationDeadline",
                    city: "$job.city",
                    country: "$job.country",
                    positionCategory: "$job.positionCategory",
                    educationLevel: "$job.educationLevel",
                    jobType: "$job.jobType",
                    isUrgent: "$job.isUrgent",
                  },
                  teacher: {
                    _id: "$teacher._id",
                    fullName: "$teacher.fullName",
                    country: "$teacher.country",
                    city: "$teacher.city",
                    experience: "$teacher.experience",
                    subjects: "$teacher.subjects",
                    qualifications: "$teacher.qualifications",
                  },
                },
              },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];

      const result = await JobApplication.aggregate(pipeline);

      const applications = result[0]?.applications || [];
      const total = result[0]?.total?.[0]?.count || 0;

      // Get job IDs for fallback queries
      const jobIds = schoolJobs.map((job) => job._id);

      const directApplications = await JobApplication.find({
        jobId: { $in: jobIds },
      });

      // If aggregation is not working, let's use the direct approach as fallback
      if (applications.length === 0 && directApplications.length > 0) {
        const fallbackApplications = await JobApplication.find({
          jobId: { $in: jobIds },
        })
          .populate(
            "jobId",
            "title status city country positionCategory educationLevel jobType isUrgent"
          )
          .populate(
            "teacherId",
            "fullName country city experience subjects qualifications"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

        const totalDirect = await JobApplication.countDocuments({
          jobId: { $in: jobIds },
        });

        const totalPagesDirect = Math.ceil(totalDirect / limit);
        const hasNextPageDirect = page < totalPagesDirect;
        const hasPrevPageDirect = page > 1;

        return {
          applications: fallbackApplications.map((app) =>
            this.sanitizeApplicationForSchool(app)
          ),
          pagination: {
            page,
            limit,
            total: totalDirect,
            totalPages: totalPagesDirect,
            hasNextPage: hasNextPageDirect,
            hasPrevPage: hasPrevPageDirect,
          },
          summary: {
            totalApplications: totalDirect,
            totalJobs: schoolJobs.length,
            applicationsByStatus: await this.getApplicationStatusCounts(
              schoolId
            ),
          },
        };
      }

      // Also check if aggregation is working but returning wrong count
      if (
        applications.length > 0 &&
        applications.length < directApplications.length
      ) {
        const directPopulatedApplications = await JobApplication.find({
          jobId: { $in: jobIds },
        })
          .populate(
            "jobId",
            "title status city country positionCategory educationLevel jobType isUrgent"
          )
          .populate(
            "teacherId",
            "fullName country city experience subjects qualifications"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

        const totalDirect = await JobApplication.countDocuments({
          jobId: { $in: jobIds },
        });

        const totalPagesDirect = Math.ceil(totalDirect / limit);
        const hasNextPageDirect = page < totalPagesDirect;
        const hasPrevPageDirect = page > 1;

        return {
          applications: directPopulatedApplications.map((app) =>
            this.sanitizeApplicationForSchool(app)
          ),
          pagination: {
            page,
            limit,
            total: totalDirect,
            totalPages: totalPagesDirect,
            hasNextPage: hasNextPageDirect,
            hasPrevPage: hasPrevPageDirect,
          },
          summary: {
            totalApplications: totalDirect,
            totalJobs: schoolJobs.length,
            applicationsByStatus: await this.getApplicationStatusCounts(
              schoolId
            ),
          },
        };
      }

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        applications: applications.map((app) =>
          this.sanitizeApplicationForSchool(app)
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        summary: {
          totalApplications: total,
          totalJobs: schoolJobs.length,
          applicationsByStatus: await this.getApplicationStatusCounts(schoolId),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get all applications by school: ${error.message}`
      );
    }
  }

  /**
   * Get application status counts for a school
   */
  static async getApplicationStatusCounts(schoolId) {
    try {
      const statusCounts = await JobApplication.aggregate([
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "job",
          },
        },
        {
          $unwind: "$job",
        },
        {
          $match: {
            "job.schoolId": schoolId,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return statusCounts;
    } catch (error) {
      throw new Error(
        `Failed to get application status counts: ${error.message}`
      );
    }
  }

  /**
   * Get applications by specific job for a school (with verification)
   */
  static async getApplicationsByJobForSchool(
    jobId,
    schoolId,
    filters = {},
    pagination = {}
  ) {
    try {
      // First verify the job belongs to the school
      const job = await Job.findOne({ _id: jobId, schoolId });
      if (!job) {
        throw new Error("Job not found or access denied");
      }

      // Use the existing getApplicationsByJob method
      return await this.getApplicationsByJob(
        jobId,
        schoolId,
        filters,
        pagination
      );
    } catch (error) {
      throw new Error(
        `Failed to get applications by job for school: ${error.message}`
      );
    }
  }

  /**
   * Sanitize application data for teacher viewing
   */
  static sanitizeApplicationForTeacher(application) {
    const sanitized = { ...application };

    // Remove sensitive school information
    if (sanitized.jobId && sanitized.jobId.schoolId) {
      delete sanitized.jobId.schoolId;
    }

    return sanitized;
  }

  /**
   * Sanitize application data for school viewing
   */
  static sanitizeApplicationForSchool(application) {
    // Convert Mongoose document to plain object and remove sensitive fields
    const sanitized = application.toObject
      ? application.toObject()
      : { ...application };

    // Remove sensitive teacher information
    if (sanitized.teacherId) {
      delete sanitized.teacherId.phoneNumber;
      delete sanitized.teacherId.email;
      delete sanitized.teacherId.password;
      delete sanitized.teacherId.__v;
    }

    // Remove sensitive application information
    delete sanitized.__v;
    delete sanitized.$__;
    delete sanitized.$isNew;
    delete sanitized._doc;

    // Ensure proper structure for job and teacher data
    if (sanitized.jobId && typeof sanitized.jobId === "object") {
      sanitized.job = sanitized.jobId;
      delete sanitized.jobId;
    }

    if (sanitized.teacherId && typeof sanitized.teacherId === "object") {
      sanitized.teacher = sanitized.teacherId;
      delete sanitized.teacherId;
    }

    return sanitized;
  }
  /**
   * Get recent applications for a school (latest N applications)
   */
  static async getRecentApplications(schoolId, limit = 5) {
    try {
      const recentApplications = await JobApplication.find()
        .populate("jobId", "title status")
        .populate(
          "teacherId",
          "fullName email country city experience subjects"
        )
        .where("schoolId")
        .equals(schoolId)
        .sort({ createdAt: -1 })
        .limit(Number(limit)) // Ensure it's a number
        .lean();

      return recentApplications.map((app) =>
        this.sanitizeApplicationForSchool(app)
      );
    } catch (error) {
      throw new Error(`Failed to get recent applications: ${error.message}`);
    }
  }

  /**
   * Get summarized application statistics for a school
   */
  static async getApplicationStats(schoolId) {
    try {
      // 1. Total Jobs posted by this school
      const totalJobs = await Job.countDocuments({ schoolId });

      // 2. Active Jobs
      const activeJobs = await Job.countDocuments({
        schoolId,
        status: "active",
      });

      // 3. Total Applications
      const totalApplicants = await JobApplication.countDocuments({ schoolId });

      // 4. Hired Applicants
      const hiredApplicants = await JobApplication.countDocuments({
        schoolId,
        status: "hired",
      });

      // 5. Hiring Ratio
      const hiringRatio =
        totalApplicants > 0
          ? ((hiredApplicants / totalApplicants) * 100).toFixed(2)
          : 0;

      return {
        totalJobs,
        activeJobs,
        totalApplicants,
        hiredApplicants,
        hiringRatio,
      };
    } catch (error) {
      throw new Error(`Failed to get application stats: ${error.message}`);
    }
  }
}

module.exports = ApplicationService;
