const mongoose = require("mongoose");
const { isValidPhoneNumber } = require("../utils/phoneUtils");

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Personal Information
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (value) {
          return isValidPhoneNumber(value);
        },
        message: "Phone number must include country code (e.g., +1234567890)",
      },
    },

    // Location Information
    country: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    province: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },

    // Professional Information
    qualification: {
      type: String,
      enum: ["Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    pgce: {
      type: Boolean,
      default: false,
    },
    yearsOfTeachingExperience: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },

    // Professional Details
    professionalBio: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    keyAchievements: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },

    // Additional Information
    additionalQualifications: {
      type: [String],
      default: [],
    },

    // Profile Status
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    profileCompletion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// Note: userId index is automatically created by unique: true constraint
teacherProfileSchema.index({ country: 1 });
teacherProfileSchema.index({ city: 1 });
teacherProfileSchema.index({ subject: 1 });
teacherProfileSchema.index({ qualification: 1 });

// Virtual populate for user data
teacherProfileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included when converting to JSON
teacherProfileSchema.set("toJSON", { virtuals: true });
teacherProfileSchema.set("toObject", { virtuals: true });

// Pre-save middleware to ensure phone number has country code
teacherProfileSchema.pre("save", function (next) {
  if (this.phoneNumber && !this.phoneNumber.startsWith("+")) {
    // If phone number doesn't start with +, try to add country code
    const { formatPhoneNumber } = require("../utils/phoneUtils");
    const formatted = formatPhoneNumber(this.phoneNumber, this.country);
    if (formatted) {
      this.phoneNumber = formatted;
    }
  }
  next();
});

// Method to check if profile is complete
teacherProfileSchema.methods.checkProfileCompletion = async function () {
  const requiredFields = [
    "fullName",
    "phoneNumber",
    "country",
    "city",
    "province",
    "zipCode",
    "address",
    "qualification",
    "subject",
    "yearsOfTeachingExperience",
    "professionalBio",
  ];

  let filled = 0;
  requiredFields.forEach((field) => {
    if (this[field] && this[field].toString().trim() !== "") filled++;
  });

  // Count sub-collections
  const TeacherEmployment = require("./TeacherEmployment");
  const TeacherEducation = require("./TeacherEducation");
  const TeacherQualification = require("./TeacherQualification");
  const TeacherReferee = require("./TeacherReferee");

  const [employmentCount, educationCount, qualificationCount, refereeCount] =
    await Promise.all([
      TeacherEmployment.countDocuments({ teacherId: this._id }),
      TeacherEducation.countDocuments({ teacherId: this._id }),
      TeacherQualification.countDocuments({ teacherId: this._id }),
      TeacherReferee.countDocuments({ teacherId: this._id }),
    ]);

  // Backward compatibility with your legacy arrays on the profile:
  const legacyQualificationLike =
    (Array.isArray(this.certifications) && this.certifications.length > 0) ||
    (Array.isArray(this.additionalQualifications) &&
      this.additionalQualifications.length > 0);

  let score = filled;
  if (employmentCount > 0) score++;
  if (educationCount > 0) score++;
  if (qualificationCount > 0 || legacyQualificationLike) score++;
  if (refereeCount > 0) score++;

  const total = requiredFields.length + 4; // + employment, education, qualifications, referees
  return Math.round((score / total) * 100);
};

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);
