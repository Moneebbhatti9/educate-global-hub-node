const mongoose = require("mongoose");
const resource = require("../models/resource");
const resourcePurchase = require("../models/resourcePurchase");
const User = require("../models/User");
const { errorResponse, successResponse } = require("../utils/response");
const { sendResourceStatusUpdateEmail } = require("../config/email");

exports.createResource = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const {
      title,
      description,
      resourceType,
      visibility,
      isFree,
      price,
      currency,
      saveAsDraft,
      ageRange,
      curriculum,
      curriculumType,
      subject,
      coverPhotoUrl,
      previewImageUrls,
      mainFileUrl,
    } = req.body;

    // ---- validation ----
    if (
      !title ||
      !description ||
      !resourceType ||
      !ageRange ||
      !curriculum ||
      !curriculumType ||
      !subject
    ) {
      return errorResponse(
        res,
        "Missing required fields (title, description, resourceType, ageRange, curriculum, curriculumType, subject)",
        400
      );
    }

    // Validate file URLs from frontend uploads
    if (!coverPhotoUrl) {
      return errorResponse(res, "Cover photo URL is required", 400);
    }
    if (!mainFileUrl) {
      return errorResponse(res, "Main file URL is required", 400);
    }
    if (
      !previewImageUrls ||
      !Array.isArray(previewImageUrls) ||
      previewImageUrls.length === 0
    ) {
      return errorResponse(
        res,
        "At least one preview image URL is required",
        400
      );
    }

    // price/currency logic for non-free resources
    const freeFlag = String(isFree).toLowerCase() === "true" || isFree === true;
    if (!freeFlag) {
      if (price === undefined || price === null || price === "") {
        return errorResponse(res, "Price is required for paid resources", 400);
      }
      if (!currency) {
        return errorResponse(
          res,
          "Currency is required for paid resources",
          400
        );
      }
    }
    const saveAsDraftFlag = saveAsDraft === true || saveAsDraft === "true";

    let resourceStatus = "pending"; // default publish → pending
    if (saveAsDraftFlag == true) {
      resourceStatus = "draft";
    }

    // ---- create resource with direct URLs ----
    const createdResource = await resource.create({
      title: title.trim(),
      description: description.trim(),
      type: resourceType,
      isFree: freeFlag,
      currency: freeFlag ? currency || null : currency,
      price: freeFlag ? 0 : Number(price || 0),
      publishing: visibility || "public",
      createdBy: { userId, role: userRole },
      status: resourceStatus,
      ageRange,
      curriculum,
      curriculumType,
      subject,
      coverPhoto: coverPhotoUrl,
      previewImages: previewImageUrls,
      mainFile: mainFileUrl,
    });

    // populate user info for response
    const populatedResource = await resource
      .findById(createdResource._id)
      .populate("createdBy.userId", "firstName lastName email");

    return successResponse(
      res,
      populatedResource,
      "resource created successfully"
    );
  } catch (err) {
    console.error("createResource error:", err);
    return errorResponse(res, "Failed to create resource", 500, err);
  }
};

// Update resource
exports.updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const resourceDoc = await resource.findById(id);
    if (!resourceDoc || resourceDoc.isDeleted) {
      return errorResponse(res, "resource not found", 404);
    }

    // Authorization: only owner or admin can update
    if (!resourceDoc.createdBy.userId.equals(userId) && userRole !== "admin") {
      return errorResponse(res, "Not authorized to update this resource", 403);
    }

    const {
      title,
      description,
      type,
      publishing,
      isFree,
      price,
      currency,
      ageRange,
      curriculum,
      curriculumType,
      subject,
      coverPhotoUrl,
      previewImageUrls,
      mainFileUrl,
    } = req.body;

    // Apply updates only if provided
    if (title) resourceDoc.title = title;
    if (description) resourceDoc.description = description;
    if (type) resourceDoc.type = type;
    if (publishing) resourceDoc.publishing = publishing;
    if (ageRange) resourceDoc.ageRange = ageRange;
    if (curriculum) resourceDoc.curriculum = curriculum;
    if (curriculumType) resourceDoc.curriculumType = curriculumType;
    if (subject) resourceDoc.subject = subject;

    // Convert string boolean to actual boolean
    const isFreeBoolean = String(isFree).toLowerCase() === "true";
    resourceDoc.isFree = isFreeBoolean;
    resourceDoc.price = isFreeBoolean ? 0 : price || resourceDoc.price;

    if (isFreeBoolean) {
      resourceDoc.currency = null;
    } else {
      resourceDoc.currency = currency || resourceDoc.currency;
    }

    // Update file URLs if provided
    if (coverPhotoUrl) {
      resourceDoc.coverPhoto = coverPhotoUrl;
    }

    if (previewImageUrls && Array.isArray(previewImageUrls)) {
      resourceDoc.previewImages = previewImageUrls;
    }

    if (mainFileUrl) {
      resourceDoc.mainFile = mainFileUrl;
    }

    // Status handling
    if (userRole === "admin") {
      // Admin can keep status as is or approve directly
      if (
        req.body.status &&
        ["approved", "rejected", "pending"].includes(req.body.status)
      ) {
        resourceDoc.status = req.body.status;
        if (req.body.status === "approved") {
          resourceDoc.approvedBy = userId;
        }
      }
    } else {
      // Any user update puts resource back to pending
      resourceDoc.status = "pending";
      resourceDoc.approvedBy = null;
    }

    await resourceDoc.save();

    return successResponse(
      res,
      { resource: resourceDoc },
      "resource updated successfully"
    );
  } catch (err) {
    console.error("updateResource error:", err);
    return errorResponse(res, "Failed to update resource", 500);
  }
};

exports.updateResourceStatus = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    // validate input
    if (
      !status ||
      !["draft", "pending", "approved", "rejected"].includes(status)
    ) {
      return errorResponse(res, "Invalid status value", 400);
    }

    const resourceDoc = await resource
      .findById(resourceId)
      .populate("createdBy.userId", "email firstName lastName");

    if (!resourceDoc || resourceDoc.isDeleted) {
      return errorResponse(res, "Resource not found", 404);
    }
    // User (non-admin) rules
    if (userRole != "admin") {
      if (status != "pending") {
        return errorResponse(res, "You can only set status to pending", 403);
      }

      if (resourceDoc.createdBy.userId._id.toString() != userId.toString()) {
        return errorResponse(
          res,
          "Not authorized to update this resource",
          403
        );
      }
      if (resourceDoc.status != "draft") {
        return errorResponse(res, "Only draft resources can be submitted", 400);
      }

      resourceDoc.status = "pending";
      resourceDoc.approvedBy = null; // reset approval
    } else {
      // Admin rules
      if (!["approved", "rejected", "pending"].includes(status)) {
        return errorResponse(
          res,
          "Admin can only set status to approved, rejected, or pending",
          400
        );
      }

      resourceDoc.status = status;
      resourceDoc.approvedBy = status === "approved" ? userId : null;
    }

    await resourceDoc.save();
    if (resourceDoc.createdBy?.userId?.email) {
      await sendResourceStatusUpdateEmail(
        resourceDoc.createdBy.userId.email,
        resourceDoc.createdBy.userId.firstName,
        resourceDoc.title,
        status
      );
    }
    return successResponse(
      res,
      {
        resource: resourceDoc,
      },
      "Resource status updated successfully"
    );
  } catch (err) {
    console.error("updateResourceStatus error:", err);
    return errorResponse(res, "Failed to update resource status", 500);
  }
};

exports.getMyResources = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search, status, page = 1, limit = 10 } = req.query;

    // base query for user's resources
    let query = { "createdBy.userId": userId, isDeleted: false };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // --- Resources ---
    const resources = await resource
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalResources = await resource.countDocuments({
      "createdBy.userId": userId,
      isDeleted: false,
    });

    // --- Sales + Earnings ---
    const salesStats = await resourcePurchase.aggregate([
      // Match purchases of resources owned by this user
      {
        $lookup: {
          from: "resources",
          localField: "resourceId",
          foreignField: "_id",
          as: "resource",
        },
      },
      { $unwind: "$resource" },
      { $match: { "resource.createdBy.userId": userId } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: 1 }, // each purchase = 1 unit
          totalEarnings: { $sum: "$pricePaid" },
        },
      },
    ]);

    const totalSales = salesStats[0]?.totalUnits || 0;
    const totalEarnings = salesStats[0]?.totalEarnings || 0;

    // --- User Wallet Info ---
    const stats = {
      totalResources,
      totalSales,
      currentBalance: totalEarnings, // Using total earnings as current balance
    };

    return successResponse(
      res,
      {
        stats,
        resources,
      },
      "My resources retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching resources:", error);
    return errorResponse(res, "Failed to fetch my resources", 500);
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const foundResource = await resource.findById(resourceId);
    if (!foundResource) {
      return errorResponse(res, "Resource not found", 404);
    }

    // Only owner or admin can delete
    if (
      foundResource.createdBy.userId.toString() !== userId.toString() &&
      userRole !== "admin"
    ) {
      return errorResponse(
        res,
        "You are not authorized to delete this resource",
        403
      );
    }

    // Soft delete
    foundResource.isDeleted = true;
    await foundResource.save();

    // (Optional) Hard delete related files if needed
    // await ResourceFile.deleteMany({ resourceId });

    return successResponse(res, null, "Resource deleted successfully", 200);
  } catch (error) {
    console.error("Delete Resource Error:", error);
    return errorResponse(
      res,
      "Server error while deleting resource",
      500,
      error.message
    );
  }
};

exports.searchResources = async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;

    if (!q || q.trim() === "") {
      return errorResponse(res, "Search query is required", 400);
    }

    const regex = new RegExp(q, "i"); // case-insensitive

    const filter = {
      $or: [
        { title: regex },
        { description: regex },
        { curriculum: regex },
        { subject: regex },
        { ageRange: regex },
      ],
    };

    const resources = await resource
      .find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return successResponse(res, resources, "Resources fetched successfully");
  } catch (error) {
    console.error("Search Resources Error:", error);
    return errorResponse(res, "Failed to search resources");
  }
};

exports.getResourceStatsAdmin = async (req, res) => {
  try {
    const totalResources = await resource.countDocuments({ isDeleted: false });
    const pendingApprovals = await resource.countDocuments({
      status: "pending",
      isDeleted: false,
    });
    // flagged resources will be added later
    const totalSalesAgg = await resourcePurchase.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$pricePaid" } } },
    ]);

    const totalSales = totalSalesAgg.length > 0 ? totalSalesAgg[0].total : 0;

    return successResponse(
      res,
      {
        totalResources,
        pendingApprovals,
        flaggedResources: 0, // placeholder
        totalSales,
      },
      "Stats Fetched succesfully"
    );
  } catch (err) {
    console.error("getResourceStats error:", err);
    return errorResponse(res, "Failed to fetch resource stats", 500);
  }
};

exports.getAllResourcesAdmin = async (req, res) => {
  try {
    const { q, status, subject, page = 1, limit = 10 } = req.query;

    const filter = { isDeleted: false };

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (subject && subject !== "all") {
      filter.subject = subject;
    }

    const resources = await resource
      .find(filter)
      .populate({
        path: "createdBy.userId",
        select: "firstName lastName email role",
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const formattedResources = resources.map((r) => ({
      id: r._id,
      thumbnail: r.coverPhoto || null,
      title: r.title,
      author: r.createdBy?.userId
        ? `${r.createdBy.userId.firstName} ${r.createdBy.userId.lastName}`
        : "Unknown",
      price: r.isFree ? "Free" : `${r.currency} ${r.price}`,
      status: r.status,
      flags: 0, // placeholder
      uploadDate: r.createdAt,
    }));

    const total = await resource.countDocuments(filter);

    return successResponse(
      res,
      {
        resources: formattedResources,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        },
      },
      "All resources Fetched succesfully"
    );
  } catch (err) {
    console.error("getAllResources error:", err);
    return errorResponse(res, "Failed to fetch resources", 500);
  }
};

exports.getAllResourcesMainPage = async (req, res) => {
  try {
    const { q, status, subject, page = 1, limit = 10 } = req.query;

    const filter = { isDeleted: false, status: "approved" };

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    if (subject && subject !== "all") {
      filter.subject = subject;
    }

    const resources = await resource
      .find(filter)
      .populate({
        path: "createdBy.userId",
        select: "firstName lastName email role",
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const formattedResources = resources.map((r) => ({
      id: r._id,
      thumbnail: r.coverPhoto || null,
      title: r.title,
      author: r.createdBy?.userId
        ? `${r.createdBy.userId.firstName} ${r.createdBy.userId.lastName}`
        : "Unknown",
      price: r.isFree ? "Free" : `${r.currency} ${r.price}`,
      status: r.status,
      flags: 0, // placeholder
      uploadDate: r.createdAt,
    }));

    const total = await resource.countDocuments(filter);

    return successResponse(
      res,
      {
        resources: formattedResources,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        },
      },
      "All resources fetched "
    );
  } catch (err) {
    console.error("getAllResources error:", err);
    return errorResponse(res, "Failed to fetch resources", 500);
  }
};

exports.getResourceById = async (req, res) => {
  try {
    const { id } = req.params;

    const resourceDoc = await resource
      .findOne({ _id: id, isDeleted: false })
      .populate({
        path: "createdBy.userId",
        select: "firstName lastName email role",
      });

    if (!resourceDoc) {
      return errorResponse(res, "Resource not found", 404);
    }

    // For public API (unauthenticated users), don't expose drafts/pending
    if (!req.user && resourceDoc.status !== "approved") {
      return errorResponse(res, "Resource not available", 403);
    }

    const formattedResource = {
      id: resourceDoc._id,
      title: resourceDoc.title,
      description: resourceDoc.description,
      subject: resourceDoc.subject,
      ageRange: resourceDoc.ageRange,
      curriculum: resourceDoc.curriculum,
      curriculumType: resourceDoc.curriculumType,
      price: resourceDoc.isFree
        ? "Free"
        : `${resourceDoc.currency} ${resourceDoc.price}`,
      status: resourceDoc.status,
      thumbnail: resourceDoc.coverPhoto || null,
      previews: resourceDoc.previewImages || [],
      file: resourceDoc.mainFile || null,
      author: resourceDoc.createdBy?.userId
        ? `${resourceDoc.createdBy.userId.firstName} ${resourceDoc.createdBy.userId.lastName}`
        : "Unknown",
      createdAt: resourceDoc.createdAt,
    };

    return successResponse(
      res,
      formattedResource,
      "Resource fetched successfully!"
    );
  } catch (err) {
    console.error("getResourceById error:", err);
    return errorResponse(res, "Failed to fetch resource", 500);
  }
};

// Admin: Get Resource by ID
exports.getResourceByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const resourceDoc = await resource
      .findOne({ _id: id, isDeleted: false }) // exclude only deleted
      .populate({
        path: "createdBy.userId",
        select: "firstName lastName email role",
      });

    if (!resourceDoc) {
      return errorResponse(res, "Resource not found", 404);
    }
    // commit
    const formattedResource = {
      id: resourceDoc._id,
      title: resourceDoc.title,
      description: resourceDoc.description,
      subject: resourceDoc.subject,
      ageRange: resourceDoc.ageRange,
      curriculum: resourceDoc.curriculum,
      curriculumType: resourceDoc.curriculumType,
      price: resourceDoc.isFree
        ? "Free"
        : `${resourceDoc.currency} ${resourceDoc.price}`,
      status: resourceDoc.status,
      thumbnail: resourceDoc.coverPhoto || null,
      previews: resourceDoc.previewImages || [],
      file: resourceDoc.mainFile || null,
      author: resourceDoc.createdBy?.userId
        ? `${resourceDoc.createdBy.userId.firstName} ${resourceDoc.createdBy.userId.lastName}`
        : "Unknown",
      createdAt: resourceDoc.createdAt,
    };

    return successResponse(
      res,
      formattedResource,
      "Admin: Resource fetched successfully!"
    );
  } catch (err) {
    console.error("getResourceByIdAdmin error:", err);
    return errorResponse(res, "Failed to fetch resource", 500);
  }
};
