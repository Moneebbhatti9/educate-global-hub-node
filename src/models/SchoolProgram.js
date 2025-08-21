const mongoose = require("mongoose");

const schoolProgramSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolProfile",
      required: true,
      index: true,
    },
    programName: { type: String, required: true, trim: true },
    educationLevel: {
      type: String,
      enum: [
        "Early Years",
        "Elementary",
        "Primary",
        "Secondary",
        "High School",
        "All Levels",
      ],
      required: true,
    },
    curriculum: { type: String, required: true, trim: true },
    ageRange: { type: String, trim: true }, // e.g. "16-18 years"
    programDuration: { type: String, trim: true }, // e.g. "2 years"
    classCapacity: { type: Number, min: 1 },
    coreSubjects: [{ type: String, trim: true }],
    description: { type: String, trim: true, maxlength: 5000 },
    admissionRequirements: [{ type: String, trim: true }],
    programFees: { type: String, trim: true }, // keep string for currency formatting
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

schoolProgramSchema.index({ programName: 1, curriculum: 1 });

module.exports = mongoose.model("SchoolProgram", schoolProgramSchema);
