const SavedJobService = require("../services/savedJobService");
const { sendResponse } = require("../utils/response");

class SavedJobController {
  /**
   * Save a job
   */
  static async saveJob(req, res) {
    try {
      const { jobId } = req.params;
      const { teacherId } = req.user;
      const saveData = req.body;

      const savedJob = await SavedJobService.saveJob(
        teacherId,
        jobId,
        saveData
      );

      return sendResponse(res, 201, true, "Job saved successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get saved jobs for teacher
   */
  static async getSavedJobs(req, res) {
    try {
      const { teacherId } = req.user;
      const filters = {
        priority: req.query.priority,
        isApplied:
          req.query.isApplied !== undefined
            ? req.query.isApplied === "true"
            : undefined,
        tags: req.query.tags ? req.query.tags.split(",") : undefined,
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      };

      const result = await SavedJobService.getSavedJobs(
        teacherId,
        filters,
        pagination
      );

      return sendResponse(
        res,
        200,
        true,
        "Saved jobs retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get saved job by ID
   */
  static async getSavedJobById(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;

      const savedJob = await SavedJobService.getSavedJobById(
        savedJobId,
        teacherId
      );

      return sendResponse(res, 200, true, "Saved job retrieved successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 404, false, error.message);
    }
  }

  /**
   * Update saved job
   */
  static async updateSavedJob(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const updateData = req.body;

      const savedJob = await SavedJobService.updateSavedJob(
        savedJobId,
        teacherId,
        updateData
      );

      return sendResponse(res, 200, true, "Saved job updated successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Remove saved job
   */
  static async removeSavedJob(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;

      const result = await SavedJobService.removeSavedJob(
        savedJobId,
        teacherId
      );

      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Check if job is saved
   */
  static async isJobSaved(req, res) {
    try {
      const { jobId } = req.params;
      const { teacherId } = req.user;

      const isSaved = await SavedJobService.isJobSaved(teacherId, jobId);

      return sendResponse(
        res,
        200,
        true,
        "Job saved status checked successfully",
        { isSaved }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get saved job statistics
   */
  static async getSavedJobStats(req, res) {
    try {
      const { teacherId } = req.user;

      const stats = await SavedJobService.getSavedJobStats(teacherId);

      return sendResponse(
        res,
        200,
        true,
        "Saved job statistics retrieved successfully",
        { stats }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get jobs to apply for
   */
  static async getJobsToApply(req, res) {
    try {
      const { teacherId } = req.user;
      const limit = parseInt(req.query.limit) || 10;

      const savedJobs = await SavedJobService.getJobsToApply(teacherId, limit);

      return sendResponse(
        res,
        200,
        true,
        "Jobs to apply for retrieved successfully",
        { savedJobs }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get overdue reminders
   */
  static async getOverdueReminders(req, res) {
    try {
      const { teacherId } = req.user;

      const overdueReminders = await SavedJobService.getOverdueReminders(
        teacherId
      );

      return sendResponse(
        res,
        200,
        true,
        "Overdue reminders retrieved successfully",
        { overdueReminders }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Set reminder for saved job
   */
  static async setReminder(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const { reminderDate } = req.body;

      if (!reminderDate) {
        return sendResponse(res, 400, false, "Reminder date is required");
      }

      const savedJob = await SavedJobService.setReminder(
        savedJobId,
        teacherId,
        new Date(reminderDate)
      );

      return sendResponse(res, 200, true, "Reminder set successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Update priority of saved job
   */
  static async updatePriority(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const { priority } = req.body;

      if (!priority) {
        return sendResponse(res, 400, false, "Priority is required");
      }

      const savedJob = await SavedJobService.updatePriority(
        savedJobId,
        teacherId,
        priority
      );

      return sendResponse(res, 200, true, "Priority updated successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Add notes to saved job
   */
  static async addNotes(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const { notes } = req.body;

      if (!notes) {
        return sendResponse(res, 400, false, "Notes are required");
      }

      const savedJob = await SavedJobService.addNotes(
        savedJobId,
        teacherId,
        notes
      );

      return sendResponse(res, 200, true, "Notes added successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Add tags to saved job
   */
  static async addTags(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return sendResponse(res, 400, false, "Tags array is required");
      }

      const savedJob = await SavedJobService.addTags(
        savedJobId,
        teacherId,
        tags
      );

      return sendResponse(res, 200, true, "Tags added successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Remove tags from saved job
   */
  static async removeTags(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return sendResponse(res, 400, false, "Tags array is required");
      }

      const savedJob = await SavedJobService.removeTags(
        savedJobId,
        teacherId,
        tags
      );

      return sendResponse(res, 200, true, "Tags removed successfully", {
        savedJob,
      });
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get saved jobs by tags
   */
  static async getSavedJobsByTags(req, res) {
    try {
      const { teacherId } = req.user;
      const { tags } = req.query;

      if (!tags) {
        return sendResponse(res, 400, false, "Tags parameter is required");
      }

      const tagArray = tags.split(",");
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      };

      const result = await SavedJobService.getSavedJobsByTags(
        teacherId,
        tagArray,
        pagination
      );

      return sendResponse(
        res,
        200,
        true,
        "Saved jobs by tags retrieved successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get all tags used by teacher
   */
  static async getTeacherTags(req, res) {
    try {
      const { teacherId } = req.user;

      const tags = await SavedJobService.getTeacherTags(teacherId);

      return sendResponse(
        res,
        200,
        true,
        "Teacher tags retrieved successfully",
        { tags }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Bulk save jobs
   */
  static async bulkSaveJobs(req, res) {
    try {
      const { teacherId } = req.user;
      const { jobIds, ...saveData } = req.body;

      if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
        return sendResponse(res, 400, false, "Job IDs array is required");
      }

      const results = await SavedJobService.bulkSaveJobs(
        teacherId,
        jobIds,
        saveData
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return sendResponse(
        res,
        200,
        true,
        `Bulk save completed. ${successCount} successful, ${failureCount} failed.`,
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
   * Bulk remove saved jobs
   */
  static async bulkRemoveSavedJobs(req, res) {
    try {
      const { teacherId } = req.user;
      const { savedJobIds } = req.body;

      if (
        !savedJobIds ||
        !Array.isArray(savedJobIds) ||
        savedJobIds.length === 0
      ) {
        return sendResponse(res, 400, false, "Saved job IDs array is required");
      }

      const results = await SavedJobService.bulkRemoveSavedJobs(
        teacherId,
        savedJobIds
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return sendResponse(
        res,
        200,
        true,
        `Bulk removal completed. ${successCount} successful, ${failureCount} failed.`,
        {
          results,
          summary: { successCount, failureCount, total: savedJobIds.length },
        }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Mark saved job as applied
   */
  static async markAsApplied(req, res) {
    try {
      const { savedJobId } = req.params;
      const { teacherId } = req.user;

      const savedJob = await SavedJobService.updateSavedJob(
        savedJobId,
        teacherId,
        { isApplied: true }
      );

      return sendResponse(
        res,
        200,
        true,
        "Saved job marked as applied successfully",
        { savedJob }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Get saved job analytics
   */
  static async getSavedJobAnalytics(req, res) {
    try {
      const { teacherId } = req.user;

      const [stats, jobsToApply, overdueReminders, tags] = await Promise.all([
        SavedJobService.getSavedJobStats(teacherId),
        SavedJobService.getJobsToApply(teacherId, 5),
        SavedJobService.getOverdueReminders(teacherId),
        SavedJobService.getTeacherTags(teacherId),
      ]);

      const analytics = {
        stats,
        jobsToApply: jobsToApply.length,
        overdueReminders: overdueReminders.length,
        totalTags: tags.length,
        topTags: tags.slice(0, 5),
      };

      return sendResponse(
        res,
        200,
        true,
        "Saved job analytics retrieved successfully",
        { analytics }
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Export saved jobs data
   */
  static async exportSavedJobs(req, res) {
    try {
      const { teacherId } = req.user;
      const { format = "json", priority, isApplied } = req.query;

      const filters = {
        priority: priority || undefined,
        isApplied: isApplied !== undefined ? isApplied === "true" : undefined,
      };

      const pagination = { page: 1, limit: 1000 }; // Get all saved jobs

      const result = await SavedJobService.getSavedJobs(
        teacherId,
        filters,
        pagination
      );

      if (format === "csv") {
        // Convert to CSV format
        const csvData = this.convertSavedJobsToCSV(result.savedJobs);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=saved-jobs.csv"
        );
        return res.send(csvData);
      }

      // Default JSON format
      return sendResponse(
        res,
        200,
        true,
        "Saved jobs exported successfully",
        result
      );
    } catch (error) {
      return sendResponse(res, 400, false, error.message);
    }
  }

  /**
   * Convert saved jobs to CSV format
   */
  static convertSavedJobsToCSV(savedJobs) {
    const headers = [
      "Job Title",
      "Priority",
      "Notes",
      "Tags",
      "Reminder Date",
      "Is Applied",
      "Applied At",
      "Saved At",
    ];

    const csvRows = [headers.join(",")];

    savedJobs.forEach((savedJob) => {
      const row = [
        `"${savedJob.jobId?.title || "N/A"}"`,
        savedJob.priority,
        `"${savedJob.notes || ""}"`,
        `"${savedJob.tags.join("; ") || ""}"`,
        savedJob.reminderDate || "N/A",
        savedJob.isApplied ? "Yes" : "No",
        savedJob.appliedAt || "N/A",
        savedJob.savedAt,
      ];

      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }
}

module.exports = SavedJobController;
