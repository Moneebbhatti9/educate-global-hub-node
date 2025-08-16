const ApplicationService = require("../services/applicationService");
const { sendResponse } = require("../utils/response");

class ApplicationController {
  /**
   * Submit a job application
   */
  static async submitApplication(req, res) {
    try {
      const { jobId } = req.params;
      const { userId, role } = req.user;
      const applicationData = req.body;

      console.log("Submit application request:", {
        jobId,
        userId,
        role,
        applicationData,
      });

      // For teachers, we need to get the TeacherProfile ID from the User ID
      let teacherId = userId;
      if (role === "teacher") {
        const TeacherProfile = require("../models/TeacherProfile");
        const teacherProfile = await TeacherProfile.findOne({ userId });
        if (!teacherProfile) {
          return sendResponse(res, 400, false, "Teacher profile not found");
        }
        teacherId = teacherProfile._id;
        console.log("Found teacher profile:", teacherProfile._id);
      }

      console.log("Final teacherId:", teacherId);

      const application = await ApplicationService.submitApplication(
        jobId,
        teacherId,
        applicationData
      );

      return sendResponse(
        res,
        201,
        true,
        "Application submitted successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(req, res) {
    try {
      const { applicationId } = req.params;
      const { userId, role } = req.user;

      let options = {};

      if (role === "school") {
        options.populateTeacher = true;
      } else {
        options.populateJob = true;
      }

      const application = await ApplicationService.getApplicationById(
        applicationId,
        options
      );

      // Verify access
      if (role === "teacher" && application.teacherId.toString() !== userId) {
        return sendResponse(
          res,
          403,
          false,
          "Access denied to this application"
        );
      }

      if (role === "school") {
        // Verify school owns the job
        const job = await require("../models/Job").findById(application.jobId);
        if (!job || job.schoolId.toString() !== userId) {
          return sendResponse(
            res,
            403,
            false,
            "Access denied to this application"
          );
        }
      }

      return sendResponse(
        res,
        200,
        true,
        "Application retrieved successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 404, false, error.message);
    }
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const updateData = req.body;

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(
        res,
        200,
        true,
        "Application status updated successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Withdraw application
   */
  static async withdrawApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { teacherId } = req.user;
      const { reason } = req.body;

      const application = await ApplicationService.withdrawApplication(
        applicationId,
        teacherId,
        reason
      );

      return sendResponse(
        res,
        200,
        true,
        "Application withdrawn successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get applications for a specific job
   */
  static async getApplicationsByJob(req, res) {
    try {
      const { jobId } = req.params;
      const { schoolId } = req.user;

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
   * Get applications by teacher
   */
  static async getApplicationsByTeacher(req, res) {
    try {
      const { teacherId } = req.params;
      const { userId, role } = req.user;

      // Verify access
      if (role === "teacher" && teacherId !== userId) {
        return sendResponse(res, 403, false, "Access denied");
      }

      const filters = {
        status: req.query.status || "all",
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      };

      const result = await ApplicationService.getApplicationsByTeacher(
        teacherId,
        filters,
        pagination
      );

      return sendResponse(
        res,
        200,
        true,
        "Teacher applications retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(req, res) {
    try {
      const { userId, role } = req.user;

      const stats = await ApplicationService.getApplicationStats(userId, role);

      return sendResponse(
        res,
        200,
        true,
        "Application statistics retrieved successfully",
        { stats }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get recent applications for dashboard
   */
  static async getRecentApplications(req, res) {
    try {
      const { userId, role } = req.user;
      const limit = parseInt(req.query.limit) || 5;

      const applications = await ApplicationService.getRecentApplications(
        userId,
        role,
        limit
      );

      return sendResponse(
        res,
        200,
        true,
        "Recent applications retrieved successfully",
        { applications }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get overdue applications
   */
  static async getOverdueApplications(req, res) {
    try {
      const { schoolId } = req.user;

      const overdueApplications =
        await ApplicationService.getOverdueApplications(schoolId);

      return sendResponse(
        res,
        200,
        true,
        "Overdue applications retrieved successfully",
        { overdueApplications }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Bulk update application statuses
   */
  static async bulkUpdateApplicationStatuses(req, res) {
    try {
      const { schoolId } = req.user;
      const { applicationIds, ...updateData } = req.body;

      if (
        !applicationIds ||
        !Array.isArray(applicationIds) ||
        applicationIds.length === 0
      ) {
        return sendResponse(
          res,
          400,
          false,
          "Application IDs array is required"
        );
      }

      const results = await ApplicationService.bulkUpdateApplicationStatuses(
        applicationIds,
        schoolId,
        updateData
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return sendResponse(
        res,
        200,
        true,
        `Bulk update completed. ${successCount} successful, ${failureCount} failed.`,
        {
          results,
          summary: { successCount, failureCount, total: applicationIds.length },
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Schedule interview for application
   */
  static async scheduleInterview(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const { interviewDate, interviewNotes } = req.body;

      if (!interviewDate) {
        return sendResponse(res, 400, false, "Interview date is required");
      }

      const updateData = {
        status: "interviewed",
        interviewDate: new Date(interviewDate),
        interviewNotes,
      };

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(res, 200, true, "Interview scheduled successfully", {
        application,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Accept application
   */
  static async acceptApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const { notes } = req.body;

      const updateData = {
        status: "accepted",
        notes,
      };

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(res, 200, true, "Application accepted successfully", {
        application,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Reject application
   */
  static async rejectApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const { rejectionReason, notes } = req.body;

      if (!rejectionReason) {
        return sendResponse(res, 400, false, "Rejection reason is required");
      }

      const updateData = {
        status: "rejected",
        rejectionReason,
        notes,
      };

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(res, 200, true, "Application rejected successfully", {
        application,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Shortlist application
   */
  static async shortlistApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const { notes } = req.body;

      const updateData = {
        status: "shortlisted",
        notes,
      };

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(
        res,
        200,
        true,
        "Application shortlisted successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Move application to reviewing
   */
  static async moveToReviewing(req, res) {
    try {
      const { applicationId } = req.params;
      const { schoolId } = req.user;
      const { notes } = req.body;

      const updateData = {
        status: "reviewing",
        notes,
      };

      const application = await ApplicationService.updateApplicationStatus(
        applicationId,
        schoolId,
        updateData
      );

      return sendResponse(
        res,
        200,
        true,
        "Application moved to reviewing successfully",
        { application }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get application timeline
   */
  static async getApplicationTimeline(req, res) {
    try {
      const { applicationId } = req.params;
      const { userId, role } = req.user;

      const application = await ApplicationService.getApplicationById(
        applicationId,
        { populateJob: true, populateTeacher: true }
      );

      // Verify access
      if (role === "teacher" && application.teacherId.toString() !== userId) {
        return sendResponse(
          res,
          403,
          false,
          "Access denied to this application"
        );
      }

      if (role === "school") {
        const job = await require("../models/Job").findById(application.jobId);
        if (!job || job.schoolId.toString() !== userId) {
          return sendResponse(
            res,
            403,
            false,
            "Access denied to this application"
          );
        }
      }

      // Build timeline
      const timeline = [
        {
          date: application.createdAt,
          action: "Application Submitted",
          description: "Application was submitted",
          status: "completed",
        },
      ];

      if (application.reviewedAt) {
        timeline.push({
          date: application.reviewedAt,
          action: "Application Reviewed",
          description: `Status changed to ${application.status}`,
          status: "completed",
        });
      }

      if (application.interviewDate) {
        timeline.push({
          date: application.interviewDate,
          action: "Interview Scheduled",
          description: application.interviewNotes || "Interview scheduled",
          status: "completed",
        });
      }

      if (application.withdrawnAt) {
        timeline.push({
          date: application.withdrawnAt,
          action: "Application Withdrawn",
          description:
            application.withdrawnReason || "Application was withdrawn",
          status: "completed",
        });
      }

      // Sort timeline by date
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      return sendResponse(
        res,
        200,
        true,
        "Application timeline retrieved successfully",
        { timeline }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Export applications data
   */
  static async exportApplications(req, res) {
    try {
      const { jobId } = req.params;
      const { schoolId } = req.user;
      const { format = "json", status } = req.query;

      const filters = { status: status || "all" };
      const pagination = { page: 1, limit: 1000 }; // Get all applications

      const result = await ApplicationService.getApplicationsByJob(
        jobId,
        schoolId,
        filters,
        pagination
      );

      if (format === "csv") {
        // Convert to CSV format
        const csvData = this.convertApplicationsToCSV(result.applications);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=applications.csv"
        );
        return res.send(csvData);
      }

      // Default JSON format
      return sendResponse(
        res,
        200,
        true,
        "Applications exported successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Convert applications to CSV format
   */
  static convertApplicationsToCSV(applications) {
    const headers = [
      "Candidate Name",
      "Email",
      "Phone",
      "Country",
      "City",
      "Status",
      "Cover Letter",
      "Expected Salary",
      "Available From",
      "Reason for Applying",
      "Applied At",
      "Reviewed At",
    ];

    const csvRows = [headers.join(",")];

    applications.forEach((application) => {
      const row = [
        `"${application.teacherId?.fullName || "N/A"}"`,
        `"${application.teacherId?.email || "N/A"}"`,
        `"${application.teacherId?.phoneNumber || "N/A"}"`,
        `"${application.teacherId?.country || "N/A"}"`,
        `"${application.teacherId?.city || "N/A"}"`,
        application.status,
        `"${application.coverLetter}"`,
        application.expectedSalary || "N/A",
        application.availableFrom,
        `"${application.reasonForApplying}"`,
        application.createdAt,
        application.reviewedAt || "N/A",
      ];

      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }
}

module.exports = ApplicationController;
