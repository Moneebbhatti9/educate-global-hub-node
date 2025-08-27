const cloudinary = require("../config/cloudinary");
const User = require("../models/User");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  deletedResponse,
} = require("../utils/response");

// Upload avatar controller
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return validationErrorResponse(res, "No file uploaded");
    }

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "avatars",
      transformation: [
        { width: 200, height: 200, crop: "fill" },
        { quality: "auto" },
      ],
    });

    // Update user's avatar URL
    await User.findByIdAndUpdate(req.user.userId, {
      avatarUrl: result.secure_url,
    });

    return successResponse(
      res,
      {
        avatarUrl: result.secure_url,
      },
      "Avatar uploaded successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Upload document controller
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return validationErrorResponse(res, "No file uploaded");
    }

    // Convert buffer to base64
    const base64File = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${base64File}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "documents",
      resource_type: "auto",
    });

    return successResponse(
      res,
      {
        documentUrl: result.secure_url,
        publicId: result.public_id,
      },
      "Document uploaded successfully"
    );
  } catch (error) {
    next(error);
  }
};

// Delete file controller
const deleteFile = async (req, res, next) => {
  try {
    const { publicId } = req.params;

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      return successResponse(res, null, "File deleted successfully");
    } else {
      return errorResponse(res, "Failed to delete file", 500);
    }
  } catch (error) {
    next(error);
  }
};

// Get upload preset controller
const getUploadPreset = async (req, res, next) => {
  try {
    const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!preset) {
      return errorResponse(res, "Upload preset not configured", 500);
    }

    return successResponse(
      res,
      {
        uploadPreset: preset,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      },
      "Upload preset generated successfully"
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAvatar,
  uploadDocument,
  deleteFile,
  getUploadPreset,
};
