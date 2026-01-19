const express = require("express");
const {
  createResource,
  updateResource,
  updateResourceStatus,
  getMyResources,
  deleteResource,
  searchResources,
  getAllResourcesMainPage,
  getResourceById,
  getResourceByIdAdmin,
} = require("../controllers/resourceController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

//  Create Resource
router.post("/create-resource", authenticateToken, createResource);

// Update Resource
router.put("/update-resource/:id", authenticateToken, updateResource);

// Update status
router.patch(
  "/update-status/:resourceId",
  authenticateToken,
  updateResourceStatus
);

// Resource page
router.get("/my-resource-page", authenticateToken, getMyResources);

router.delete(
  "/delete-resource/:resourceId",
  authenticateToken,
  deleteResource
);

// Public Search Endpoint
router.get("/search-resource", searchResources);

router.get("/get-all-resources", getAllResourcesMainPage);

router.get("/get-resource-by-id/:id", getResourceById);

router.get(
  "/get-resource-by-id-admin/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  getResourceByIdAdmin
); // adding comment to push

module.exports = router;
