const TeacherProfile = require("../models/TeacherProfile");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { validateAndFormatPhone } = require("../utils/phoneUtils");

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
      certifications,
      additionalQualifications,
    } = req.body;

    // Check if user exists and is a teacher
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    if (user.role !== "teacher") {
      return errorResponse(
        res,
        "Only teachers can create teacher profiles",
        403
      );
    }

    // Validate and format phone number
    const phoneValidation = validateAndFormatPhone(phoneNumber, country);
    if (!phoneValidation.isValid) {
      return errorResponse(res, phoneValidation.error, 400);
    }

    // Check if profile already exists
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
        certifications: certifications || [],
        additionalQualifications: additionalQualifications || [],
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
        certifications: certifications || [],
        additionalQualifications: additionalQualifications || [],
      });

      await teacherProfile.save();
    }

    // Check if profile is complete
    const isComplete = teacherProfile.checkProfileCompletion();
    teacherProfile.isProfileComplete = isComplete;
    await teacherProfile.save();

    // Update user's profile completion status
    await User.findByIdAndUpdate(userId, { isProfileComplete: isComplete });

    return successResponse(res, "Teacher profile updated successfully", {
      data: teacherProfile,
      message: isComplete ? "Profile is complete" : "Profile is incomplete",
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

    if (!teacherProfile) {
      return errorResponse(res, "Teacher profile not found", 404);
    }

    return successResponse(res, "Teacher profile retrieved successfully", {
      data: teacherProfile,
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

    if (!teacherProfile) {
      return errorResponse(res, "Teacher profile not found", 404);
    }

    // Remove sensitive information for public viewing
    const publicProfile = {
      ...teacherProfile.toObject(),
      phoneNumber: undefined, // Don't expose phone number publicly
      address: undefined, // Don't expose full address publicly
    };

    return successResponse(res, "Teacher profile retrieved successfully", {
      data: publicProfile,
    });
  } catch (error) {
    console.error("Error in getTeacherProfileById:", error);
    return errorResponse(res, "Failed to retrieve teacher profile", 500);
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

module.exports = {
  createOrUpdateTeacherProfile,
  getTeacherProfile,
  getTeacherProfileById,
  searchTeachers,
};
