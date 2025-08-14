const SavedJob = require("../models/SavedJob");
const Job = require("../models/Job");
const JobNotification = require("../models/JobNotification");

class SavedJobService {
  /**
   * Save a job for a teacher
   */
  static async saveJob(teacherId, jobId, saveData = {}) {
    try {
      // Check if job exists and is active
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      if (job.status !== "published") {
        throw new Error("Cannot save inactive job");
      }

      // Check if already saved
      const existingSavedJob = await SavedJob.findOne({ teacherId, jobId });
      if (existingSavedJob) {
        throw new Error("Job is already saved");
      }

      // Create saved job
      const savedJob = new SavedJob({
        teacherId,
        jobId,
        ...saveData,
      });

      await savedJob.save();

      // Create notification
      await JobNotification.createNotification({
        userId: teacherId,
        type: "job_saved",
        title: "Job Saved Successfully",
        message: `"${job.title}" has been added to your saved jobs.`,
        category: "job",
        priority: "low",
        actionRequired: false,
        actionUrl: `/saved-jobs/${savedJob._id}`,
        actionText: "View Saved Job",
      });

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to save job: ${error.message}`);
    }
  }

  /**
   * Get saved jobs for a teacher
   */
  static async getSavedJobs(teacherId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, priority, isApplied, tags } = filters;
      const skip = (page - 1) * limit;

      const query = { teacherId };

      if (priority) {
        query.priority = priority;
      }

      if (isApplied !== undefined) {
        query.isApplied = isApplied;
      }

      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      const [savedJobs, total] = await Promise.all([
        SavedJob.find(query)
          .populate(
            "jobId",
            "title description country city salaryMin salaryMax currency jobType status applicationDeadline publishedAt"
          )
          .sort({ savedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SavedJob.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        savedJobs: savedJobs.map((savedJob) => this.sanitizeSavedJob(savedJob)),
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
      throw new Error(`Failed to get saved jobs: ${error.message}`);
    }
  }

  /**
   * Update saved job
   */
  static async updateSavedJob(savedJobId, teacherId, updateData) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      // Update fields
      Object.assign(savedJob, updateData);
      await savedJob.save();

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to update saved job: ${error.message}`);
    }
  }

  /**
   * Remove saved job
   */
  static async removeSavedJob(savedJobId, teacherId) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await SavedJob.findByIdAndDelete(savedJobId);

      return { message: "Job removed from saved jobs successfully" };
    } catch (error) {
      throw new Error(`Failed to remove saved job: ${error.message}`);
    }
  }

  /**
   * Check if job is saved by teacher
   */
  static async isJobSaved(teacherId, jobId) {
    try {
      const savedJob = await SavedJob.findOne({ teacherId, jobId });
      return !!savedJob;
    } catch (error) {
      console.error("Failed to check if job is saved:", error);
      return false;
    }
  }

  /**
   * Get saved job by ID
   */
  static async getSavedJobById(savedJobId, teacherId) {
    try {
      const savedJob = await SavedJob.findOne({
        _id: savedJobId,
        teacherId,
      }).populate(
        "jobId",
        "title description country city salaryMin salaryMax currency jobType status applicationDeadline publishedAt"
      );

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to get saved job: ${error.message}`);
    }
  }

  /**
   * Get saved job statistics
   */
  static async getSavedJobStats(teacherId) {
    try {
      const stats = await SavedJob.getTeacherStats(teacherId);
      return stats;
    } catch (error) {
      throw new Error(`Failed to get saved job stats: ${error.message}`);
    }
  }

  /**
   * Get jobs to apply for (high priority, not applied)
   */
  static async getJobsToApply(teacherId, limit = 10) {
    try {
      const savedJobs = await SavedJob.findJobsToApply(teacherId);
      return savedJobs.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get jobs to apply: ${error.message}`);
    }
  }

  /**
   * Get overdue reminders
   */
  static async getOverdueReminders(teacherId) {
    try {
      const overdueReminders = await SavedJob.findOverdueReminders(teacherId);
      return overdueReminders;
    } catch (error) {
      throw new Error(`Failed to get overdue reminders: ${error.message}`);
    }
  }

  /**
   * Set reminder for saved job
   */
  static async setReminder(savedJobId, teacherId, reminderDate) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await savedJob.setReminder(reminderDate);

      // Create notification for reminder
      await JobNotification.createNotification({
        userId: teacherId,
        type: "reminder_apply",
        title: "Job Application Reminder",
        message: `Don't forget to apply for "${savedJob.jobId.title}"!`,
        category: "reminder",
        priority: "high",
        actionRequired: true,
        actionUrl: `/jobs/${savedJob.jobId._id}`,
        actionText: "Apply Now",
      });

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to set reminder: ${error.message}`);
    }
  }

  /**
   * Update priority of saved job
   */
  static async updatePriority(savedJobId, teacherId, priority) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await savedJob.updatePriority(priority);

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to update priority: ${error.message}`);
    }
  }

  /**
   * Add notes to saved job
   */
  static async addNotes(savedJobId, teacherId, notes) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await savedJob.addNotes(notes);

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to add notes: ${error.message}`);
    }
  }

  /**
   * Add tags to saved job
   */
  static async addTags(savedJobId, teacherId, tags) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await savedJob.addTags(tags);

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to add tags: ${error.message}`);
    }
  }

  /**
   * Remove tags from saved job
   */
  static async removeTags(savedJobId, teacherId, tags) {
    try {
      const savedJob = await SavedJob.findOne({ _id: savedJobId, teacherId });

      if (!savedJob) {
        throw new Error("Saved job not found or access denied");
      }

      await savedJob.removeTags(tags);

      return savedJob;
    } catch (error) {
      throw new Error(`Failed to remove tags: ${error.message}`);
    }
  }

  /**
   * Get saved jobs by tags
   */
  static async getSavedJobsByTags(teacherId, tags, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = { teacherId, tags: { $in: tags } };

      const [savedJobs, total] = await Promise.all([
        SavedJob.find(query)
          .populate(
            "jobId",
            "title description country city salaryMin salaryMax currency jobType status applicationDeadline publishedAt"
          )
          .sort({ savedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SavedJob.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        savedJobs: savedJobs.map((savedJob) => this.sanitizeSavedJob(savedJob)),
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
      throw new Error(`Failed to get saved jobs by tags: ${error.message}`);
    }
  }

  /**
   * Get all tags used by teacher
   */
  static async getTeacherTags(teacherId) {
    try {
      const savedJobs = await SavedJob.find({ teacherId });
      const allTags = savedJobs.reduce((tags, savedJob) => {
        return [...tags, ...savedJob.tags];
      }, []);

      // Remove duplicates and sort
      const uniqueTags = [...new Set(allTags)].sort();

      return uniqueTags;
    } catch (error) {
      throw new Error(`Failed to get teacher tags: ${error.message}`);
    }
  }

  /**
   * Bulk save jobs
   */
  static async bulkSaveJobs(teacherId, jobIds, saveData = {}) {
    try {
      const results = [];

      for (const jobId of jobIds) {
        try {
          const result = await this.saveJob(teacherId, jobId, saveData);
          results.push({ jobId, success: true, data: result });
        } catch (error) {
          results.push({ jobId, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk save jobs: ${error.message}`);
    }
  }

  /**
   * Bulk remove saved jobs
   */
  static async bulkRemoveSavedJobs(teacherId, savedJobIds) {
    try {
      const results = [];

      for (const savedJobId of savedJobIds) {
        try {
          const result = await this.removeSavedJob(savedJobId, teacherId);
          results.push({ savedJobId, success: true, data: result });
        } catch (error) {
          results.push({ savedJobId, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk remove saved jobs: ${error.message}`);
    }
  }

  /**
   * Sanitize saved job data
   */
  static sanitizeSavedJob(savedJob) {
    const sanitized = { ...savedJob };

    // Add computed fields
    sanitized.daysSinceSaved = this.calculateDaysSinceSaved(savedJob.savedAt);
    sanitized.isOverdue = this.isReminderOverdue(savedJob.reminderDate);

    return sanitized;
  }

  /**
   * Calculate days since saved
   */
  static calculateDaysSinceSaved(savedAt) {
    if (!savedAt) return null;

    const now = new Date();
    const diffTime = Math.abs(now - savedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if reminder is overdue
   */
  static isReminderOverdue(reminderDate) {
    if (!reminderDate) return false;
    return new Date() > reminderDate;
  }

  /**
   * Clean up expired saved jobs
   */
  static async cleanupExpiredSavedJobs() {
    try {
      const expiredJobs = await Job.find({
        status: { $in: ["expired", "closed"] },
      });
      const expiredJobIds = expiredJobs.map((job) => job._id);

      if (expiredJobIds.length === 0) {
        return { removedCount: 0 };
      }

      const result = await SavedJob.deleteMany({
        jobId: { $in: expiredJobIds },
      });

      return { removedCount: result.deletedCount };
    } catch (error) {
      console.error("Failed to cleanup expired saved jobs:", error);
      return { removedCount: 0 };
    }
  }
}

module.exports = SavedJobService;
