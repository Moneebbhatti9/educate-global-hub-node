const School = require("../../../models/School");
const User = require("../../../models/User");
const { sendErrorResponse } = require("../../../utils/responseHandler");

/**
 * School Profile Service
 * Handles all school profile-related business logic
 */
class SchoolService {
  /**
   * Create a new school profile
   * @param {Object} profileData - School profile data
   * @param {string} email - User email for verification
   * @returns {Promise<Object>} - Created school profile
   */
  async createSchoolProfile(profileData, email) {
    try {
      // Find user by email and verify they exist and are verified
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.isEmailVerified) {
        throw new Error("Email verification required before creating profile");
      }

      if (user.role !== "school") {
        throw new Error("User role must be school to create school profile");
      }

      // Check if profile already exists
      const existingProfile = await School.findByUserId(user._id);
      if (existingProfile) {
        throw new Error("School profile already exists for this user");
      }

      // Create school profile
      const schoolProfile = new School({
        userId: user._id,
        ...profileData,
      });

      await schoolProfile.save();

      // Update user's profile completion status
      user.isProfileComplete = true;
      user.profileCompletedAt = new Date();
      await user.save();

      return schoolProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update school profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated school profile
   */
  async updateSchoolProfile(userId, updateData) {
    try {
      // Find school profile by user ID
      const schoolProfile = await School.findByUserId(userId);
      if (!schoolProfile) {
        throw new Error("School profile not found");
      }

      // Update profile
      Object.assign(schoolProfile, updateData);
      await schoolProfile.save();

      return schoolProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get school profile by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - School profile
   */
  async getSchoolProfile(userId) {
    try {
      const schoolProfile = await School.findByUserId(userId);
      if (!schoolProfile) {
        throw new Error("School profile not found");
      }

      return schoolProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get school profile by email (for public access)
   * @param {string} email - User email
   * @returns {Promise<Object>} - School profile
   */
  async getSchoolProfileByEmail(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      const schoolProfile = await School.findByUserId(user._id);
      if (!schoolProfile) {
        throw new Error("School profile not found");
      }

      return schoolProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search schools with filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} - Array of school profiles
   */
  async searchSchools(filters = {}) {
    try {
      const schools = await School.searchSchools(filters);
      return schools;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all complete school profiles
   * @returns {Promise<Array>} - Array of complete school profiles
   */
  async getAllCompleteProfiles() {
    try {
      const schools = await School.findCompleteProfiles();
      return schools;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete school profile
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSchoolProfile(userId) {
    try {
      const schoolProfile = await School.findByUserId(userId);
      if (!schoolProfile) {
        throw new Error("School profile not found");
      }

      await School.findByIdAndDelete(schoolProfile._id);

      // Update user's profile completion status
      const user = await User.findById(userId);
      if (user) {
        user.isProfileComplete = false;
        user.profileCompletedAt = null;
        await user.save();
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if school profile is complete
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Profile completion status
   */
  async isProfileComplete(userId) {
    try {
      const schoolProfile = await School.findByUserId(userId);
      return schoolProfile ? schoolProfile.isProfileComplete : false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get school profile statistics
   * @returns {Promise<Object>} - Profile statistics
   */
  async getProfileStatistics() {
    try {
      const totalProfiles = await School.countDocuments();
      const completeProfiles = await School.countDocuments({
        isProfileComplete: true,
      });
      const incompleteProfiles = totalProfiles - completeProfiles;

      return {
        total: totalProfiles,
        complete: completeProfiles,
        incomplete: incompleteProfiles,
        completionRate:
          totalProfiles > 0 ? (completeProfiles / totalProfiles) * 100 : 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get schools by curriculum
   * @param {string} curriculum - Curriculum type
   * @returns {Promise<Array>} - Array of schools with specified curriculum
   */
  async getSchoolsByCurriculum(curriculum) {
    try {
      const schools = await School.find({
        curriculum: curriculum,
        isProfileComplete: true,
      });
      return schools;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get schools by location
   * @param {string} country - Country
   * @param {string} city - City (optional)
   * @returns {Promise<Array>} - Array of schools in specified location
   */
  async getSchoolsByLocation(country, city = null) {
    try {
      const query = { country, isProfileComplete: true };
      if (city) {
        query.city = city;
      }

      const schools = await School.find(query);
      return schools;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get schools by type
   * @param {string} schoolType - School type
   * @returns {Promise<Array>} - Array of schools of specified type
   */
  async getSchoolsByType(schoolType) {
    try {
      const schools = await School.find({
        schoolType,
        isProfileComplete: true,
      });
      return schools;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new SchoolService();
