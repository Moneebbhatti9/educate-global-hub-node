const mongoose = require("mongoose");

/**
 * DropdownOption Model
 * Stores all dynamic dropdown options for the application
 * Supports categories, parent-child relationships, and ordering
 */
const dropdownOptionSchema = new mongoose.Schema(
  {
    // Category/Group this option belongs to (e.g., "jobType", "educationLevel", "subject")
    category: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // The actual value stored in the database (e.g., "full_time", "primary")
    value: {
      type: String,
      required: true,
      trim: true,
    },

    // Display label shown to users (e.g., "Full-time", "Primary (Grades 1-6)")
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional description or help text
    description: {
      type: String,
      default: null,
      trim: true,
    },

    // Parent option ID for hierarchical dropdowns (e.g., subcategory -> category)
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DropdownOption",
      default: null,
      index: true,
    },

    // Parent category for filtering children (e.g., "positionCategory" for subcategories)
    parentCategory: {
      type: String,
      default: null,
      index: true,
    },

    // Parent value for filtering children (e.g., "Teaching" for teaching subcategories)
    parentValue: {
      type: String,
      default: null,
      index: true,
    },

    // Sort order within the category
    sortOrder: {
      type: Number,
      default: 0,
    },

    // Whether this option is currently active/visible
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Icon or emoji for the option (optional)
    icon: {
      type: String,
      default: null,
    },

    // Color code for the option (optional, for badges/tags)
    color: {
      type: String,
      default: null,
    },

    // Additional metadata as needed
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Who created this option
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Who last updated this option
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
dropdownOptionSchema.index({ category: 1, isActive: 1, sortOrder: 1 });
dropdownOptionSchema.index({ category: 1, value: 1 }, { unique: true });
dropdownOptionSchema.index({ parentCategory: 1, parentValue: 1, isActive: 1 });

/**
 * Get all options for a category
 */
dropdownOptionSchema.statics.getByCategory = async function (category, includeInactive = false) {
  const query = { category };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).sort({ sortOrder: 1, label: 1 }).lean();
};

/**
 * Get child options for a parent
 */
dropdownOptionSchema.statics.getChildren = async function (parentCategory, parentValue, includeInactive = false) {
  const query = { parentCategory, parentValue };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).sort({ sortOrder: 1, label: 1 }).lean();
};

/**
 * Get multiple categories at once
 */
dropdownOptionSchema.statics.getMultipleCategories = async function (categories, includeInactive = false) {
  const query = { category: { $in: categories } };
  if (!includeInactive) {
    query.isActive = true;
  }

  const options = await this.find(query).sort({ category: 1, sortOrder: 1, label: 1 }).lean();

  // Group by category
  const grouped = {};
  categories.forEach(cat => {
    grouped[cat] = [];
  });

  options.forEach(opt => {
    if (grouped[opt.category]) {
      grouped[opt.category].push(opt);
    }
  });

  return grouped;
};

/**
 * Get all categories (distinct)
 */
dropdownOptionSchema.statics.getAllCategories = async function () {
  return this.distinct("category");
};

/**
 * Bulk create options for a category
 */
dropdownOptionSchema.statics.bulkCreateForCategory = async function (category, options, createdBy = null) {
  const docs = options.map((opt, index) => ({
    category,
    value: opt.value,
    label: opt.label,
    description: opt.description || null,
    parentId: opt.parentId || null,
    parentCategory: opt.parentCategory || null,
    parentValue: opt.parentValue || null,
    sortOrder: opt.sortOrder !== undefined ? opt.sortOrder : index,
    isActive: opt.isActive !== undefined ? opt.isActive : true,
    icon: opt.icon || null,
    color: opt.color || null,
    metadata: opt.metadata || {},
    createdBy,
  }));

  return this.insertMany(docs, { ordered: false });
};

/**
 * Update sort order for multiple options
 */
dropdownOptionSchema.statics.updateSortOrder = async function (updates) {
  const bulkOps = updates.map(({ id, sortOrder }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { sortOrder } },
    },
  }));
  return this.bulkWrite(bulkOps);
};

module.exports = mongoose.model("DropdownOption", dropdownOptionSchema);
