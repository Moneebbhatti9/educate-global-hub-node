const express = require("express");
const multer = require("multer");
const { createResource, updateResource } = require("../controllers/resourceController");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

//  Multer setup (memory storage for cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "application/msword", // doc
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
      "application/vnd.ms-powerpoint", // ppt
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type"), false);
  },
});

//  Create Resource
router.post(
  "/create-resource",
  authenticateToken,
  upload.fields([
    { name: "banner", maxCount: 1 }, // cover photo
    { name: "previews", maxCount: 5 }, // preview images
    { name: "files", maxCount: 3 }, // main resource files
  ]),
  createResource
);
// Update Resource
router.put(
  "/:id",
  authenticateToken,
  upload.fields([
    { name: "coverPhoto", maxCount: 1 },
    { name: "previewImages", maxCount: 5 },
    { name: "mainFile", maxCount: 1 },
  ]),
  updateResource
);
module.exports = router;
