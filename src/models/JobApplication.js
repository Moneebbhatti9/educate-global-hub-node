const mongoose = require("mongoose");

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
    },
    coverLetter: {
      type: String,
      required: true,
    },
    expectedSalary: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return v > 0;
        },
        message: "Expected salary must be positive",
      },
    },
    availableFrom: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return v >= new Date();
        },
        message: "Available from date must be today or in the future",
      },
    },
    reasonForApplying: {
      type: String,
      required: true,
      minlength: 50,
      maxlength: 1000,
    },
    additionalComments: {
      type: String,
      maxlength: 500,
    },
    screeningAnswers: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: [
        "pending",
        "reviewing",
        "shortlisted",
        "interviewed",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      default: "pending",
    },
    resumeUrl: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Resume URL must be a valid URL",
      },
    },
    documents: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.every((url) => /^https?:\/\/.+/.test(url));
        },
        message: "All document URLs must be valid URLs",
      },
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      maxlength: 500,
    },
    interviewDate: {
      type: Date,
    },
    interviewNotes: {
      type: String,
      maxlength: 1000,
    },
    isWithdrawn: {
      type: Boolean,
      default: false,
    },
    withdrawnAt: {
      type: Date,
    },
    withdrawnReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
jobApplicationSchema.index({ jobId: 1, status: 1 });
jobApplicationSchema.index({ teacherId: 1, status: 1 });
jobApplicationSchema.index({ status: 1, createdAt: -1 });
jobApplicationSchema.index({ jobId: 1, teacherId: 1 }, { unique: true });

// Virtual for application age
jobApplicationSchema.virtual("daysSinceApplied").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue (if status is reviewing for too long)
jobApplicationSchema.virtual("isOverdue").get(function () {
  if (this.status !== "reviewing") return false;
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const daysSinceApplied = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return daysSinceApplied > 14; // Consider overdue after 14 days
});

// Pre-save middleware to handle status changes
jobApplicationSchema.pre("save", function (next) {
  // Set reviewedAt when status changes from pending
  if (
    this.isModified("status") &&
    this.status !== "pending" &&
    !this.reviewedAt
  ) {
    this.reviewedAt = new Date();
  }

  // Handle withdrawal
  if (this.isModified("isWithdrawn") && this.isWithdrawn && !this.withdrawnAt) {
    this.withdrawnAt = new Date();
    this.status = "withdrawn";
  }

  next();
});

// Method to update status
jobApplicationSchema.methods.updateStatus = async function (
  newStatus,
  notes = "",
  reviewedBy = null
) {
  this.status = newStatus;
  this.notes = notes;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();

  // Handle specific status changes
  if (newStatus === "interviewed" && !this.interviewDate) {
    this.interviewDate = new Date();
  }

  return this.save();
};

// Method to reject application
jobApplicationSchema.methods.reject = async function (
  reason,
  notes = "",
  reviewedBy = null
) {
  this.status = "rejected";
  this.rejectionReason = reason;
  this.notes = notes;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  return this.save();
};

// Method to withdraw application
jobApplicationSchema.methods.withdraw = async function (reason = "") {
  this.isWithdrawn = true;
  this.status = "withdrawn";
  this.withdrawnReason = reason;
  this.withdrawnAt = new Date();
  return this.save();
};

// Method to schedule interview
jobApplicationSchema.methods.scheduleInterview = async function (
  interviewDate,
  notes = "",
  reviewedBy = null
) {
  this.status = "interviewed";
  this.interviewDate = interviewDate;
  this.interviewNotes = notes;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  return this.save();
};

// Method to accept application
jobApplicationSchema.methods.accept = async function (
  notes = "",
  reviewedBy = null
) {
  this.status = "accepted";
  this.notes = notes;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  return this.save();
};

// Method to sanitize application data for public viewing
jobApplicationSchema.methods.toPublicObject = function () {
  const application = this.toObject();

  // Remove sensitive fields
  delete application.notes;
  delete application.reviewedBy;
  delete application.rejectionReason;
  delete application.interviewNotes;
  delete application.withdrawnReason;

  // Add computed fields
  application.daysSinceApplied = this.daysSinceApplied;
  application.isOverdue = this.isOverdue;

  return application;
};

// Static method to find pending applications
jobApplicationSchema.statics.findPending = function () {
  return this.find({ status: "pending" });
};

// Static method to find applications by status
jobApplicationSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

// Static method to find applications for a specific job
jobApplicationSchema.statics.findByJob = function (jobId) {
  return this.find({ jobId }).populate(
    "teacherId",
    "firstName lastName email phoneNumber country city"
  );
};

// Static method to find applications by a specific teacher
jobApplicationSchema.statics.findByTeacher = function (teacherId) {
  return this.find({ teacherId }).populate(
    "jobId",
    "title schoolId status applicationDeadline"
  );
};

module.exports = mongoose.model("JobApplication", jobApplicationSchema);
