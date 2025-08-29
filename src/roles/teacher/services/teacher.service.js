const Teacher = require("../../../models/Teacher");
const User = require("../../../models/User");
const { sendErrorResponse } = require("../../../utils/responseHandler");

/**
 * Teacher Profile Service
 * Handles all teacher profile-related business logic
 */
class TeacherService {
  /**
   * Create a new teacher profile
   * @param {Object} profileData - Teacher profile data
   * @param {string} email - User email for verification
   * @returns {Promise<Object>} - Created teacher profile
   */
  async createTeacherProfile(profileData, email) {
    try {
      // Find user by email and verify they exist and are verified
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.isEmailVerified) {
        throw new Error("Email verification required before creating profile");
      }

      if (user.role !== "teacher") {
        throw new Error("User role must be teacher to create teacher profile");
      }

      // Check if profile already exists
      const existingProfile = await Teacher.findByUserId(user._id);
      if (existingProfile) {
        throw new Error("Teacher profile already exists for this user");
      }

      // Create teacher profile
      const teacherProfile = new Teacher({
        userId: user._id,
        ...profileData,
      });

      await teacherProfile.save();

      // Update user's profile completion status
      user.isProfileComplete = true;
      user.profileCompletedAt = new Date();
      await user.save();

      return teacherProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update teacher profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated teacher profile
   */
  async updateTeacherProfile(userId, updateData) {
    try {
      // Find teacher profile by user ID
      const teacherProfile = await Teacher.findByUserId(userId);
      if (!teacherProfile) {
        throw new Error("Teacher profile not found");
      }

      // Update profile
      Object.assign(teacherProfile, updateData);
      await teacherProfile.save();

      return teacherProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get teacher profile by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Teacher profile
   */
  async getTeacherProfile(userId) {
    try {
      const teacherProfile = await Teacher.findByUserId(userId);
      if (!teacherProfile) {
        throw new Error("Teacher profile not found");
      }

      return teacherProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get teacher profile by email (for public access)
   * @param {string} email - User email
   * @returns {Promise<Object>} - Teacher profile
   */
  async getTeacherProfileByEmail(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error("User not found");
      }

      const teacherProfile = await Teacher.findByUserId(user._id);
      if (!teacherProfile) {
        throw new Error("Teacher profile not found");
      }

      return teacherProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search teachers with filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} - Array of teacher profiles
   */
  async searchTeachers(filters = {}) {
    try {
      const teachers = await Teacher.searchTeachers(filters);
      return teachers;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all complete teacher profiles
   * @returns {Promise<Array>} - Array of complete teacher profiles
   */
  async getAllCompleteProfiles() {
    try {
      const teachers = await Teacher.findCompleteProfiles();
      return teachers;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete teacher profile
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteTeacherProfile(userId) {
    try {
      const teacherProfile = await Teacher.findByUserId(userId);
      if (!teacherProfile) {
        throw new Error("Teacher profile not found");
      }

      await Teacher.findByIdAndDelete(teacherProfile._id);

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
   * Check if teacher profile is complete
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Profile completion status
   */
  async isProfileComplete(userId) {
    try {
      const teacherProfile = await Teacher.findByUserId(userId);
      return teacherProfile ? teacherProfile.isProfileComplete : false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get teacher profile statistics
   * @returns {Promise<Object>} - Profile statistics
   */
  async getProfileStatistics() {
    try {
      const totalProfiles = await Teacher.countDocuments();
      const completeProfiles = await Teacher.countDocuments({
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
}

module.exports = new TeacherService();
