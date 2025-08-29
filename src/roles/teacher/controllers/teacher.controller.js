const teacherService = require("../services/teacher.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../utils/responseHandler");

/**
 * Teacher Profile Controller
 * Handles HTTP requests for teacher profile operations
 */
class TeacherController {
  /**
   * Create teacher profile (Public - after OTP verification)
   * POST /api/v1/teachers/createTeacherProfile
   */
  async createTeacherProfile(req, res) {
    try {
      const { email } = req.body;
      const profileData = req.validatedData;

      const teacherProfile = await teacherService.createTeacherProfile(
        profileData,
        email
      );

      return sendSuccessResponse(
        res,
        201,
        "Teacher profile created successfully",
        {
          profile: teacherProfile,
        }
      );
    } catch (error) {
      console.error("Create teacher profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Update teacher profile (Protected - only authorized user)
   * PATCH /api/v1/teachers/:id/updateTeacherProfile
   */
  async updateTeacherProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.validatedData;

      const teacherProfile = await teacherService.updateTeacherProfile(
        userId,
        updateData
      );

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile updated successfully",
        {
          profile: teacherProfile,
        }
      );
    } catch (error) {
      console.error("Update teacher profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get teacher profile (Protected - only authorized user)
   * GET /api/v1/teachers/getTeacherProfile
   */
  async getTeacherProfile(req, res) {
    try {
      const userId = req.user.id;

      const teacherProfile = await teacherService.getTeacherProfile(userId);

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile retrieved successfully",
        {
          profile: teacherProfile,
        }
      );
    } catch (error) {
      console.error("Get teacher profile error:", error);
      return sendErrorResponse(res, 404, error.message);
    }
  }

  /**
   * Get teacher profile by email (Public)
   * GET /api/v1/teachers/getTeacherProfileByEmail/:email
   */
  async getTeacherProfileByEmail(req, res) {
    try {
      const { email } = req.params;

      const teacherProfile = await teacherService.getTeacherProfileByEmail(
        email
      );

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile retrieved successfully",
        {
          profile: teacherProfile,
        }
      );
    } catch (error) {
      console.error("Get teacher profile by email error:", error);
      return sendErrorResponse(res, 404, error.message);
    }
  }

  /**
   * Search teachers (Public)
   * GET /api/v1/teachers/searchTeachers
   */
  async searchTeachers(req, res) {
    try {
      const filters = req.query;

      const teachers = await teacherService.searchTeachers(filters);

      return sendSuccessResponse(
        res,
        200,
        "Teachers search completed successfully",
        {
          teachers,
          count: teachers.length,
        }
      );
    } catch (error) {
      console.error("Search teachers error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get all complete teacher profiles (Public)
   * GET /api/v1/teachers/getAllCompleteProfiles
   */
  async getAllCompleteProfiles(req, res) {
    try {
      const teachers = await teacherService.getAllCompleteProfiles();

      return sendSuccessResponse(
        res,
        200,
        "Complete teacher profiles retrieved successfully",
        {
          teachers,
          count: teachers.length,
        }
      );
    } catch (error) {
      console.error("Get all complete profiles error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Delete teacher profile (Protected - only authorized user)
   * DELETE /api/v1/teachers/deleteTeacherProfile
   */
  async deleteTeacherProfile(req, res) {
    try {
      const userId = req.user.id;

      await teacherService.deleteTeacherProfile(userId);

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile deleted successfully"
      );
    } catch (error) {
      console.error("Delete teacher profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Check profile completion status (Protected - only authorized user)
   * GET /api/v1/teachers/checkProfileCompletion
   */
  async checkProfileCompletion(req, res) {
    try {
      const userId = req.user.id;

      const isComplete = await teacherService.isProfileComplete(userId);

      return sendSuccessResponse(
        res,
        200,
        "Profile completion status checked successfully",
        {
          isComplete,
        }
      );
    } catch (error) {
      console.error("Check profile completion error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get teacher profile statistics (Admin only)
   * GET /api/v1/teachers/getProfileStatistics
   */
  async getProfileStatistics(req, res) {
    try {
      const statistics = await teacherService.getProfileStatistics();

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile statistics retrieved successfully",
        {
          statistics,
        }
      );
    } catch (error) {
      console.error("Get profile statistics error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }
}

module.exports = new TeacherController();
