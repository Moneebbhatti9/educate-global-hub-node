const express = require("express");
const router = express.Router();
const dropdownController = require("../controllers/dropdownController");
const {  authenticateToken, authorizeRoles } = require("../middleware/auth");

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   GET /api/v1/dropdowns/categories
 * @desc    Get all available dropdown categories
 * @access  Public
 */
router.get("/categories", dropdownController.getAllCategories);

/**
 * @route   POST /api/v1/dropdowns/bulk
 * @desc    Get multiple categories at once
 * @access  Public
 * @body    { categories: ["jobType", "educationLevel"], includeInactive: false }
 */
router.post("/bulk", dropdownController.getMultipleCategories);

/**
 * @route   GET /api/v1/dropdowns/:category
 * @desc    Get all options for a specific category
 * @access  Public
 * @query   includeInactive - Include inactive options (default: false)
 */
router.get("/:category", dropdownController.getByCategory);

/**
 * @route   GET /api/v1/dropdowns/:parentCategory/children/:parentValue
 * @desc    Get child options for a parent category/value
 * @access  Public
 * @query   includeInactive - Include inactive options (default: false)
 */
router.get("/:parentCategory/children/:parentValue", dropdownController.getChildren);

// ============================================
// ADMIN ROUTES (Authentication required)
// ============================================

router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

/**
 * @route   GET /api/v1/dropdowns/admin/all
 * @desc    Get all options with pagination for admin management
 * @access  Admin only
 * @query   page, limit, category, search, isActive, sortBy, sortOrder
 */
router.get(
  "/admin/all",
  dropdownController.getAllOptionsAdmin
);

/**
 * @route   POST /api/v1/dropdowns
 * @desc    Create a new dropdown option
 * @access  Admin only
 */
router.post(
  "/",
  dropdownController.createOption
);

/**
 * @route   POST /api/v1/dropdowns/bulk-create
 * @desc    Bulk create options for a category
 * @access  Admin only
 * @body    { category: "jobType", options: [{ value: "x", label: "X" }] }
 */
router.post(
  "/bulk-create",
  dropdownController.bulkCreateOptions
);

/**
 * @route   PUT /api/v1/dropdowns/sort-order
 * @desc    Update sort order for multiple options
 * @access  Admin only
 * @body    { updates: [{ id: "...", sortOrder: 0 }] }
 */
router.put(
  "/sort-order",
  dropdownController.updateSortOrder
);

/**
 * @route   PUT /api/v1/dropdowns/:id
 * @desc    Update a dropdown option
 * @access  Admin only
 */
router.put(
  "/:id",
  dropdownController.updateOption
);

/**
 * @route   PATCH /api/v1/dropdowns/:id/toggle-active
 * @desc    Toggle option active status
 * @access  Admin only
 */
router.patch(
  "/:id/toggle-active",
  dropdownController.toggleActive
);

/**
 * @route   DELETE /api/v1/dropdowns/category/:category
 * @desc    Delete entire category
 * @access  Admin only
 * @query   confirm=true (required)
 */
router.delete(
  "/category/:category",
  dropdownController.deleteCategory
);

/**
 * @route   DELETE /api/v1/dropdowns/:id
 * @desc    Delete a dropdown option
 * @access  Admin only
 */
router.delete(
  "/:id",
  dropdownController.deleteOption
);

module.exports = router;
