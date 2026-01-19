const TeacherProfile = require("../models/TeacherProfile");
const User = require("../models/User");

async function getTeacherProfileForUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "teacher") {
    throw new Error("Only teachers can access this resource");
  }

  const teacherProfile = await TeacherProfile.findOne({ userId });
  if (!teacherProfile) {
    throw new Error("Teacher profile not found");
  }

  return { user, teacherProfile };
}

module.exports = { getTeacherProfileForUser };
