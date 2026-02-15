const mongoose = require("mongoose");
const { isValidPhoneNumber } = require("../utils/phoneUtils");
const validator = require("validator");

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ---- Personal Details & Contact Information ----
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    professionalTitle: { type: String, trim: true }, // e.g. "Math Teacher & Curriculum Developer"

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Invalid email address",
      },
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => isValidPhoneNumber(value),
        message: "Phone number must include country code (e.g., +1234567890)",
      },
    },
    alternatePhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || isValidPhoneNumber(v),
        message:
          "Alternate phone must include country code (e.g., +1234567890)",
      },
    },

    dateOfBirth: { type: Date, required: false },
    placeOfBirth: { type: String, required: false, trim: true },
    nationality: { type: String, required: false, trim: true },
    passportNumber: {
      type: String,
      required: false,
      trim: true,
      minlength: 5,
      maxlength: 30,
      match: [
        /^[A-Za-z0-9\-]+$/,
        "Passport number can contain letters, numbers, and hyphens",
      ],
    },

    gender: {
      type: String,
      required: false,
      enum: ["Male", "Female", "Non-binary", "Prefer not to say", "Other"],
    },
    maritalStatus: {
      type: String,
      required: false,
      enum: ["Single", "Married", "Divorced", "Widowed", "Other"],
    },

    // ---- Address Information ----
    streetAddress: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    stateProvince: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, required: false, trim: true },

    // ---- Professional Links ----
    linkedin: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) =>
          !v ||
          validator.isURL(v, {
            protocols: ["http", "https"],
            require_protocol: false,
          }),
        message: "LinkedIn must be a valid URL",
      },
    },

    // ---- Languages ----
    languages: {
      type: [
        {
          language: { type: String, required: true, trim: true },
          proficiency: {
            type: String,
            required: true,
            enum: ["Native", "Fluent", "Advanced", "Intermediate", "Beginner"],
          },
          isNative: { type: Boolean, default: false }, // optional flag
        },
      ],
      default: [],
    },

    // ---- Existing Fields (kept as is) ----
    province: { type: String, required: true, trim: true }, // kept for backward compatibility
    address: { type: String, required: true, trim: true },

    qualification: {
      type: String,
      enum: ["Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other"],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    pgce: { type: Boolean, default: false },
    yearsOfTeachingExperience: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },

    professionalBio: { type: String, required: true, maxlength: 1000 },
    keyAchievements: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    additionalQualifications: { type: [String], default: [] },

    isProfileComplete: { type: Boolean, default: false },
    profileCompletion: { type: Number, default: 0 },

    // ---- Talent Pool ----
    talentPoolOptedIn: { type: Boolean, default: false },
    availabilityStatus: {
      type: String,
      enum: ["available", "open_to_offers", "not_looking"],
      default: "not_looking",
    },
  },
  { timestamps: true }
);

// Index for better query performance
// Note: userId index is automatically created by unique: true constraint
teacherProfileSchema.index({ country: 1 });
teacherProfileSchema.index({ city: 1 });
teacherProfileSchema.index({ subject: 1 });
teacherProfileSchema.index({ qualification: 1 });
teacherProfileSchema.index({ talentPoolOptedIn: 1, availabilityStatus: 1 });

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
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "country",
    "city",
    "stateProvince",
    "postalCode",
    "streetAddress",
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
