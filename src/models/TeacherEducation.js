const mongoose = require("mongoose");

const TeacherEducationSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    educationType: { type: String, enum: ["University", "School", "Other"] },
    degree: String,
    institution: String,
    fieldOfStudy: String,
    gpa: String,
    startDate: Date,
    endDate: Date,
    thesisTitle: String,
    honorsAwards: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherEducation", TeacherEducationSchema);
