const SchoolProfile = require("../models/SchoolProfile");
const SchoolProgram = require("../models/SchoolProgram");
const SchoolMedia = require("../models/SchoolMedia");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { validateAndFormatPhone } = require("../utils/phoneUtils");
const { uploadImage, deleteImage } = require("../config/cloudinary");

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
      registrationNumber,
      alternateContactNumber,
      establishedYear,
      mission,
      vision,
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
    let phoneValidationAlt = { isValid: true, formatted: undefined };
    if (alternateContactNumber) {
      phoneValidationAlt = validateAndFormatPhone(
        alternateContactNumber,
        country
      );
      if (!phoneValidationAlt.isValid) {
        return errorResponse(res, phoneValidationAlt.error, 400);
      }
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
        registrationNumber,
        alternateContactNumber:
          phoneValidationAlt?.formatted || alternateContactNumber,
        establishedYear,
        mission,
        vision,
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
    const [programs, media] = await Promise.all([
      SchoolProgram.find({ schoolId: schoolProfile._id }).sort({
        createdAt: -1,
      }),
      SchoolMedia.find({ schoolId: schoolProfile._id }).sort({ createdAt: -1 }),
    ]);
    return successResponse(res, "School profile retrieved successfully", {
      data: {
        ...schoolProfile.toObject(),
        programs,
        media,
      },
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

async function getMySchoolId(userId) {
  const school = await SchoolProfile.findOne({ userId }, "_id");
  return school ? school._id : null;
}

// Add program
const addProgram = async (req, res) => {
  try {
    const schoolId = await getMySchoolId(req.user.userId);
    if (!schoolId) return errorResponse(res, "School profile not found", 404);

    const program = await SchoolProgram.create({
      schoolId,
      createdBy: req.user.userId,
      ...req.body,
    });

    return successResponse(res, "Program added successfully", {
      data: program,
    });
  } catch (err) {
    console.error("addProgram:", err);
    return errorResponse(res, "Failed to add program", 500);
  }
};

// Update program
const updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const program = await SchoolProgram.findById(id);
    if (!program) return errorResponse(res, "Program not found", 404);

    const owns = await SchoolProfile.exists({
      _id: program.schoolId,
      userId: req.user.userId,
    });
    if (!owns) return errorResponse(res, "Forbidden", 403);

    Object.assign(program, req.body);
    await program.save();

    return successResponse(res, "Program updated successfully", {
      data: program,
    });
  } catch (err) {
    console.error("updateProgram:", err);
    return errorResponse(res, "Failed to update program", 500);
  }
};

// Delete program
const deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const program = await SchoolProgram.findById(id);
    if (!program) return errorResponse(res, "Program not found", 404);

    const owns = await SchoolProfile.exists({
      _id: program.schoolId,
      userId: req.user.userId,
    });
    if (!owns) return errorResponse(res, "Forbidden", 403);

    await program.deleteOne();
    return successResponse(res, "Program deleted successfully", {
      data: { id },
    });
  } catch (err) {
    console.error("deleteProgram:", err);
    return errorResponse(res, "Failed to delete program", 500);
  }
};

// List my programs
const listMyPrograms = async (req, res) => {
  try {
    const schoolId = await getMySchoolId(req.user.userId);
    if (!schoolId) return errorResponse(res, "School profile not found", 404);

    const programs = await SchoolProgram.find({ schoolId }).sort({
      createdAt: -1,
    });
    return successResponse(res, "Programs retrieved", { data: programs });
  } catch (err) {
    console.error("listMyPrograms:", err);
    return errorResponse(res, "Failed to fetch programs", 500);
  }
};

// Public: list programs by schoolId
const listProgramsBySchoolId = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const programs = await SchoolProgram.find({
      schoolId,
      isActive: true,
    }).sort({ createdAt: -1 });
    return successResponse(res, "Programs retrieved", { data: programs });
  } catch (err) {
    console.error("listProgramsBySchoolId:", err);
    return errorResponse(res, "Failed to fetch programs", 500);
  }
};

const addSchoolMedia = async (req, res) => {
  try {
    const userId = req.user.userId;
    const schoolProfile = await SchoolProfile.findOne({ userId });
    if (!schoolProfile)
      return errorResponse(res, "School profile not found", 404);

    if (!req.files || req.files.length === 0)
      return errorResponse(res, "No files uploaded", 400);

    const uploadedMedia = [];
    for (const file of req.files) {
      const result = await uploadImage(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        `educate-hub/schools/${schoolProfile._id}`
      );
      if (!result.success) continue;

      const media = await SchoolMedia.create({
        schoolId: schoolProfile._id,
        url: result.url,
        publicId: result.public_id,
        mediaType: "image",
        uploadedBy: userId,
        width: result.width,
        height: result.height,
        size: result.size,
        format: result.format,
      });
      uploadedMedia.push(media);
    }

    return successResponse(res, "Media uploaded successfully", {
      files: uploadedMedia,
    });
  } catch (err) {
    console.error("addSchoolMedia error:", err);
    return errorResponse(res, "Failed to upload media", 500);
  }
};

// Get school media
const getSchoolMedia = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const media = await SchoolMedia.find({ schoolId }).sort({ createdAt: -1 });
    return successResponse(res, "Media retrieved", { files: media });
  } catch (err) {
    console.error("getSchoolMedia error:", err);
    return errorResponse(res, "Failed to fetch media", 500);
  }
};

// Delete school media
const deleteSchoolMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user.userId;

    const media = await SchoolMedia.findById(mediaId);
    if (!media) return errorResponse(res, "Media not found", 404);

    const schoolProfile = await SchoolProfile.findById(media.schoolId);
    if (!schoolProfile || !schoolProfile.userId.equals(userId)) {
      return errorResponse(res, "Not authorized to delete this media", 403);
    }

    await deleteImage(media.publicId);
    await media.deleteOne();

    return successResponse(res, "Media deleted successfully");
  } catch (err) {
    console.error("deleteSchoolMedia error:", err);
    return errorResponse(res, "Failed to delete media", 500);
  }
};

module.exports = {
  createOrUpdateSchoolProfile,
  getSchoolProfile,
  getSchoolProfileById,
  searchSchools,
  addProgram,
  listMyPrograms,
  updateProgram,
  deleteProgram,
  listProgramsBySchoolId,
  addSchoolMedia,
  getSchoolMedia,
  deleteSchoolMedia,
};
