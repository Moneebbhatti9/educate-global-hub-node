const mongoose = require("mongoose");

const savedTeacherSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: "",
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate saves
savedTeacherSchema.index(
  { schoolId: 1, teacherProfileId: 1 },
  { unique: true }
);

// Index for listing saved teachers by school
savedTeacherSchema.index({ schoolId: 1, savedAt: -1 });

// Static method to find saved teachers by school
savedTeacherSchema.statics.findBySchool = function (schoolId) {
  return this.find({ schoolId })
    .populate(
      "teacherProfileId",
      "firstName lastName subject qualification yearsOfTeachingExperience city country professionalBio availabilityStatus"
    )
    .sort({ savedAt: -1 });
};

module.exports = mongoose.model("SavedTeacher", savedTeacherSchema);
