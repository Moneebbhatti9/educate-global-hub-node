const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolProfile",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    organization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      required: true,
      minlength: 50,
      maxlength: 10000,
    },
    requirements: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "At least one requirement is required",
      },
    },
    benefits: {
      type: [String],
      default: [],
    },
    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "At least one subject is required",
      },
    },
    educationLevel: {
      type: String,
      required: true,
      enum: [
        "early_years",
        "primary",
        "secondary",
        "high_school",
        "foundation",
        "higher_education",
      ],
    },
    positionCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    positionSubcategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    salaryMin: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          if (this.salaryMax && v > this.salaryMax) {
            return false;
          }
          return true;
        },
        message: "Minimum salary cannot be greater than maximum salary",
      },
    },
    salaryMax: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          if (this.salaryMin && v < this.salaryMin) {
            return false;
          }
          return true;
        },
        message: "Maximum salary cannot be less than minimum salary",
      },
    },
    currency: {
      type: String,
      default: "USD",
      length: 3,
    },
    salaryDisclose: {
      type: Boolean,
      default: true,
    },
    minExperience: {
      type: Number,
      min: 0,
      max: 50,
    },
    qualification: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    jobType: {
      type: String,
      required: true,
      enum: ["full_time", "part_time", "contract", "substitute"],
    },
    visaSponsorship: {
      type: Boolean,
      default: false,
    },
    quickApply: {
      type: Boolean,
      default: false,
    },
    externalLink: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "External link must be a valid URL",
      },
    },
    applicationDeadline: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return v > new Date();
        },
        message: "Application deadline must be in the future",
      },
    },
    applicantEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please provide a valid email address",
      },
    },
    screeningQuestions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published", "expired", "closed"],
      default: "draft",
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicantsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["draft", "published", "closed", "expired"],
          required: true,
        },
        reason: {
          type: String,
          trim: true,
          maxlength: 500,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    deletedAt: {
      type: Date,
    },
    deletionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
jobSchema.index({ schoolId: 1, status: 1 });
jobSchema.index({ status: 1, publishedAt: -1 });
jobSchema.index({ country: 1, city: 1 });
jobSchema.index({ organization: 1 });
jobSchema.index({ educationLevel: 1 });
jobSchema.index({ subjects: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ salaryMin: 1, salaryMax: 1 });
jobSchema.index({ applicationDeadline: 1 });
jobSchema.index({ tags: 1 });
jobSchema.index({ isUrgent: 1, isFeatured: 1 });

// Text search index
jobSchema.index({
  title: "text",
  organization: "text",
  description: "text",
  requirements: "text",
  subjects: "text",
  positionCategory: "text",
  positionSubcategory: "text",
});

// Virtual for salary range display
jobSchema.virtual("salaryRange").get(function () {
  if (!this.salaryDisclose) {
    return "Competitive";
  }
  if (this.salaryMin && this.salaryMax) {
    return `${this.salaryMin} - ${this.salaryMax} ${this.currency}`;
  }
  if (this.salaryMin) {
    return `From ${this.salaryMin} ${this.currency}`;
  }
  if (this.salaryMax) {
    return `Up to ${this.salaryMax} ${this.currency}`;
  }
  return "Competitive";
});

// Virtual for job age
jobSchema.virtual("daysPosted").get(function () {
  if (!this.publishedAt) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.publishedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isExpired
jobSchema.virtual("isExpired").get(function () {
  if (!this.applicationDeadline) return false;
  return new Date() > this.applicationDeadline;
});

// Pre-save middleware to handle status changes
jobSchema.pre("save", function (next) {
  // Auto-set expiresAt when publishing
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  // Auto-set status to expired if deadline passed
  if (
    this.applicationDeadline &&
    new Date() > this.applicationDeadline &&
    this.status === "published"
  ) {
    this.status = "expired";
  }

  // Handle deleted status
  if (this.status === "deleted" && !this.deletedAt) {
    this.deletedAt = new Date();
  }

  // Handle closed/expired status
  if (
    (this.status === "closed" || this.status === "expired") &&
    !this.closedAt
  ) {
    this.closedAt = new Date();
  }

  next();
});

// Method to increment view count
jobSchema.methods.incrementViews = async function () {
  this.viewsCount += 1;
  return this.save();
};

// Method to increment applicants count
jobSchema.methods.incrementApplicants = async function () {
  this.applicantsCount += 1;
  return this.save();
};

// Method to decrement applicants count
jobSchema.methods.decrementApplicants = async function () {
  if (this.applicantsCount > 0) {
    this.applicantsCount -= 1;
    return this.save();
  }
  return this;
};

// Method to sanitize job data for public viewing
jobSchema.methods.toPublicObject = function () {
  const job = this.toObject();

  // Remove sensitive fields
  delete job.schoolId;
  delete job.applicantEmail;
  delete job.viewsCount;
  delete job.applicantsCount;

  // Add computed fields
  job.salaryRange = this.salaryRange;
  job.daysPosted = this.daysPosted;
  job.isExpired = this.isExpired;

  return job;
};

// Method to check if job is active and accepting applications
jobSchema.methods.isAcceptingApplications = function () {
  return this.status === "published" && this.applicationDeadline > new Date();
};

// Static method to find published jobs
jobSchema.statics.findPublished = function () {
  return this.find({
    status: "published",
    applicationDeadline: { $gt: new Date() },
    deletedAt: { $exists: false },
  });
};

// Static method to find expired jobs
jobSchema.statics.findExpired = function () {
  return this.find({
    applicationDeadline: { $lte: new Date() },
    status: { $in: ["published"] },
    deletedAt: { $exists: false },
  });
};

module.exports = mongoose.model("Job", jobSchema);
