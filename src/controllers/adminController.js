const AdminUserManagementService = require("../services/adminUserManagementService");
const AdminJobManagementService = require("../services/adminJobManagementService");
const { sendEmail } = require("../config/email");
const {
  adminUserCreatedTemplate,
  adminUserCreatedTextTemplate,
} = require("../templates/emails/admin-user-created");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  paginatedResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
} = require("../utils/response");

// Get all users with pagination, search, and filters
const getAllUsers = async (req, res) => {
  try {
    const result = await AdminUserManagementService.getAllUsers(req.query);
    return paginatedResponse(
      res,
      result.users,
      result.pagination,
      "Users retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting all users:", error);
    return errorResponse(res, "Failed to retrieve users", 500);
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await AdminUserManagementService.getUserById(id);
    return successResponse(res, user, "User retrieved successfully");
  } catch (error) {
    console.error("Error getting user by ID:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    return errorResponse(res, "Failed to retrieve user", 500);
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const userData = req.body;
    const user = await AdminUserManagementService.createUser(userData);

    // Send email with credentials
    try {
      const emailHtml = adminUserCreatedTemplate({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        defaultPassword: user.defaultPassword,
      });

      const emailResult = await sendEmail(
        user.email,
        "Welcome to Educate Global Hub - Your Account Credentials",
        emailHtml
      );

      if (!emailResult.success) {
        console.error("Email failed to send:", emailResult.error);
        // Update response to indicate email failure
        user.emailSent = false;
        user.emailStatus = `Email failed to send: ${emailResult.error}`;
      } else {
        user.emailSent = true;
        user.emailStatus = "Email with credentials sent successfully";
      }
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // Don't fail the user creation if email fails
      user.emailSent = false;
      user.emailStatus = `Email error: ${emailError.message}`;
    }

    // Remove password from response
    delete user.defaultPassword;

    // Add email status to response
    const responseData = {
      ...user,
      emailSent: true,
      emailStatus: "Email with credentials sent successfully",
    };

    const message = responseData.emailSent
      ? "User created successfully"
      : "User created successfully, but email failed to send. Please check email configuration.";

    return createdResponse(res, responseData, message);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.message === "Email already exists") {
      return validationErrorResponse(res, { email: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return validationErrorResponse(res, errors);
    }
    return errorResponse(res, "Failed to create user", 500);
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await AdminUserManagementService.updateUser(id, req.body);
    return updatedResponse(res, user, "User updated successfully");
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    if (error.message === "Email already exists") {
      return validationErrorResponse(res, { email: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return validationErrorResponse(res, errors);
    }
    return errorResponse(res, "Failed to update user", 500);
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await AdminUserManagementService.deleteUser(id);
    return deletedResponse(res, "User deleted successfully");
  } catch (error) {
    console.error("Error deleting user:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    return errorResponse(res, "Failed to delete user", 500);
  }
};

// Change user status
const changeUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = await AdminUserManagementService.changeUserStatus(id, status);
    return updatedResponse(res, user, "User status updated successfully");
  } catch (error) {
    console.error("Error changing user status:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    if (error.message === "Invalid status value") {
      return validationErrorResponse(res, { status: "Invalid status value" });
    }
    return errorResponse(res, "Failed to update user status", 500);
  }
};

// Get user profile details
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AdminUserManagementService.getUserProfile(id);
    return successResponse(res, result, "User profile retrieved successfully");
  } catch (error) {
    console.error("Error getting user profile:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    return errorResponse(res, "Failed to retrieve user profile", 500);
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await AdminUserManagementService.updateUserProfile(
      id,
      req.body
    );
    return updatedResponse(res, profile, "User profile updated successfully");
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (error.message === "User not found") {
      return notFoundResponse(res, "User not found");
    }
    if (
      error.message === "Teacher profile not found" ||
      error.message === "School profile not found"
    ) {
      return notFoundResponse(res, error.message);
    }
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return validationErrorResponse(res, errors);
    }
    return errorResponse(res, "Failed to update user profile", 500);
  }
};

// Export users to CSV/Excel
const exportUsers = async (req, res) => {
  try {
    const csvData = await AdminUserManagementService.exportUsers(req.query);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");
    return res.send(csvData);
  } catch (error) {
    console.error("Error exporting users:", error);
    return errorResponse(res, "Failed to export users", 500);
  }
};

// Get recently active users
const getRecentlyActiveUsers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const users = await AdminUserManagementService.getUsersByLastActive(
      parseInt(limit)
    );
    return successResponse(
      res,
      users,
      "Recently active users retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting recently active users:", error);
    return errorResponse(res, "Failed to retrieve recently active users", 500);
  }
};

// ==================== JOB MANAGEMENT FUNCTIONS ====================

// Get all jobs with pagination, search, and filters
const getAllJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      jobType,
      country,
      city,
      educationLevel,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const result = await AdminJobManagementService.getAllJobs({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      jobType,
      country,
      city,
      educationLevel,
      sortBy,
      sortOrder,
    });

    return paginatedResponse(
      res,
      result.jobs,
      result.pagination,
      "Jobs retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting all jobs:", error);
    return errorResponse(res, "Failed to retrieve jobs", 500);
  }
};

// Get job statistics
const getJobStatistics = async (req, res) => {
  try {
    const stats = await AdminJobManagementService.getJobStatistics();
    return successResponse(res, stats, "Job statistics retrieved successfully");
  } catch (error) {
    console.error("Error getting job statistics:", error);
    return errorResponse(res, "Failed to retrieve job statistics", 500);
  }
};

// Get job by ID
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await AdminJobManagementService.getJobById(id);
    return successResponse(res, job, "Job retrieved successfully");
  } catch (error) {
    console.error("Error getting job by ID:", error);
    if (error.message === "Job not found") {
      return notFoundResponse(res, "Job not found");
    }
    return errorResponse(res, "Failed to retrieve job", 500);
  }
};

// Update job status
const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const job = await AdminJobManagementService.updateJobStatus(
      id,
      status,
      reason
    );
    return updatedResponse(
      res,
      job,
      `Job status updated to ${status} successfully`
    );
  } catch (error) {
    console.error("Error updating job status:", error);
    if (error.message === "Job not found") {
      return notFoundResponse(res, "Job not found");
    }
    if (error.message === "Invalid status") {
      return validationErrorResponse(res, { status: error.message });
    }
    return errorResponse(res, "Failed to update job status", 500);
  }
};

// Delete job
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await AdminJobManagementService.deleteJob(id, reason);
    return deletedResponse(res, "Job deleted successfully");
  } catch (error) {
    console.error("Error deleting job:", error);
    if (error.message === "Job not found") {
      return notFoundResponse(res, "Job not found");
    }
    return errorResponse(res, "Failed to delete job", 500);
  }
};

// Export jobs
const exportJobs = async (req, res) => {
  try {
    const {
      status,
      jobType,
      country,
      city,
      educationLevel,
      format = "csv",
    } = req.query;

    const result = await AdminJobManagementService.exportJobs({
      status,
      jobType,
      country,
      city,
      educationLevel,
      format,
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=jobs-export.csv"
      );
      return res.send(result.data);
    } else if (format === "json") {
      return successResponse(res, result.data, "Jobs exported successfully");
    } else {
      return errorResponse(res, "Unsupported export format", 400);
    }
  } catch (error) {
    console.error("Error exporting jobs:", error);
    return errorResponse(res, "Failed to export jobs", 500);
  }
};

// Get job applications
const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const result = await AdminJobManagementService.getJobApplications(jobId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      sortBy,
      sortOrder,
    });

    return paginatedResponse(
      res,
      result.applications,
      result.pagination,
      "Job applications retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting job applications:", error);
    if (error.message === "Job not found") {
      return notFoundResponse(res, "Job not found");
    }
    return errorResponse(res, "Failed to retrieve job applications", 500);
  }
};

// Bulk update job statuses
const bulkUpdateJobStatuses = async (req, res) => {
  try {
    const { jobIds, status, reason } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return validationErrorResponse(res, {
        jobIds: "Job IDs array is required and must not be empty",
      });
    }

    const result = await AdminJobManagementService.bulkUpdateJobStatuses(
      jobIds,
      status,
      reason
    );
    return successResponse(
      res,
      result,
      `Successfully updated ${result.updatedCount} jobs to ${status}`
    );
  } catch (error) {
    console.error("Error bulk updating job statuses:", error);
    if (error.message === "Invalid status") {
      return validationErrorResponse(res, { status: error.message });
    }
    return errorResponse(res, "Failed to bulk update job statuses", 500);
  }
};

// Get job analytics
const getJobAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const analytics = await AdminJobManagementService.getJobAnalytics(period);
    return successResponse(
      res,
      analytics,
      "Job analytics retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting job analytics:", error);
    return errorResponse(res, "Failed to retrieve job analytics", 500);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserStatus,
  getUserProfile,
  updateUserProfile,
  exportUsers,
  getRecentlyActiveUsers,
  // Job management exports
  getAllJobs,
  getJobStatistics,
  getJobById,
  updateJobStatus,
  deleteJob,
  exportJobs,
  getJobApplications,
  bulkUpdateJobStatuses,
  getJobAnalytics,
};
