const AdminUserManagementService = require("../services/adminUserManagementService");
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
};
