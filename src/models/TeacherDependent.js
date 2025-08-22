const mongoose = require("mongoose");

const teacherDependentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
    },
    fullName: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    nationality: { type: String, required: true, trim: true },
    passportNumber: { type: String, required: true },
    passportExpiry: { type: Date, required: true },
    visaRequired: { type: Boolean, default: false },
    accommodationNeeds: { type: String },
    medicalNeeds: { type: String },
    educationNeeds: { type: String },
    additionalNotes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherDependent", teacherDependentSchema);
