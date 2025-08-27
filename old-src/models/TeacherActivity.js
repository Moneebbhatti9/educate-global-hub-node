const mongoose = require("mongoose");

const teacherActivitySchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
    },
    activityName: { type: String, required: true, trim: true },
    activityType: { type: String, required: true, trim: true }, // e.g., Club, Sport, Award
    role: { type: String, required: true, trim: true },
    organization: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    timeCommitment: { type: String },
    description: { type: String, required: true },
    achievements: [{ type: String }],
    skillsDeveloped: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherActivity", teacherActivitySchema);
