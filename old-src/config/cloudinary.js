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

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  uploadAvatar,
  uploadDocument,
  generateUploadPreset,
};
