const mongoose = require("mongoose");

const TeacherEmploymentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    jobTitle: String,
    employer: String,
    location: String,
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    responsibilities: [String],
    contactPerson: {
      name: String,
      position: String,
      email: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherEmployment", TeacherEmploymentSchema);
