const mongoose = require("mongoose");

const savedJobSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    reminderDate: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return v > new Date();
        },
        message: "Reminder date must be in the future",
      },
    },
    isApplied: {
      type: Boolean,
      default: false,
    },
    appliedAt: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
      maxlength: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate saves
savedJobSchema.index({ teacherId: 1, jobId: 1 }, { unique: true });

// Indexes for better query performance
savedJobSchema.index({ teacherId: 1, savedAt: -1 });
savedJobSchema.index({ teacherId: 1, priority: 1 });
savedJobSchema.index({ teacherId: 1, isApplied: 1 });
savedJobSchema.index({ reminderDate: 1 });

// Virtual for days since saved
savedJobSchema.virtual("daysSinceSaved").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.savedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue (if reminder date passed)
savedJobSchema.virtual("isOverdue").get(function () {
  if (!this.reminderDate) return false;
  return new Date() > this.reminderDate;
});

// Pre-save middleware to handle applied status
savedJobSchema.pre("save", function (next) {
  if (this.isModified("isApplied") && this.isApplied && !this.appliedAt) {
    this.appliedAt = new Date();
  }
  next();
});

// Method to mark as applied
savedJobSchema.methods.markAsApplied = async function () {
  this.isApplied = true;
  this.appliedAt = new Date();
  return this.save();
};

// Method to set reminder
savedJobSchema.methods.setReminder = async function (reminderDate) {
  this.reminderDate = reminderDate;
  return this.save();
};

// Method to update priority
savedJobSchema.methods.updatePriority = async function (priority) {
  this.priority = priority;
  return this.save();
};

// Method to add notes
savedJobSchema.methods.addNotes = async function (notes) {
  this.notes = notes;
  return this.save();
};

// Method to add tags
savedJobSchema.methods.addTags = async function (newTags) {
  const uniqueTags = [...new Set([...this.tags, ...newTags])];
  if (uniqueTags.length > 10) {
    throw new Error("Maximum 10 tags allowed");
  }
  this.tags = uniqueTags;
  return this.save();
};

// Method to remove tags
savedJobSchema.methods.removeTags = async function (tagsToRemove) {
  this.tags = this.tags.filter((tag) => !tagsToRemove.includes(tag));
  return this.save();
};

// Method to sanitize saved job data
savedJobSchema.methods.toSafeObject = function () {
  const savedJob = this.toObject();

  // Add computed fields
  savedJob.daysSinceSaved = this.daysSinceSaved;
  savedJob.isOverdue = this.isOverdue;

  return savedJob;
};

// Static method to find saved jobs by teacher
savedJobSchema.statics.findByTeacher = function (teacherId, options = {}) {
  const query = { teacherId };

  if (options.priority) {
    query.priority = options.priority;
  }

  if (options.isApplied !== undefined) {
    query.isApplied = options.isApplied;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  return this.find(query)
    .populate(
      "jobId",
      "title description country city salaryMin salaryMax currency jobType status applicationDeadline"
    )
    .sort({ savedAt: -1 });
};

// Static method to find overdue reminders
savedJobSchema.statics.findOverdueReminders = function () {
  return this.find({
    reminderDate: { $lt: new Date() },
  })
    .populate("teacherId", "email fullName")
    .populate("jobId", "title applicationDeadline");
};

// Static method to find jobs to apply for (high priority, not applied)
savedJobSchema.statics.findJobsToApply = function (teacherId) {
  return this.find({
    teacherId,
    isApplied: false,
    priority: { $in: ["high", "urgent"] },
  }).populate("jobId", "title applicationDeadline status");
};

// Static method to get saved job statistics
savedJobSchema.statics.getTeacherStats = async function (teacherId) {
  const stats = await this.aggregate([
    {
      $match: { teacherId: new mongoose.Types.ObjectId(teacherId) },
    },
    {
      $group: {
        _id: null,
        totalSaved: { $sum: 1 },
        totalApplied: { $sum: { $cond: ["$isApplied", 1, 0] } },
        totalReminders: {
          $sum: { $cond: [{ $ne: ["$reminderDate", null] }, 1, 0] },
        },
        overdueReminders: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$reminderDate", null] },
                  { $lt: ["$reminderDate", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
        priorityBreakdown: {
          $push: "$priority",
        },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalSaved: 0,
      totalApplied: 0,
      totalReminders: 0,
      overdueReminders: 0,
      priorityBreakdown: {},
    };
  }

  const stat = stats[0];
  const priorityBreakdown = stat.priorityBreakdown.reduce((acc, priority) => {
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  return {
    totalSaved: stat.totalSaved,
    totalApplied: stat.totalApplied,
    totalReminders: stat.totalReminders,
    overdueReminders: stat.overdueReminders,
    priorityBreakdown,
  };
};

module.exports = mongoose.model("SavedJob", savedJobSchema);
