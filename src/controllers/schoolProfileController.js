const SchoolProfile = require("../models/SchoolProfile");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { validateAndFormatPhone } = require("../utils/phoneUtils");

// Create or update school profile
const createOrUpdateSchoolProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      schoolName,
      schoolEmail,
      schoolContactNumber,
      country,
      city,
      province,
      zipCode,
      address,
      curriculum,
      schoolSize,
      schoolType,
      genderType,
      ageGroup,
      schoolWebsite,
      aboutSchool,
    } = req.body;

    // Check if user exists and is a school
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    if (user.role !== "school") {
      return errorResponse(res, "Only schools can create school profiles", 403);
    }

    // Validate and format phone number
    const phoneValidation = validateAndFormatPhone(
      schoolContactNumber,
      country
    );
    if (!phoneValidation.isValid) {
      return errorResponse(res, phoneValidation.error, 400);
    }

    // Check if profile already exists
    let schoolProfile = await SchoolProfile.findOne({ userId });

    if (schoolProfile) {
      // Update existing profile
      const updateData = {
        schoolName,
        schoolEmail,
        schoolContactNumber: phoneValidation.formatted,
        country,
        city,
        province,
        zipCode,
        address,
        curriculum,
        schoolSize,
        schoolType,
        genderType,
        ageGroup,
        schoolWebsite,
        aboutSchool,
      };

      schoolProfile = await SchoolProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      schoolProfile = new SchoolProfile({
        userId,
        schoolName,
        schoolEmail,
        schoolContactNumber: phoneValidation.formatted,
        country,
        city,
        province,
        zipCode,
        address,
        curriculum,
        schoolSize,
        schoolType,
        genderType,
        ageGroup,
        schoolWebsite,
        aboutSchool,
      });

      await schoolProfile.save();
    }

    // Check if profile is complete
    const isComplete = schoolProfile.checkProfileCompletion();
    schoolProfile.isProfileComplete = isComplete;
    await schoolProfile.save();

    // Update user's profile completion status
    await User.findByIdAndUpdate(userId, { isProfileComplete: isComplete });

    return successResponse(res, "School profile updated successfully", {
      data: schoolProfile,
      message: isComplete ? "Profile is complete" : "Profile is incomplete",
    });
  } catch (error) {
    console.error("Error in createOrUpdateSchoolProfile:", error);
    return errorResponse(res, "Failed to update school profile", 500);
  }
};

// Get school profile
const getSchoolProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const schoolProfile = await SchoolProfile.findOne({ userId }).populate(
      "user",
      "email firstName lastName role"
    );

    if (!schoolProfile) {
      return errorResponse(res, "School profile not found", 404);
    }

    return successResponse(res, "School profile retrieved successfully", {
      data: schoolProfile,
    });
  } catch (error) {
    console.error("Error in getSchoolProfile:", error);
    return errorResponse(res, "Failed to retrieve school profile", 500);
  }
};

// Get school profile by ID (for public viewing)
const getSchoolProfileById = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const schoolProfile = await SchoolProfile.findOne({
      userId: schoolId,
    }).populate("user", "firstName lastName email role avatarUrl");

    if (!schoolProfile) {
      return errorResponse(res, "School profile not found", 404);
    }

    return successResponse(res, "School profile retrieved successfully", {
      data: schoolProfile,
    });
  } catch (error) {
    console.error("Error in getSchoolProfileById:", error);
    return errorResponse(res, "Failed to retrieve school profile", 500);
  }
};

// Search schools
const searchSchools = async (req, res) => {
  try {
    const {
      country,
      city,
      curriculum,
      schoolType,
      genderType,
      ageGroup,
      schoolSize,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (country) query.country = new RegExp(country, "i");
    if (city) query.city = new RegExp(city, "i");
    if (curriculum) query.curriculum = { $in: [curriculum] };
    if (schoolType) query.schoolType = schoolType;
    if (genderType) query.genderType = genderType;
    if (ageGroup) query.ageGroup = { $in: [ageGroup] };
    if (schoolSize) query.schoolSize = schoolSize;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const schools = await SchoolProfile.find(query)
      .populate("user", "firstName lastName email role avatarUrl")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await SchoolProfile.countDocuments(query);

    return successResponse(res, "Schools retrieved successfully", {
      data: schools,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error in searchSchools:", error);
    return errorResponse(res, "Failed to search schools", 500);
  }
};

module.exports = {
  createOrUpdateSchoolProfile,
  getSchoolProfile,
  getSchoolProfileById,
  searchSchools,
};
