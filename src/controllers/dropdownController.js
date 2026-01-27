const DropdownOption = require("../models/DropdownOption");
const {
  successResponse,
  errorResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
} = require("../utils/response");

/**
 * Get all options for a single category
 * GET /api/v1/dropdowns/:category
 */
const getByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { includeInactive } = req.query;

    const options = await DropdownOption.getByCategory(
      category,
      includeInactive === "true"
    );

    return successResponse(res, options, `Options for ${category} retrieved successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get child options for a parent category/value
 * GET /api/v1/dropdowns/:parentCategory/children/:parentValue
 */
const getChildren = async (req, res, next) => {
  try {
    const { parentCategory, parentValue } = req.params;
    const { includeInactive } = req.query;

    const options = await DropdownOption.getChildren(
      parentCategory,
      parentValue,
      includeInactive === "true"
    );

    return successResponse(res, options, `Child options retrieved successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple categories at once
 * POST /api/v1/dropdowns/bulk
 */
const getMultipleCategories = async (req, res, next) => {
  try {
    const { categories, includeInactive } = req.body;

    if (!categories || !Array.isArray(categories)) {
      return errorResponse(res, "Categories array is required", 400);
    }

    const options = await DropdownOption.getMultipleCategories(
      categories,
      includeInactive === true
    );

    return successResponse(res, options, "Options retrieved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available categories
 * GET /api/v1/dropdowns/categories
 */
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await DropdownOption.getAllCategories();

    // Get count for each category
    const categoriesWithCount = await DropdownOption.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ["$isActive", 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalCount: "$count",
          activeCount: "$activeCount",
        },
      },
      { $sort: { category: 1 } },
    ]);

    return successResponse(res, categoriesWithCount, "Categories retrieved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new dropdown option
 * POST /api/v1/dropdowns
 */
const createOption = async (req, res, next) => {
  try {
    const {
      category,
      value,
      label,
      description,
      parentId,
      parentCategory,
      parentValue,
      sortOrder,
      isActive,
      icon,
      color,
      metadata,
    } = req.body;

    // Validate required fields
    if (!category || !value || !label) {
      return errorResponse(res, "Category, value, and label are required", 400);
    }

    // Check if option already exists
    const existing = await DropdownOption.findOne({ category, value });
    if (existing) {
      return errorResponse(res, `Option with value "${value}" already exists in category "${category}"`, 400);
    }

    // Get highest sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastOption = await DropdownOption.findOne({ category })
        .sort({ sortOrder: -1 })
        .select("sortOrder");
      finalSortOrder = lastOption ? lastOption.sortOrder + 1 : 0;
    }

    const option = await DropdownOption.create({
      category,
      value,
      label,
      description,
      parentId,
      parentCategory,
      parentValue,
      sortOrder: finalSortOrder,
      isActive: isActive !== undefined ? isActive : true,
      icon,
      color,
      metadata,
      createdBy: req.user?.userId,
    });

    return createdResponse(res, option, "Option created successfully");
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, "Option with this category and value already exists", 400);
    }
    next(error);
  }
};

/**
 * Update a dropdown option
 * PUT /api/v1/dropdowns/:id
 */
const updateOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.createdBy;

    // Add updatedBy
    updates.updatedBy = req.user?.userId;

    const option = await DropdownOption.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!option) {
      return notFoundResponse(res, "Option not found");
    }

    return successResponse(res, option, "Option updated successfully");
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, "Option with this category and value already exists", 400);
    }
    next(error);
  }
};

/**
 * Delete a dropdown option
 * DELETE /api/v1/dropdowns/:id
 */
const deleteOption = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if this option has children
    const hasChildren = await DropdownOption.findOne({ parentId: id });
    if (hasChildren) {
      return errorResponse(
        res,
        "Cannot delete option with children. Delete children first or reassign them.",
        400
      );
    }

    const option = await DropdownOption.findByIdAndDelete(id);

    if (!option) {
      return notFoundResponse(res, "Option not found");
    }

    return successResponse(res, { deletedId: id }, "Option deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk create options for a category
 * POST /api/v1/dropdowns/bulk-create
 */
const bulkCreateOptions = async (req, res, next) => {
  try {
    const { category, options } = req.body;

    if (!category || !options || !Array.isArray(options)) {
      return errorResponse(res, "Category and options array are required", 400);
    }

    // Validate each option
    for (const opt of options) {
      if (!opt.value || !opt.label) {
        return errorResponse(res, "Each option must have value and label", 400);
      }
    }

    const created = await DropdownOption.bulkCreateForCategory(
      category,
      options,
      req.user?.userId
    );

    return createdResponse(
      res,
      { insertedCount: created.length, options: created },
      `${created.length} options created successfully`
    );
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, "Some options already exist. Use upsert or update individual options.", 400);
    }
    next(error);
  }
};

/**
 * Update sort order for multiple options
 * PUT /api/v1/dropdowns/sort-order
 */
const updateSortOrder = async (req, res, next) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return errorResponse(res, "Updates array is required", 400);
    }

    await DropdownOption.updateSortOrder(updates);

    return successResponse(res, null, "Sort order updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle option active status
 * PATCH /api/v1/dropdowns/:id/toggle-active
 */
const toggleActive = async (req, res, next) => {
  try {
    const { id } = req.params;

    const option = await DropdownOption.findById(id);
    if (!option) {
      return notFoundResponse(res, "Option not found");
    }

    option.isActive = !option.isActive;
    option.updatedBy = req.user?.userId;
    await option.save();

    return successResponse(
      res,
      option,
      `Option ${option.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all options with pagination (for admin management)
 * GET /api/v1/dropdowns/admin/all
 */
const getAllOptionsAdmin = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      category,
      search,
      isActive,
      sortBy = "category",
      sortOrder = "asc",
    } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { label: { $regex: search, $options: "i" } },
        { value: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    if (sortBy !== "sortOrder") {
      sort.sortOrder = 1;
    }

    const total = await DropdownOption.countDocuments(query);
    const options = await DropdownOption.find(query)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .lean();

    return paginatedResponse(res, "Options retrieved successfully", {
      options,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete entire category
 * DELETE /api/v1/dropdowns/category/:category
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { confirm } = req.query;

    if (confirm !== "true") {
      return errorResponse(
        res,
        "Add ?confirm=true to confirm deletion of entire category",
        400
      );
    }

    const result = await DropdownOption.deleteMany({ category });

    return successResponse(
      res,
      { deletedCount: result.deletedCount },
      `Deleted ${result.deletedCount} options from category "${category}"`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getByCategory,
  getChildren,
  getMultipleCategories,
  getAllCategories,
  createOption,
  updateOption,
  deleteOption,
  bulkCreateOptions,
  updateSortOrder,
  toggleActive,
  getAllOptionsAdmin,
  deleteCategory,
};
