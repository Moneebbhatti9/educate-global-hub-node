const {
  uploadToCloudinary,
  deleteFromCloudinary,
  isValidFileSize,
  getFileExtension,
} = require("./fileUpload.util");
const { sendSuccessResponse, sendErrorResponse } = require("./responseHandler");
const {
  uploadSchema,
  multipleUploadSchema,
  validateUploadRequest,
} = require("./upload.validation");

/**
 * Upload Controller
 * Handles file upload operations to Cloudinary
 */
class UploadController {
  /**
   * Upload single file
   * POST /api/v1/upload/uploadFile
   */
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return sendErrorResponse(res, 400, "No file uploaded");
      }

      const { fileType, description } = req.validatedData;
      const file = req.file;

      // Validate file size
      if (!isValidFileSize(file.size)) {
        return sendErrorResponse(res, 400, "File size exceeds maximum limit");
      }

      // Determine folder based on file type
      const folder = this.getFolderByFileType(fileType);

      // Upload to Cloudinary
      const uploadOptions = {
        folder: `educate-global-hub/${folder}`,
        resource_type: "auto",
        public_id: `${fileType}_${Date.now()}`,
        overwrite: false,
      };

      const result = await uploadToCloudinary(file.buffer, uploadOptions);

      return sendSuccessResponse(res, 201, "File uploaded successfully", {
        file: {
          url: result.url,
          publicId: result.public_id,
          format: result.format,
          size: result.size,
          width: result.width,
          height: result.height,
          fileType,
          description,
          originalName: file.originalname,
          mimetype: file.mimetype,
        },
      });
    } catch (error) {
      console.error("Upload file error:", error);
      return sendErrorResponse(res, 500, "Failed to upload file");
    }
  }

  /**
   * Upload multiple files
   * POST /api/v1/upload/uploadMultipleFiles
   */
  async uploadMultipleFiles(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return sendErrorResponse(res, 400, "No files uploaded");
      }

      const { fileType, descriptions } = req.validatedData;
      const files = req.files;

      // Validate total files count
      if (files.length > 10) {
        return sendErrorResponse(
          res,
          400,
          "Maximum 10 files allowed per upload"
        );
      }

      // Determine folder based on file type
      const folder = this.getFolderByFileType(fileType);

      const uploadPromises = files.map(async (file, index) => {
        // Validate file size
        if (!isValidFileSize(file.size)) {
          throw new Error(
            `File ${file.originalname} size exceeds maximum limit`
          );
        }

        const uploadOptions = {
          folder: `educate-global-hub/${folder}`,
          resource_type: "auto",
          public_id: `${fileType}_${Date.now()}_${index}`,
          overwrite: false,
        };

        const result = await uploadToCloudinary(file.buffer, uploadOptions);

        return {
          url: result.url,
          publicId: result.public_id,
          format: result.format,
          size: result.size,
          width: result.width,
          height: result.height,
          fileType,
          description:
            descriptions && descriptions[index] ? descriptions[index] : null,
          originalName: file.originalname,
          mimetype: file.mimetype,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      return sendSuccessResponse(res, 201, "Files uploaded successfully", {
        files: uploadedFiles,
        count: uploadedFiles.length,
      });
    } catch (error) {
      console.error("Upload multiple files error:", error);
      return sendErrorResponse(
        res,
        500,
        error.message || "Failed to upload files"
      );
    }
  }

  /**
   * Delete file from Cloudinary
   * DELETE /api/v1/upload/deleteFile
   */
  async deleteFile(req, res) {
    try {
      const { publicId } = req.body;

      if (!publicId) {
        return sendErrorResponse(res, 400, "Public ID is required");
      }

      const result = await deleteFromCloudinary(publicId);

      if (result.success) {
        return sendSuccessResponse(res, 200, "File deleted successfully");
      } else {
        return sendErrorResponse(res, 400, "Failed to delete file");
      }
    } catch (error) {
      console.error("Delete file error:", error);
      return sendErrorResponse(res, 500, "Failed to delete file");
    }
  }

  /**
   * Get upload configuration
   * GET /api/v1/upload/getUploadConfig
   */
  async getUploadConfig(req, res) {
    try {
      const config = {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileTypes: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maxFilesPerUpload: 10,
        supportedFileTypes: {
          avatar: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          document: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          cv: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          coverLetter: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          schoolLogo: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          schoolPhoto: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          prospectus: ["application/pdf"],
        },
      };

      return sendSuccessResponse(
        res,
        200,
        "Upload configuration retrieved successfully",
        {
          config,
        }
      );
    } catch (error) {
      console.error("Get upload config error:", error);
      return sendErrorResponse(res, 500, "Failed to get upload configuration");
    }
  }

  /**
   * Helper method to determine folder based on file type
   * @param {string} fileType - Type of file being uploaded
   * @returns {string} - Folder path
   */
  getFolderByFileType(fileType) {
    const folderMap = {
      avatar: "avatars",
      document: "documents",
      cv: "cvs",
      coverLetter: "cover-letters",
      schoolLogo: "school-logos",
      schoolPhoto: "school-photos",
      prospectus: "prospectuses",
      documents: "documents",
      schoolPhotos: "school-photos",
    };

    return folderMap[fileType] || "misc";
  }
}

module.exports = new UploadController();
