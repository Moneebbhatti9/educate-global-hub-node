const mongoose = require("mongoose");
const { isValidPhoneNumber } = require("../utils/phoneUtils");

const schoolProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Basic Information
    schoolName: {
      type: String,
      required: true,
      trim: true,
    },
    schoolEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    schoolContactNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (value) {
          return isValidPhoneNumber(value);
        },
        message: "Contact number must include country code (e.g., +1234567890)",
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
      required: false,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },

    // School Details
    curriculum: {
      type: [String],
      required: true,
      enum: [
        "British Curriculum",
        "American Curriculum",
        "IB (International Baccalaureate)",
        "Canadian Curriculum",
        "Australian Curriculum",
        "National Curriculum",
        "Montessori",
        "Waldorf",
        "Reggio Emilia",
        "Other",
      ],
    },
    schoolSize: {
      type: String,
      enum: [
        "Small (1-500 students)",
        "Medium (501-1000 students)",
        "Large (1001+ students)",
      ],
      required: true,
    },
    schoolType: {
      type: String,
      enum: [
        "Public",
        "Private",
        "International",
        "Charter",
        "Religious",
        "Other",
      ],
      required: true,
    },
    genderType: {
      type: String,
      enum: ["Boys Only", "Girls Only", "Mixed"],
      required: true,
    },
    ageGroup: {
      type: [String],
      required: true,
      enum: [
        "Early Years (2-5 years)",
        "Primary (6-11 years)",
        "Secondary (12-16 years)",
        "Sixth Form/High School (17-18 years)",
        "All Ages",
      ],
    },

    // Additional Information
    schoolWebsite: {
      type: String,
      trim: true,
      default: null,
    },
    aboutSchool: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    // Profile Status
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    registrationNumber: { type: String, trim: true },
    alternateContactNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || isValidPhoneNumber(v);
        },
        message:
          "Alternate contact must include country code (e.g., +1234567890)",
      },
    },
    establishedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear(),
    },
    mission: { type: String, trim: true, maxlength: 2000 },
    vision: { type: String, trim: true, maxlength: 2000 },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// Note: userId index is automatically created by unique: true constraint
schoolProfileSchema.index({ country: 1 });
schoolProfileSchema.index({ city: 1 });
schoolProfileSchema.index({ schoolType: 1 });
schoolProfileSchema.index({ curriculum: 1 });

// Virtual populate for user data
schoolProfileSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included when converting to JSON
schoolProfileSchema.set("toJSON", { virtuals: true });
schoolProfileSchema.set("toObject", { virtuals: true });

// Pre-save middleware to ensure contact number has country code
schoolProfileSchema.pre("save", function (next) {
  const { formatPhoneNumber } = require("../utils/phoneUtils");
  if (this.schoolContactNumber && !this.schoolContactNumber.startsWith("+")) {
    const formatted = formatPhoneNumber(this.schoolContactNumber, this.country);
    if (formatted) this.schoolContactNumber = formatted;
  }
  if (
    this.alternateContactNumber &&
    !this.alternateContactNumber.startsWith("+")
  ) {
    const formattedAlt = formatPhoneNumber(
      this.alternateContactNumber,
      this.country
    );
    if (formattedAlt) this.alternateContactNumber = formattedAlt;
  }
  next();
});

schoolProfileSchema.index({ schoolName: "text", aboutSchool: "text" });

const REQUIRED = [
  "schoolName",
  "schoolEmail",
  "schoolContactNumber",
  "country",
  "city",
  "province",
  "zipCode",
  "address",
  "curriculum",
  "schoolSize",
  "schoolType",
  "genderType",
  "ageGroup",
  "aboutSchool",
  "establishedYear", // added
];
schoolProfileSchema.methods.checkProfileCompletion = function () {
  return REQUIRED.every((f) => {
    const v = this[f];
    return Array.isArray(v) ? v.length > 0 : v && v.toString().trim() !== "";
  });
};

module.exports = mongoose.model("SchoolProfile", schoolProfileSchema);
