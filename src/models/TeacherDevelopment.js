const mongoose = require("mongoose");

const TeacherDevelopmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true }, // Course/Workshop Title
    provider: { type: String, required: true, trim: true }, // Provider/Institution
    type: {
      type: String,
      enum: ["Course", "Workshop", "Seminar", "Training", "Other"],
      default: "Course",
    },
    duration: { type: String, trim: true }, // "40 hours", "2 weeks"
    completionDate: { type: Date }, // optional
    certificateUrl: { type: String, trim: true },
    skillsGained: { type: [String], default: [] },
    impact: { type: String, maxlength: 3000 }, // impact on teaching practice
  },
  { timestamps: true }
);

TeacherDevelopmentSchema.index({ teacherId: 1, completionDate: -1 });

module.exports = mongoose.model("TeacherDevelopment", TeacherDevelopmentSchema);
