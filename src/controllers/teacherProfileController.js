const TeacherProfile = require("../models/TeacherProfile");
const TeacherEmployment = require("../models/TeacherEmployment");
const TeacherEducation = require("../models/TeacherEducation");
const TeacherQualification = require("../models/TeacherQualification");
const TeacherReferee = require("../models/TeacherReferee");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { validateAndFormatPhone } = require("../utils/phoneUtils");
const {
  getRecommendedJobsForTeacher,
  getFallbackJobs,
} = require("../services/jobRecommendationService");

// Create or update teacher profile
const createOrUpdateTeacherProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      fullName,
      phoneNumber,
      country,
      city,
      province,
      zipCode,
      address,
      qualification,
      subject,
      pgce,
      yearsOfTeachingExperience,
      professionalBio,
      keyAchievements,
    } = req.body;

    //  Check if user exists and is a teacher
    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role !== "teacher")
      return errorResponse(
        res,
        "Only teachers can create teacher profiles",
        403
      );

    //  Validate and format phone number
    const phoneValidation = validateAndFormatPhone(phoneNumber, country);
    if (!phoneValidation.isValid) {
      return errorResponse(res, phoneValidation.error, 400);
    }

    //  Check if profile exists
    let teacherProfile = await TeacherProfile.findOne({ userId });

    if (teacherProfile) {
      // Update existing profile
      const updateData = {
        fullName,
        phoneNumber: phoneValidation.formatted,
        country,
        city,
        province,
        zipCode,
        address,
        qualification,
        subject,
        pgce: pgce || false,
        yearsOfTeachingExperience,
        professionalBio,
        keyAchievements: keyAchievements || [],
      };

      teacherProfile = await TeacherProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      teacherProfile = new TeacherProfile({
        userId,
        fullName,
        phoneNumber: phoneValidation.formatted,
        country,
        city,
        province,
        zipCode,
        address,
        qualification,
        subject,
        pgce: pgce || false,
        yearsOfTeachingExperience,
        professionalBio,
        keyAchievements: keyAchievements || [],
      });

      await teacherProfile.save();
    }

    //  Compute profile completion
    const completion = await TeacherProfile.checkProfileCompletion();
    teacherProfile.profileCompletion = completion;
    teacherProfile.isProfileComplete = completion === 100;
    await teacherProfile.save();

    // Update User document
    await User.findByIdAndUpdate(userId, {
      profileCompletion: completion,
      isProfileComplete: completion === 100,
    });
    const [employment, education, qualifications, referees] = await Promise.all(
      [
        TeacherEmployment.find({ teacherId: teacherProfile._id }),
        TeacherEducation.find({ teacherId: teacherProfile._id }),
        TeacherQualification.find({ teacherId: teacherProfile._id }),
        TeacherReferee.find({ teacherId: teacherProfile._id }),
      ]
    );

    // Return response
    return successResponse(res, "Teacher profile updated successfully", {
      data: {
        ...teacherProfile.toObject(),
        employment,
        education,
        qualifications,
        referees,
      },
      message: teacherProfile.isProfileComplete
        ? "Profile is complete"
        : "Profile is incomplete",
    });
  } catch (error) {
    console.error("Error in createOrUpdateTeacherProfile:", error);
    return errorResponse(res, "Failed to update teacher profile", 500);
  }
};

// Get teacher profile
const getTeacherProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const teacherProfile = await TeacherProfile.findOne({ userId }).populate(
      "user",
      "email firstName lastName role"
    );
    if (!teacherProfile)
      return errorResponse(res, "Teacher profile not found", 404);

    const [employment, education, qualifications, referees] = await Promise.all(
      [
        TeacherEmployment.find({ teacherId: teacherProfile._id }),
        TeacherEducation.find({ teacherId: teacherProfile._id }),
        TeacherQualification.find({ teacherId: teacherProfile._id }),
        TeacherReferee.find({ teacherId: teacherProfile._id }),
      ]
    );

    return successResponse(res, "Teacher profile retrieved successfully", {
      data: {
        ...teacherProfile.toObject(),
        employment,
        education,
        qualifications,
        referees,
      },
    });
  } catch (error) {
    console.error("Error in getTeacherProfile:", error);
    return errorResponse(res, "Failed to retrieve teacher profile", 500);
  }
};

// Get teacher profile by ID (for public viewing)
const getTeacherProfileById = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacherProfile = await TeacherProfile.findOne({
      userId: teacherId,
    }).populate("user", "firstName lastName email role avatarUrl");

    if (!teacherProfile)
      return errorResponse(res, "Teacher profile not found", 404);

    const [employment, education, qualifications, referees] = await Promise.all(
      [
        TeacherEmployment.find({ teacherId: teacherProfile._id }),
        TeacherEducation.find({ teacherId: teacherProfile._id }),
        TeacherQualification.find({ teacherId: teacherProfile._id }),
        TeacherReferee.find({ teacherId: teacherProfile._id }),
      ]
    );

    const publicProfile = {
      ...teacherProfile.toObject(),
      phoneNumber: undefined, // temporary undefined can be added if required
      address: undefined, // temporary undefined can be added if required
      employment,
      education,
      qualifications,
      referees,
    };

    return successResponse(res, "Teacher profile retrieved successfully", {
      data: publicProfile,
    });
  } catch (error) {
    console.error("Error in getTeacherProfileById:", error);
    return errorResponse(res, "Failed to retrieve teacher profile", 500);
  }
};

const addEmployment = async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne({ userId: req.user.userId });
    if (!profile) return errorResponse(res, "Profile not found", 404);

    const employment = await TeacherEmployment.create({
      ...req.body,
      teacherId: profile._id,
    });

    return successResponse(res, "Employment added", { data: employment });
  } catch (e) {
    return errorResponse(res, "Failed to add employment", 500);
  }
};

const updateEmployment = async (req, res) => {
  try {
    const { employmentId } = req.params;
    const updated = await TeacherEmployment.findOneAndUpdate(
      { _id: employmentId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Employment not found", 404);
    return successResponse(res, "Employment updated", { data: updated });
  } catch (e) {
    return errorResponse(res, "Failed to update employment", 500);
  }
};

const deleteEmployment = async (req, res) => {
  try {
    const { employmentId } = req.params;
    const deleted = await TeacherEmployment.findOneAndDelete({
      _id: employmentId,
    });
    if (!deleted) return errorResponse(res, "Employment not found", 404);
    return successResponse(res, "Employment deleted", { data: deleted._id });
  } catch (e) {
    return errorResponse(res, "Failed to delete employment", 500);
  }
};

// ---------- Education ----------
const addEducation = async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne({ userId: req.user.userId });
    if (!profile) return errorResponse(res, "Profile not found", 404);

    const education = await TeacherEducation.create({
      ...req.body,
      teacherId: profile._id,
    });

    return successResponse(res, "Education added", { data: education });
  } catch (e) {
    return errorResponse(res, "Failed to add education", 500);
  }
};

const updateEducation = async (req, res) => {
  try {
    const { educationId } = req.params;
    const updated = await TeacherEducation.findOneAndUpdate(
      { _id: educationId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Education not found", 404);
    return successResponse(res, "Education updated", { data: updated });
  } catch (e) {
    return errorResponse(res, "Failed to update education", 500);
  }
};

const deleteEducation = async (req, res) => {
  try {
    const { educationId } = req.params;
    const deleted = await TeacherEducation.findOneAndDelete({
      _id: educationId,
    });
    if (!deleted) return errorResponse(res, "Education not found", 404);
    return successResponse(res, "Education deleted", { data: deleted._id });
  } catch (e) {
    return errorResponse(res, "Failed to delete education", 500);
  }
};

// ---------- Qualifications ----------
const addQualification = async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne({ userId: req.user.userId });
    if (!profile) return errorResponse(res, "Profile not found", 404);

    const qualification = await TeacherQualification.create({
      ...req.body,
      teacherId: profile._id,
    });

    return successResponse(res, "Qualification added", { data: qualification });
  } catch (e) {
    return errorResponse(res, "Failed to add qualification", 500);
  }
};

const updateQualification = async (req, res) => {
  try {
    const { qualificationId } = req.params;
    const updated = await TeacherQualification.findOneAndUpdate(
      { _id: qualificationId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Qualification not found", 404);
    return successResponse(res, "Qualification updated", { data: updated });
  } catch (e) {
    return errorResponse(res, "Failed to update qualification", 500);
  }
};

const deleteQualification = async (req, res) => {
  try {
    const { qualificationId } = req.params;
    const deleted = await TeacherQualification.findOneAndDelete({
      _id: qualificationId,
    });
    if (!deleted) return errorResponse(res, "Qualification not found", 404);
    return successResponse(res, "Qualification deleted", { data: deleted._id });
  } catch (e) {
    return errorResponse(res, "Failed to delete qualification", 500);
  }
};

// ---------- Referees ----------
const addReferee = async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne({ userId: req.user.userId });
    if (!profile) return errorResponse(res, "Profile not found", 404);

    const referee = await TeacherReferee.create({
      ...req.body,
      teacherId: profile._id,
    });

    return successResponse(res, "Referee added", { data: referee });
  } catch (e) {
    return errorResponse(res, "Failed to add referee", 500);
  }
};

const updateReferee = async (req, res) => {
  try {
    const { refereeId } = req.params;
    const updated = await TeacherReferee.findOneAndUpdate(
      { _id: refereeId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return errorResponse(res, "Referee not found", 404);
    return successResponse(res, "Referee updated", { data: updated });
  } catch (e) {
    return errorResponse(res, "Failed to update referee", 500);
  }
};

const deleteReferee = async (req, res) => {
  try {
    const { refereeId } = req.params;
    const deleted = await TeacherReferee.findOneAndDelete({ _id: refereeId });
    if (!deleted) return errorResponse(res, "Referee not found", 404);
    return successResponse(res, "Referee deleted", { data: deleted._id });
  } catch (e) {
    return errorResponse(res, "Failed to delete referee", 500);
  }
};
// Search teachers
const searchTeachers = async (req, res) => {
  try {
    const {
      country,
      city,
      subject,
      qualification,
      minExperience,
      maxExperience,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (country) query.country = new RegExp(country, "i");
    if (city) query.city = new RegExp(city, "i");
    if (subject) query.subject = new RegExp(subject, "i");
    if (qualification) query.qualification = qualification;
    if (minExperience || maxExperience) {
      query.yearsOfTeachingExperience = {};
      if (minExperience)
        query.yearsOfTeachingExperience.$gte = parseInt(minExperience);
      if (maxExperience)
        query.yearsOfTeachingExperience.$lte = parseInt(maxExperience);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const teachers = await TeacherProfile.find(query)
      .populate("user", "firstName lastName email role avatarUrl")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await TeacherProfile.countDocuments(query);

    return successResponse(res, "Teachers retrieved successfully", {
      data: teachers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error in searchTeachers:", error);
    return errorResponse(res, "Failed to search teachers", 500);
  }
};

// Get recommended jobs for teacher
const getRecommendedJobs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;

    // Validate limit parameter
    const jobLimit = Math.min(Math.max(parseInt(limit), 1), 20); // Between 1 and 20

    // Check if user exists and is a teacher
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    if (user.role !== "teacher") {
      return errorResponse(
        res,
        "Only teachers can access job recommendations",
        403
      );
    }

    // Get recommended jobs
    let recommendedJobs = await getRecommendedJobsForTeacher(userId, jobLimit);

    // If no specific matches found, get fallback jobs
    if (recommendedJobs.length === 0) {
      recommendedJobs = await getFallbackJobs(jobLimit);
    }

    // Add computed fields for each job
    const jobsWithComputedFields = recommendedJobs.map((job) => {
      const jobObj = job.toObject ? job.toObject() : job;

      // Calculate days posted
      if (jobObj.publishedAt) {
        const now = new Date();
        const diffTime = Math.abs(now - new Date(jobObj.publishedAt));
        jobObj.daysPosted = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Calculate salary range
      if (!jobObj.salaryDisclose) {
        jobObj.salaryRange = "Competitive";
      } else if (jobObj.salaryMin && jobObj.salaryMax) {
        jobObj.salaryRange = `${jobObj.salaryMin} - ${jobObj.salaryMax} ${jobObj.currency}`;
      } else if (jobObj.salaryMin) {
        jobObj.salaryRange = `From ${jobObj.salaryMin} ${jobObj.currency}`;
      } else if (jobObj.salaryMax) {
        jobObj.salaryRange = `Up to ${jobObj.salaryMax} ${jobObj.currency}`;
      } else {
        jobObj.salaryRange = "Competitive";
      }

      // Check if job is expired
      jobObj.isExpired = new Date() > new Date(jobObj.applicationDeadline);

      return jobObj;
    });

    return successResponse(res, "Recommended jobs retrieved successfully", {
      data: jobsWithComputedFields,
      total: jobsWithComputedFields.length,
      message:
        jobsWithComputedFields.length > 0
          ? `Found ${jobsWithComputedFields.length} recommended jobs`
          : "No specific matches found, showing recent available jobs",
    });
  } catch (error) {
    console.error("Error in getRecommendedJobs:", error);
    return errorResponse(res, "Failed to retrieve recommended jobs", 500);
  }
};

module.exports = {
  createOrUpdateTeacherProfile,
  getTeacherProfile,
  getTeacherProfileById,
  searchTeachers,
  getRecommendedJobs,
  addEmployment,
  updateEmployment,
  deleteEmployment,
  addEducation,
  updateEducation,
  deleteEducation,
  addQualification,
  updateQualification,
  deleteQualification,
  addReferee,
  updateReferee,
  deleteReferee,
};
