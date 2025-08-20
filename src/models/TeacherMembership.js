const mongoose = require("mongoose");

const TeacherMembershipSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeacherProfile",
      required: true,
      index: true,
    },
    organizationName: { type: String, required: true, trim: true },
    membershipType: { type: String, trim: true }, // "Full Member", etc.
    status: {
      type: String,
      enum: ["Active", "Expired", "Pending"],
      default: "Active",
    },
    membershipId: { type: String, trim: true },
    joinDate: { type: Date },
    expiryDate: { type: Date },
    benefits: { type: [String], default: [] }, // comma separated in UI → array here
    description: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

TeacherMembershipSchema.index({ teacherId: 1, status: 1 });

module.exports = mongoose.model("TeacherMembership", TeacherMembershipSchema);
