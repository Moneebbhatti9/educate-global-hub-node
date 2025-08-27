const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// File upload configuration
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = process.env.ALLOWED_FILE_TYPES?.split(',') || [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'educate-global-hub',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' }, // Limit image dimensions
      { quality: 'auto:good' } // Optimize quality
    ]
  }
});

// Configure local storage (fallback)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: cloudinaryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Maximum 5 files per request
  }
});

// Create local upload instance (fallback)
const localUpload = multer({
  storage: localStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5
  }
});

/**
 * Upload single file
 */
const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

/**
 * Upload multiple files
 */
const uploadMultiple = (fieldName, maxCount = 5) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Upload multiple files with different field names
 */
const uploadFields = (fields) => {
  return upload.fields(fields);
};

/**
 * Upload to Cloudinary directly
 * @param {Buffer|string} file - File buffer or file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary response
 */
const uploadToCloudinary = async (file, options = {}) => {
  try {
    const uploadOptions = {
      folder: 'educate-global-hub',
      resource_type: 'auto',
      ...options
    };

    let result;
    if (Buffer.isBuffer(file)) {
      // Upload from buffer
      result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(file);
      });
    } else {
      // Upload from file path
      result = await cloudinary.uploader.upload(file, uploadOptions);
    }

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to Cloudinary');
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      message: result.result
    };
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

/**
 * Generate Cloudinary URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Transformation options
 * @returns {string} - Transformed URL
 */
const generateCloudinaryUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...transformations
  });
};

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @returns {boolean} - True if file size is valid
 */
const isValidFileSize = (size) => {
  return size <= MAX_FILE_SIZE;
};

/**
 * Get file extension from mimetype
 * @param {string} mimetype - File mimetype
 * @returns {string} - File extension
 */
const getFileExtension = (mimetype) => {
  const extensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  };
  return extensions[mimetype] || '';
};

module.exports = {
  upload,
  localUpload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadToCloudinary,
  deleteFromCloudinary,
  generateCloudinaryUrl,
  isValidFileSize,
  getFileExtension,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES
};
