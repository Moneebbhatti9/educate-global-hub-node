const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload image
const uploadImage = async (file, folder = "educate-hub") => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: "auto",
      transformation: [
        { width: 800, height: 800, crop: "limit" },
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
    });

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to delete image
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to upload avatar
const uploadAvatar = async (file, userId) => {
  const folder = `educate-hub/avatars/${userId}`;
  return await uploadImage(file, folder);
};

// Helper function to upload document
const uploadDocument = async (file, userId, documentType) => {
  const folder = `educate-hub/documents/${userId}/${documentType}`;
  return await uploadImage(file, folder);
};

// Helper function to generate signed upload preset
const generateUploadPreset = (folder = "educate-hub") => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      timestamp,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  } catch (error) {
    console.error("Error generating upload preset:", error);
    return null;
  }
};

// Helper function to generate a signed download URL
const generateSignedDownloadUrl = (publicId, options = {}) => {
  try {
    const {
      resourceType = "image",
      format = "",
      expiresIn = 3600, // 1 hour default
    } = options;

    // Generate signed URL with expiration
    const timestamp = Math.round(Date.now() / 1000);
    const expiresAt = timestamp + expiresIn;

    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "upload",
      sign_url: true,
      secure: true,
      format: format,
    });
  } catch (error) {
    console.error("Error generating signed download URL:", error);
    return null;
  }
};

// Helper function to verify Cloudinary credentials
const verifyCredentials = async () => {
  try {
    // Try to ping the API
    const result = await cloudinary.api.ping();
    return { success: true, status: result.status };
  } catch (error) {
    console.error("Cloudinary credentials verification failed:", error);
    return { success: false, error: error.message };
  }
};

// Helper function to get resource details
const getResourceDetails = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting resource details:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  uploadAvatar,
  uploadDocument,
  generateUploadPreset,
  generateSignedDownloadUrl,
  verifyCredentials,
  getResourceDetails,
};
