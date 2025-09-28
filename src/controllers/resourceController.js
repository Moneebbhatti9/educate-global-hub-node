const mongoose = require("mongoose");
const { uploadImage, deleteImage } = require("../config/cloudinary");
const resource = require("../models/resource");
const resourceFile = require("../models/resourceFile");
const resourcePurchase = require("../models/resourcePurchase");
const User = require("../models/User");
const { errorResponse, successResponse } = require("../utils/response");

exports.createResource = async (req, res) => {
  // track created DB docs and uploaded publicIds for cleanup on failure
  const createdFileDocs = [];
  const uploadedPublicIds = [];
  let createdResource = null;

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

    // main file is mandatory per schema / UI
    if (!req.files?.files || req.files.files.length === 0) {
      return errorResponse(res, "At least one resource file is required", 400);
    }

    if (!req.files?.banner || req.files.banner.length === 0) {
      return errorResponse(res, "Banner image is required", 400);
    }
    if (!req.files?.previews || req.files.previews.length === 0) {
      return errorResponse(res, "At least one preview image is required", 400);
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

    let resourceStatus = "pending"; // default
    let approvedBy = null;

    if (saveAsDraft) {
      resourceStatus = "draft";
    }

    if (userRole === "admin") {
      resourceStatus = "approved";
      approvedBy = userId;
    }

    // Generate a temporary resource ID for file organization
    const tempResourceId = new mongoose.Types.ObjectId();

    // ---- upload banner and create ResourceFile doc (coverPhoto) ----
    const bannerFile = req.files.banner[0];
    const bannerResult = await uploadImage(
      `data:${bannerFile.mimetype};base64,${bannerFile.buffer.toString(
        "base64"
      )}`,
      `educate-hub/resources/${tempResourceId}/banner`
    );

    if (!bannerResult || !bannerResult.success) {
      throw new Error("Banner upload failed");
    }
    uploadedPublicIds.push(bannerResult.public_id);

    const bannerDoc = await resourceFile.create({
      resourceId: tempResourceId,
      fileType: "cover",
      url: bannerResult.url,
      publicId: bannerResult.public_id,
      format: bannerResult.format,
      size: bannerResult.bytes,
      uploadedBy: userId,
    });
    createdFileDocs.push(bannerDoc);

    // ---- upload previews and create ResourceFile docs ----
    const previewDocs = [];
    for (const f of req.files.previews) {
      const r = await uploadImage(
        `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
        `educate-hub/resources/${tempResourceId}/previews`
      );
      if (!r || !r.success) {
        throw new Error("Preview upload failed");
      }
      uploadedPublicIds.push(r.public_id);

      const pf = await resourceFile.create({
        resourceId: tempResourceId,
        fileType: "preview",
        url: r.url,
        publicId: r.public_id,
        format: r.format,
        size: r.bytes,
        uploadedBy: userId,
      });
      previewDocs.push(pf);
      createdFileDocs.push(pf);
    }

    // ---- upload main files and create ResourceFile docs ----
    const fileDocs = [];
    for (const f of req.files.files) {
      const r = await uploadImage(
        `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
        `educate-hub/resources/${tempResourceId}/files`
      );
      if (!r || !r.success) {
        throw new Error("resource file upload failed");
      }
      uploadedPublicIds.push(r.public_id);

      const fd = await resourceFile.create({
        resourceId: tempResourceId,
        fileType: "main",
        url: r.url,
        publicId: r.public_id,
        format: r.format,
        size: r.bytes,
        uploadedBy: userId,
      });
      fileDocs.push(fd);
      createdFileDocs.push(fd);
    }

    // ---- create resource with all file references ----
    createdResource = await resource.create({
      _id: tempResourceId,
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
      coverPhoto: bannerDoc._id,
      previewImages: previewDocs.map((d) => d._id),
      mainFile: fileDocs[0]._id, // mainFile is single id per schema
    });

    // Update the resourceFile documents with the actual resource ID
    await resourceFile.updateMany(
      { resourceId: tempResourceId },
      { resourceId: createdResource._id }
    );

    // populate file refs for response
    const populatedResource = await resource
      .findById(createdResource._id)
      .populate("coverPhoto")
      .populate("previewImages")
      .populate("mainFile")
      .populate("createdBy.userId", "firstName lastName email");

    return successResponse(
      res,
      populatedResource,
      "resource created successfully"
    );
  } catch (err) {
    // cleanup uploaded cloudinary files & DB file docs & resource (best-effort)
    try {
      // delete cloudinary images
      if (Array.isArray(uploadedPublicIds) && uploadedPublicIds.length) {
        await Promise.all(
          uploadedPublicIds.map((pid) => deleteImage(pid).catch(() => null))
        );
      }
      // delete created resourceFile docs
      if (Array.isArray(createdFileDocs) && createdFileDocs.length) {
        await Promise.all(
          createdFileDocs.map((d) =>
            resourceFile.findByIdAndDelete(d._id).catch(() => null)
          )
        );
      }
      // delete resource if created
      if (createdResource) {
        await resource.findByIdAndDelete(createdResource._id).catch(() => null);
      }
    } catch (cleanupErr) {
      console.error("Cleanup failed after createResource error:", cleanupErr);
    }

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

    const resource = await resource.findById(id);
    if (!resource || resource.isDeleted) {
      return errorResponse(res, "resource not found", 404);
    }

    // Authorization: only owner or admin can update
    if (!resource.createdBy.userId.equals(userId) && userRole !== "admin") {
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
    } = req.body;

    // Apply updates only if provided
    if (title) resource.title = title;
    if (description) resource.description = description;
    if (type) resource.type = type;
    if (publishing) resource.publishing = publishing;
    if (ageRange) resource.ageRange = ageRange;
    if (curriculum) resource.curriculum = curriculum;
    if (curriculumType) resource.curriculumType = curriculumType;
    if (subject) resource.subject = subject;

    if (typeof isFree !== "undefined") {
      resource.isFree = isFree;
      resource.price = isFree ? 0 : price || resource.price;
      resource.currency = isFree ? null : currency || resource.currency;
    }

    // Banner update (replace existing)
    if (req.files?.banner?.length > 0) {
      if (resource.coverPhoto) {
        const oldBanner = await resourceFile.findById(resource.coverPhoto);
        if (oldBanner) {
          await deleteImage(oldBanner.publicId);
          await oldBanner.deleteOne();
        }
      }

      const bannerFile = req.files.banner[0];
      const bannerUpload = await uploadImage(
        `data:${bannerFile.mimetype};base64,${bannerFile.buffer.toString(
          "base64"
        )}`,
        `educate-hub/resources/${userId}/banner`
      );

      if (!bannerUpload.success) {
        return errorResponse(res, "Failed to upload banner image", 500);
      }

      const bannerDoc = await resourceFile.create({
        url: bannerUpload.url,
        publicId: bannerUpload.public_id,
        format: bannerUpload.format,
        size: bannerUpload.bytes,
        uploadedBy: userId,
      });

      resource.coverPhoto = bannerDoc._id;
    }

    // Preview Images (append new ones, keep old unless explicitly deleted later)
    if (req.files?.previews?.length > 0) {
      const newPreviewDocs = await Promise.all(
        req.files.previews.map(async (file) => {
          const result = await uploadImage(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            `educate-hub/resources/${userId}/previews`
          );
          return result.success
            ? await resourceFile.create({
                url: result.url,
                publicId: result.public_id,
                format: result.format,
                size: result.bytes,
                uploadedBy: userId,
              })
            : null;
        })
      );

      const validPreviews = newPreviewDocs.filter(Boolean);
      if (validPreviews.length > 0) {
        resource.previewImages.push(...validPreviews.map((f) => f._id));
      }
    }

    // Main Files (append new ones)
    if (req.files?.files?.length > 0) {
      const newFileDocs = await Promise.all(
        req.files.files.map(async (file) => {
          const result = await uploadImage(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            `educate-hub/resources/${userId}/files`
          );
          return result.success
            ? await resourceFile.create({
                url: result.url,
                publicId: result.public_id,
                format: result.format,
                size: result.bytes,
                uploadedBy: userId,
              })
            : null;
        })
      );

      const validFiles = newFileDocs.filter(Boolean);
      if (validFiles.length > 0) {
        resource.mainFile = validFiles[0]._id; // only one main file allowed
      }
    }

    // Status handling
    if (userRole === "admin") {
      // Admin can keep status as is or approve directly
      if (
        req.body.status &&
        ["approved", "rejected", "pending"].includes(req.body.status)
      ) {
        resource.status = req.body.status;
        if (req.body.status === "approved") {
          resource.approvedBy = userId;
        }
      }
    } else {
      // Any user update puts resource back to pending
      resource.status = "pending";
      resource.approvedBy = null;
    }

    await resource.save();

    return successResponse(res, { resource }, "resource updated successfully");
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

    const resource = await resource
      .findById(resourceId)
      .populate("createdBy.userId", "email firstName lastName");

    if (!resource || resource.isDeleted) {
      return errorResponse(res, "Resource not found", 404);
    }

    // User (non-admin) rules
    if (userRole !== "admin") {
      if (status !== "pending") {
        return errorResponse(res, "You can only set status to pending", 403);
      }

      if (resource.createdBy.userId.toString() !== userId.toString()) {
        return errorResponse(
          res,
          "Not authorized to update this resource",
          403
        );
      }

      if (resource.status !== "draft") {
        return errorResponse(res, "Only draft resources can be submitted", 400);
      }

      resource.status = "pending";
      resource.approvedBy = null; // reset approval
    } else {
      // Admin rules
      if (!["approved", "rejected", "pending"].includes(status)) {
        return errorResponse(
          res,
          "Admin can only set status to approved, rejected, or pending",
          400
        );
      }

      resource.status = status;
      resource.approvedBy = status === "approved" ? userId : null;
    }

    await resource.save();
    if (resource.createdBy?.userId?.email) {
      await sendResourceStatusUpdateEmail(
        resource.createdBy.userId.email,
        resource.createdBy.userId.firstName,
        resource.title,
        status
      );
    }
    return successResponse(
      res,
      {
        resource: resource,
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
    let query = { "createdBy.userId": userId };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // --- Resources ---
    const resources = await resource
      .find(query)
      .populate("coverPhoto")
      .populate("previewImages")
      .populate("mainFile")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalResources = await resource.countDocuments({
      "createdBy.userId": userId,
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

    const resource = await resource.findById(resourceId);
    if (!resource) {
      return errorResponse(res, "Resource not found", 404);
    }

    // Only owner or admin can delete
    if (
      resource.createdBy.userId.toString() !== userId.toString() &&
      userRole !== "admin"
    ) {
      return errorResponse(
        res,
        "You are not authorized to delete this resource",
        403
      );
    }

    // Soft delete
    resource.isDeleted = true;
    await resource.save();

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
      .populate("coverPhoto")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const formattedResources = resources.map((r) => ({
      id: r._id,
      thumbnail: r.coverPhoto?.url || null,
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
      .populate("coverPhoto")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const formattedResources = resources.map((r) => ({
      id: r._id,
      thumbnail: r.coverPhoto?.url || null,
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
      })
      .populate("coverPhoto")
      .populate("files"); // assuming files are in a media collection

    if (!resourceDoc) {
      return errorResponse(res, "Resource not found", 404);
    }

    // For public API, don’t expose drafts/pending
    if (!req.user && resourceDoc.status !== "approved") {
      return errorResponse(res, "Resource not available", 403);
    }
    const formattedResource = {
      id: resourceDoc._id,
      title: resourceDoc.title,
      description: resourceDoc.description,
      subject: resourceDoc.subject,
      age: resourceDoc.age,
      curriculum: resourceDoc.curriculum,
      price: resourceDoc.isFree
        ? "Free"
        : `${resourceDoc.currency} ${resourceDoc.price}`,
      status: resourceDoc.status,
      thumbnail: resourceDoc.coverPhoto?.url || null,
      author: resourceDoc.createdBy?.userId
        ? `${resourceDoc.createdBy.userId.firstName} ${resourceDoc.createdBy.userId.lastName}`
        : "Unknown",
      files: resourceDoc.files || [],
      createdAt: resourceDoc.createdAt,
    };

    return successResponse(
      res,
      formattedResource,
      "Resource fetched succesfully!"
    );
  } catch (err) {
    console.error("getResourceById error:", err);
    return errorResponse(res, "Failed to fetch resource", 500);
  }
};
