const { cloudinary } = require("../config/cloudinary");
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

    // Determine the best resource_type based on file mime type
    // Use 'raw' for documents to avoid transformation issues
    const isDocument = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
    ].includes(req.file.mimetype);

    const resourceType = isDocument ? 'raw' : 'auto';

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "documents",
      resource_type: resourceType,
      // Use 'upload' type for public access (not 'authenticated' or 'private')
      type: "upload",
      // Allow public access
      access_mode: "public",
    });

    return successResponse(
      res,
      {
        documentUrl: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
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
