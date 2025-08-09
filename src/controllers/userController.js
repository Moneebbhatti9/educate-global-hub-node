const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const { sanitizeUser } = require("../utils/auth");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
  updatedResponse,
  paginatedResponse,
} = require("../utils/response");

// Complete profile controller
const completeProfile = async (req, res, next) => {
  try {
    const { bio, address, roleSpecificData } = req.body;
    const userId = req.user.userId;

    // Check if profile already exists
    const existingProfile = await UserProfile.findOne({ userId });
    if (existingProfile) {
      return validationErrorResponse(res, "Profile already completed");
    }

    // Create profile
    const profile = new UserProfile({
      userId,
      bio,
      address,
      roleSpecificData,
    });

    await profile.save();

    // Update user profile completion status
    await User.findByIdAndUpdate(userId, { isProfileComplete: true });

    return successResponse(res, "Profile completed successfully");
  } catch (error) {
    next(error);
  }
};

// Update profile controller
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, bio, address, roleSpecificData } =
      req.body;
    const userId = req.user.userId;

    // Update user basic info
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (phone) updateFields.phone = phone;

    if (Object.keys(updateFields).length > 0) {
      await User.findByIdAndUpdate(userId, updateFields);
    }

    // Update profile data
    if (
      bio !== undefined ||
      address !== undefined ||
      roleSpecificData !== undefined
    ) {
      const existingProfile = await UserProfile.findOne({ userId });

      if (existingProfile) {
        // Update existing profile
        const profileUpdateFields = {};
        if (bio !== undefined) profileUpdateFields.bio = bio;
        if (address !== undefined) profileUpdateFields.address = address;
        if (roleSpecificData !== undefined)
          profileUpdateFields.roleSpecificData = roleSpecificData;

        await UserProfile.findByIdAndUpdate(
          existingProfile._id,
          profileUpdateFields
        );
      } else {
        // Create new profile
        const profile = new UserProfile({
          userId,
          bio: bio || null,
          address: address || null,
          roleSpecificData: roleSpecificData || null,
        });

        await profile.save();

        // Mark profile as complete
        await User.findByIdAndUpdate(userId, { isProfileComplete: true });
      }
    }

    return updatedResponse(res, "Profile updated successfully");
  } catch (error) {
    next(error);
  }
};

// Get current user profile controller
const getCurrentUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).populate("profile");
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponse(
      res,
      {
        user: sanitizeUser(user),
      },
      "Profile retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Get public user profile controller
const getPublicUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate("profile")
      .select("-passwordHash -refreshTokens");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponse(
      res,
      {
        user: sanitizeUser(user),
      },
      "User profile retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Get users list with filtering and pagination controller
const getUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;
    const validSortFields = ["createdAt", "firstName", "lastName", "role"];
    const validSortOrders = ["asc", "desc"];

    if (!validSortFields.includes(sortBy)) {
      return validationErrorResponse(res, "Invalid sort field");
    }

    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      return validationErrorResponse(res, "Invalid sort order");
    }

    // Build query conditions
    const conditions = { isEmailVerified: true };

    if (role) {
      conditions.role = role;
    }

    if (search) {
      conditions.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const total = await User.countDocuments(conditions);

    // Get users with profiles
    const users = await User.find(conditions)
      .select("firstName lastName role avatarUrl createdAt")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get profiles for users
    const userIds = users.map((user) => user._id);
    const profiles = await UserProfile.find({ userId: { $in: userIds } });

    // Combine users with their profiles
    const usersWithProfiles = users.map((user) => {
      const userData = sanitizeUser(user);
      const profile = profiles.find(
        (p) => p.userId.toString() === user._id.toString()
      );
      if (profile) {
        userData.bio = profile.bio;
      }
      return userData;
    });

    return paginatedResponse(res, "Users retrieved successfully", {
      users: usersWithProfiles,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user avatar controller
const updateAvatar = async (req, res, next) => {
  try {
    const { avatarUrl } = req.body;
    const userId = req.user.userId;

    if (!avatarUrl) {
      return validationErrorResponse(res, "Avatar URL is required");
    }

    await User.findByIdAndUpdate(userId, { avatarUrl });

    return updatedResponse(res, "Avatar updated successfully");
  } catch (error) {
    next(error);
  }
};

// Delete user account controller
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Delete user and related data (cascade handled by MongoDB)
    await User.findByIdAndDelete(userId);
    await UserProfile.findOneAndDelete({ userId });

    return successResponse(res, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  completeProfile,
  updateProfile,
  getCurrentUserProfile,
  getPublicUserProfile,
  getUsers,
  updateAvatar,
  deleteAccount,
};
