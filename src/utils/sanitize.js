/**
 * Utility functions for sanitizing data before sending to frontend
 */

/**
 * Sanitize a Mongoose document by converting it to a plain object
 * and removing internal Mongoose metadata
 * @param {Object} doc - Mongoose document or object
 * @returns {Object} Clean plain JavaScript object
 */
const sanitizeDocument = (doc) => {
  if (!doc) return null;

  // If it's already a plain object, return as is
  if (doc.toObject && typeof doc.toObject === "function") {
    return doc.toObject();
  }

  // If it's a Mongoose document, convert to plain object
  if (doc._doc) {
    return { ...doc._doc };
  }

  // If it's a plain object, return a clean copy
  return { ...doc };
};

/**
 * Sanitize an array of documents
 * @param {Array} docs - Array of Mongoose documents or objects
 * @returns {Array} Array of clean plain JavaScript objects
 */
const sanitizeDocuments = (docs) => {
  if (!Array.isArray(docs)) return [];
  return docs.map((doc) => sanitizeDocument(doc));
};

/**
 * Remove sensitive fields from an object
 * @param {Object} obj - Object to clean
 * @param {Array} sensitiveFields - Array of field names to remove
 * @returns {Object} Cleaned object
 */
const removeSensitiveFields = (obj, sensitiveFields = []) => {
  if (!obj || typeof obj !== "object") return obj;

  const cleaned = { ...obj };
  sensitiveFields.forEach((field) => {
    delete cleaned[field];
  });

  return cleaned;
};

/**
 * Ensure all array fields are arrays (not undefined/null)
 * @param {Object} obj - Object to process
 * @param {Array} arrayFields - Array of field names that should be arrays
 * @returns {Object} Object with guaranteed array fields
 */
const ensureArrayFields = (obj, arrayFields = []) => {
  if (!obj || typeof obj !== "object") return obj;

  const processed = { ...obj };
  arrayFields.forEach((field) => {
    if (!Array.isArray(processed[field])) {
      processed[field] = [];
    }
  });

  return processed;
};

module.exports = {
  sanitizeDocument,
  sanitizeDocuments,
  removeSensitiveFields,
  ensureArrayFields,
};
