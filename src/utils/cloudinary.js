const { cloudinary } = require("../config/cloudinary");

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - The file buffer to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder to upload to
 * @param {string} options.public_id - Public ID for the file
 * @param {boolean} options.overwrite - Whether to overwrite existing file
 * @param {string} options.resource_type - Resource type (image, raw, video, auto)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      folder = "site-assets",
      public_id,
      overwrite = true,
      resource_type = "image",
      transformation,
    } = options;

    const uploadOptions = {
      folder,
      overwrite,
      resource_type,
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    if (transformation) {
      uploadOptions.transformation = transformation;
    }

    // Use upload_stream for buffer uploads
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    const { Readable } = require("stream");
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file to delete
 * @param {Object} options - Delete options
 * @param {string} options.resource_type - Resource type (image, raw, video)
 * @returns {Promise<Object>} - Cloudinary delete result
 */
const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    const { resource_type = "image" } = options;

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
    });

    return {
      success: result.result === "ok",
      result,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

/**
 * Upload a base64 encoded file to Cloudinary
 * @param {string} base64String - The base64 encoded file
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadBase64ToCloudinary = async (base64String, options = {}) => {
  try {
    const {
      folder = "site-assets",
      public_id,
      overwrite = true,
      resource_type = "image",
    } = options;

    const uploadOptions = {
      folder,
      overwrite,
      resource_type,
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    const result = await cloudinary.uploader.upload(base64String, uploadOptions);
    return result;
  } catch (error) {
    console.error("Cloudinary base64 upload error:", error);
    throw error;
  }
};

/**
 * Get the public ID from a Cloudinary URL
 * @param {string} url - The Cloudinary URL
 * @returns {string|null} - The public ID or null if not found
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;

  try {
    // Extract public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Error extracting public ID:", error);
    return null;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadBase64ToCloudinary,
  getPublicIdFromUrl,
};
