const schoolService = require("../services/school.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../utils/responseHandler");

/**
 * School Profile Controller
 * Handles HTTP requests for school profile operations
 */
class SchoolController {
  /**
   * Create school profile (Public - after OTP verification)
   * POST /api/v1/schools/createSchoolProfile
   */
  async createSchoolProfile(req, res) {
    try {
      const { email } = req.body;
      const profileData = req.validatedData;

      const schoolProfile = await schoolService.createSchoolProfile(
        profileData,
        email
      );

      return sendSuccessResponse(
        res,
        201,
        "School profile created successfully",
        {
          profile: schoolProfile,
        }
      );
    } catch (error) {
      console.error("Create school profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Update school profile (Protected - only authorized user)
   * PATCH /api/v1/schools/:id/updateSchoolProfile
   */
  async updateSchoolProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.validatedData;

      const schoolProfile = await schoolService.updateSchoolProfile(
        userId,
        updateData
      );

      return sendSuccessResponse(
        res,
        200,
        "School profile updated successfully",
        {
          profile: schoolProfile,
        }
      );
    } catch (error) {
      console.error("Update school profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get school profile (Protected - only authorized user)
   * GET /api/v1/schools/getSchoolProfile
   */
  async getSchoolProfile(req, res) {
    try {
      const userId = req.user.id;

      const schoolProfile = await schoolService.getSchoolProfile(userId);

      return sendSuccessResponse(
        res,
        200,
        "School profile retrieved successfully",
        {
          profile: schoolProfile,
        }
      );
    } catch (error) {
      console.error("Get school profile error:", error);
      return sendErrorResponse(res, 404, error.message);
    }
  }

  /**
   * Get school profile by email (Public)
   * GET /api/v1/schools/getSchoolProfileByEmail/:email
   */
  async getSchoolProfileByEmail(req, res) {
    try {
      const { email } = req.params;

      const schoolProfile = await schoolService.getSchoolProfileByEmail(email);

      return sendSuccessResponse(
        res,
        200,
        "School profile retrieved successfully",
        {
          profile: schoolProfile,
        }
      );
    } catch (error) {
      console.error("Get school profile by email error:", error);
      return sendErrorResponse(res, 404, error.message);
    }
  }

  /**
   * Search schools (Public)
   * GET /api/v1/schools/searchSchools
   */
  async searchSchools(req, res) {
    try {
      const filters = req.query;

      const schools = await schoolService.searchSchools(filters);

      return sendSuccessResponse(
        res,
        200,
        "Schools search completed successfully",
        {
          schools,
          count: schools.length,
        }
      );
    } catch (error) {
      console.error("Search schools error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get all complete school profiles (Public)
   * GET /api/v1/schools/getAllCompleteProfiles
   */
  async getAllCompleteProfiles(req, res) {
    try {
      const schools = await schoolService.getAllCompleteProfiles();

      return sendSuccessResponse(
        res,
        200,
        "Complete school profiles retrieved successfully",
        {
          schools,
          count: schools.length,
        }
      );
    } catch (error) {
      console.error("Get all complete profiles error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Delete school profile (Protected - only authorized user)
   * DELETE /api/v1/schools/deleteSchoolProfile
   */
  async deleteSchoolProfile(req, res) {
    try {
      const userId = req.user.id;

      await schoolService.deleteSchoolProfile(userId);

      return sendSuccessResponse(
        res,
        200,
        "School profile deleted successfully"
      );
    } catch (error) {
      console.error("Delete school profile error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Check profile completion status (Protected - only authorized user)
   * GET /api/v1/schools/checkProfileCompletion
   */
  async checkProfileCompletion(req, res) {
    try {
      const userId = req.user.id;

      const isComplete = await schoolService.isProfileComplete(userId);

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
   * Get school profile statistics (Admin only)
   * GET /api/v1/schools/getProfileStatistics
   */
  async getProfileStatistics(req, res) {
    try {
      const statistics = await schoolService.getProfileStatistics();

      return sendSuccessResponse(
        res,
        200,
        "School profile statistics retrieved successfully",
        {
          statistics,
        }
      );
    } catch (error) {
      console.error("Get profile statistics error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get schools by curriculum (Public)
   * GET /api/v1/schools/getSchoolsByCurriculum/:curriculum
   */
  async getSchoolsByCurriculum(req, res) {
    try {
      const { curriculum } = req.params;

      const schools = await schoolService.getSchoolsByCurriculum(curriculum);

      return sendSuccessResponse(
        res,
        200,
        "Schools by curriculum retrieved successfully",
        {
          schools,
          count: schools.length,
          curriculum,
        }
      );
    } catch (error) {
      console.error("Get schools by curriculum error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get schools by location (Public)
   * GET /api/v1/schools/getSchoolsByLocation
   */
  async getSchoolsByLocation(req, res) {
    try {
      const { country, city } = req.query;

      if (!country) {
        return sendErrorResponse(res, 400, "Country parameter is required");
      }

      const schools = await schoolService.getSchoolsByLocation(country, city);

      return sendSuccessResponse(
        res,
        200,
        "Schools by location retrieved successfully",
        {
          schools,
          count: schools.length,
          location: { country, city },
        }
      );
    } catch (error) {
      console.error("Get schools by location error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }

  /**
   * Get schools by type (Public)
   * GET /api/v1/schools/getSchoolsByType/:schoolType
   */
  async getSchoolsByType(req, res) {
    try {
      const { schoolType } = req.params;

      const schools = await schoolService.getSchoolsByType(schoolType);

      return sendSuccessResponse(
        res,
        200,
        "Schools by type retrieved successfully",
        {
          schools,
          count: schools.length,
          schoolType,
        }
      );
    } catch (error) {
      console.error("Get schools by type error:", error);
      return sendErrorResponse(res, 400, error.message);
    }
  }
}

module.exports = new SchoolController();
