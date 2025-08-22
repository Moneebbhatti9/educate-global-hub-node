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
      console.log("ApplicationService.submitApplication called with:", {
        jobId,
        teacherId,
        applicationData,
      });
      console.log("teacherId type:", typeof teacherId, "value:", teacherId);

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

      console.log("Creating JobApplication with data:", applicationFields);

      const application = new JobApplication(applicationFields);

      console.log("JobApplication instance created:", application);
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
      const { page = 1, limit = 10, status } = pagination;
      const skip = (page - 1) * limit;

      const query = { teacherId };

      if (status && status !== "all") {
        query.status = status;
      }

      const [applications, total] = await Promise.all([
        JobApplication.find(query)
          .populate("jobId", "title schoolId status applicationDeadline")
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
      throw new Error(`Failed to get teacher applications: ${error.message}`);
    }
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(userId, userRole) {
    try {
      let stats;

      if (userRole === "school") {
        // Get stats for school's jobs
        stats = await JobApplication.aggregate([
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
              "job.schoolId": new mongoose.Types.ObjectId(userId),
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]);
      } else {
        // Get stats for teacher's applications
        stats = await JobApplication.aggregate([
          {
            $match: {
              teacherId: new mongoose.Types.ObjectId(userId),
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]);
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get application stats: ${error.message}`);
    }
  }

  /**
   * Get recent applications for dashboard
   */
  static async getRecentApplications(userId, userRole, limit = 5) {
    try {
      let query;

      if (userRole === "school") {
        // Get recent applications for school's jobs
        query = JobApplication.aggregate([
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
              "job.schoolId": new mongoose.Types.ObjectId(userId),
            },
          },
          {
            $sort: { createdAt: -1 },
          },
          {
            $limit: limit,
          },
          {
            $lookup: {
              from: "teacherprofiles",
              localField: "teacherId",
              foreignField: "_id",
              as: "teacher",
            },
          },
        ]);
      } else {
        // Get recent applications for teacher
        query = JobApplication.find({ teacherId: userId })
          .populate("jobId", "title schoolId status applicationDeadline")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
      }

      const applications = await query;
      return applications;
    } catch (error) {
      throw new Error(`Failed to get recent applications: ${error.message}`);
    }
  }

  /**
   * Send application emails
   */
  static async sendApplicationEmails(
    application,
    populatedJob,
    populatedTeacher
  ) {
    try {
      // Prepare template data for teacher confirmation email
      const teacherTemplateData = {
        teacherName: populatedTeacher.fullName,
        jobTitle: populatedJob.title,
        schoolName: populatedJob.schoolId.schoolName,
        applicationId: application._id,
        city: populatedJob.city,
        country: populatedJob.country,
        positionCategory: populatedJob.positionCategory,
        educationLevel: populatedJob.educationLevel,
        jobType: populatedJob.jobType,
        isUrgent: populatedJob.isUrgent,
        applicationDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        dashboardUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/dashboard/applications/${application._id}`,
      };

      // Prepare template data for school notification email
      const schoolTemplateData = {
        jobTitle: populatedJob.title,
        organization: populatedJob.organization,
        city: populatedJob.city,
        country: populatedJob.country,
        applicationId: application._id,
        isUrgent: populatedJob.isUrgent,
        teacherName: populatedTeacher.fullName,
        teacherEmail: populatedTeacher.email,
        teacherCity: populatedTeacher.city,
        teacherCountry: populatedTeacher.country,
        teacherExperience: populatedTeacher.experience || "Not specified",
        teacherSubjects: populatedTeacher.subjects
          ? populatedTeacher.subjects.join(", ")
          : "Not specified",
        applicationDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        dashboardUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/dashboard/jobs/${populatedJob._id}/applications`,
      };

      // Send confirmation email to teacher
      await sendApplicationConfirmationEmail(
        populatedTeacher.email,
        teacherTemplateData
      );

      // Send notification email to school using applicantEmail from job
      await sendNewApplicationNotificationEmail(
        populatedJob.applicantEmail,
        schoolTemplateData
      );

      console.log(
        `Application emails sent successfully for application ${application._id}`
      );
    } catch (error) {
      console.error("Failed to send application emails:", error);
      // Don't throw error for email failures
    }
  }

  /**
   * Send status change emails
   */
  static async sendStatusChangeEmails(application, oldStatus, newStatus) {
    try {
      if (oldStatus === newStatus) return;

      const job = await Job.findById(application.jobId);
      const teacher = await require("../models/TeacherProfile").findById(
        application.teacherId
      );

      if (!job || !teacher) return;

      // Send email to teacher about status change
      await sendEmail({
        to: teacher.email,
        subject: `Application Status Updated - ${job.title}`,
        template: "application-status-update",
        context: {
          teacherName: teacher.fullName,
          jobTitle: job.title,
          oldStatus,
          newStatus,
          applicationId: application._id,
          notes: application.notes,
        },
      });
    } catch (error) {
      console.error("Failed to send status change emails:", error);
      // Don't throw error for email failures
    }
  }

  /**
   * Create status change notifications
   */
  static async createStatusChangeNotifications(
    application,
    oldStatus,
    newStatus
  ) {
    try {
      if (oldStatus === newStatus) return;

      const job = await Job.findById(application.jobId);
      if (!job) return;

      // Create notification for teacher
      await JobNotification.createNotification({
        userId: application.teacherId,
        type: `application_${newStatus}`,
        title: "Application Status Updated",
        message: `Your application for "${job.title}" has been updated to ${newStatus}.`,
        category: "application",
        priority: "medium",
        actionRequired: newStatus === "interviewed" || newStatus === "accepted",
        // Remove actionUrl to avoid validation error
        actionText: "View Details",
      });
    } catch (error) {
      console.error("Failed to create status change notifications:", error);
      // Don't throw error for notification failures
    }
  }

  /**
   * Sanitize application data for school viewing
   */
  static sanitizeApplicationForSchool(application) {
    const sanitized = { ...application };

    // Remove sensitive teacher information
    if (sanitized.teacherId) {
      delete sanitized.teacherId.phoneNumber;
      delete sanitized.teacherId.email;
    }

    return sanitized;
  }

  /**
   * Sanitize application data for teacher viewing
   */
  static sanitizeApplicationForTeacher(application) {
    const sanitized = { ...application };

    // Remove sensitive school information
    if (sanitized.jobId) {
      delete sanitized.jobId.schoolId;
    }

    return sanitized;
  }

  /**
   * Get overdue applications (in reviewing status for too long)
   */
  static async getOverdueApplications(schoolId) {
    try {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 14); // 14 days threshold

      const applications = await JobApplication.aggregate([
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
            "job.schoolId": new mongoose.Types.ObjectId(schoolId),
            status: "reviewing",
            createdAt: { $lt: overdueDate },
          },
        },
        {
          $lookup: {
            from: "teacherprofiles",
            localField: "teacherId",
            foreignField: "_id",
            as: "teacher",
          },
        },
        {
          $sort: { createdAt: 1 },
        },
      ]);

      return applications;
    } catch (error) {
      throw new Error(`Failed to get overdue applications: ${error.message}`);
    }
  }

  /**
   * Bulk update application statuses
   */
  static async bulkUpdateApplicationStatuses(
    applicationIds,
    schoolId,
    updateData
  ) {
    try {
      const results = [];

      for (const applicationId of applicationIds) {
        try {
          const result = await this.updateApplicationStatus(
            applicationId,
            schoolId,
            updateData
          );
          results.push({ id: applicationId, success: true, data: result });
        } catch (error) {
          results.push({
            id: applicationId,
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk update applications: ${error.message}`);
    }
  }
}

module.exports = ApplicationService;
