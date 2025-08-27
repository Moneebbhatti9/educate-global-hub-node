const mongoose = require("mongoose");

const TeacherQualificationSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    title: String,
    issuingInstitution: String,
    subjectArea: String,
    certificationId: String,
    issueDate: Date,
    expiryDate: Date,
    ageRanges: [String], // e.g., ["6-11","12-16"]
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "TeacherQualification",
  TeacherQualificationSchema
);
