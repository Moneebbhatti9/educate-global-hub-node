const mongoose = require("mongoose");

const TeacherRefereeSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    fullName: String,
    position: String,
    organization: String,
    email: String,
    phone: String,
    relationship: String,
    yearsKnown: Number,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("TeacherReferee", TeacherRefereeSchema);
