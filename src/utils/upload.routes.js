const express = require("express");
const router = express.Router();

// Import controller
const uploadController = require("./upload.controller");

// Import validation schemas and middleware
const {
  uploadSchema,
  multipleUploadSchema,
  validateUploadRequest,
} = require("./upload.validation");

// Import file upload middleware
const { uploadSingle, uploadMultiple } = require("./fileUpload.util");

// Import authentication middleware
const { authenticateToken } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadRequest:
 *       type: object
 *       required:
 *         - fileType
 *       properties:
 *         fileType:
 *           type: string
 *           enum: [avatar, document, cv, coverLetter, schoolLogo, schoolPhoto, prospectus]
 *         description:
 *           type: string
 *           maxLength: 200
 *     MultipleUploadRequest:
 *       type: object
 *       required:
 *         - fileType
 *       properties:
 *         fileType:
 *           type: string
 *           enum: [documents, schoolPhotos]
 *         descriptions:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 200
 *     UploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             file:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                 publicId:
 *                   type: string
 *                 format:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 width:
 *                   type: integer
 *                 height:
 *                   type: integer
 *                 fileType:
 *                   type: string
 *                 description:
 *                   type: string
 *                 originalName:
 *                   type: string
 *                 mimetype:
 *                   type: string
 */

/**
 * @swagger
 * /api/v1/upload/uploadFile:
 *   post:
 *     summary: Upload a single file to Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - fileType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               fileType:
 *                 type: string
 *                 enum: [avatar, document, cv, coverLetter, schoolLogo, schoolPhoto, prospectus]
 *               description:
 *                 type: string
 *                 maxLength: 200
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: Validation error or file upload error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/uploadFile",
  authenticateToken,
  uploadSingle("file"),
  validateUploadRequest(uploadSchema),
  uploadController.uploadFile
);

/**
 * @swagger
 * /api/v1/upload/uploadMultipleFiles:
 *   post:
 *     summary: Upload multiple files to Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *               - fileType
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               fileType:
 *                 type: string
 *                 enum: [documents, schoolPhotos]
 *               descriptions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 200
 *     responses:
 *       201:
 *         description: Files uploaded successfully
 *       400:
 *         description: Validation error or file upload error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/uploadMultipleFiles",
  authenticateToken,
  uploadMultiple("files", 10),
  validateUploadRequest(multipleUploadSchema),
  uploadController.uploadMultipleFiles
);

/**
 * @swagger
 * /api/v1/upload/deleteFile:
 *   delete:
 *     summary: Delete a file from Cloudinary
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicId
 *             properties:
 *               publicId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Public ID is required or deletion failed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/deleteFile", authenticateToken, uploadController.deleteFile);

/**
 * @swagger
 * /api/v1/upload/getUploadConfig:
 *   get:
 *     summary: Get upload configuration and supported file types
 *     tags: [Upload]
 *     responses:
 *       200:
 *         description: Upload configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       type: object
 *                       properties:
 *                         maxFileSize:
 *                           type: integer
 *                         allowedFileTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         maxFilesPerUpload:
 *                           type: integer
 *                         supportedFileTypes:
 *                           type: object
 *       500:
 *         description: Server error
 */
router.get("/getUploadConfig", uploadController.getUploadConfig);

module.exports = router;
