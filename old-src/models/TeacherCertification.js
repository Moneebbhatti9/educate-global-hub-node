const mongoose = require("mongoose");

const TeacherCertificationSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    certificationName: { type: String, required: true, trim: true },
    issuingOrganization: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date },
    credentialId: { type: String, trim: true },
    credentialUrl: { type: String, trim: true },
    description: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

TeacherCertificationSchema.index({ teacherId: 1, issueDate: -1 });

module.exports = mongoose.model(
  "TeacherCertification",
  TeacherCertificationSchema
);
