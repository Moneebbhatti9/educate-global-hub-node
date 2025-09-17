const { uploadImage, deleteImage } = require("../config/cloudinary");
const resource = require("../models/resource");
const resourceFile = require("../models/resourceFile");
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
      shortDescription,
      resourceType,
      licenseType,
      visibility,
      isFree,
      price,
      currency,
    } = req.body;

    // ---- validation ----
    if (!title || !description || !resourceType || !licenseType) {
      return errorResponse(
        res,
        "Missing required fields (title, description, resourceType, licenseType)",
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

    // ---- create bare resource (so we have resourceId for file docs) ----
    createdResource = await resource.create({
      title: title.trim(),
      description: description.trim(),
      shortDescription: shortDescription?.trim() || "",
      type: resourceType,
      license: licenseType,
      isFree: freeFlag,
      currency: freeFlag ? currency || null : currency,
      price: freeFlag ? 0 : Number(price || 0),
      publishing: visibility || "public",
      createdBy: { userId, role: userRole },
      status: "pending", // always pending until admin approves
    });

    // ---- upload banner and create ResourceFile doc (coverPhoto) ----
    const bannerFile = req.files.banner[0];
    const bannerResult = await uploadImage(
      `data:${bannerFile.mimetype};base64,${bannerFile.buffer.toString(
        "base64"
      )}`,
      `educate-hub/resources/${createdResource._id}/banner`
    );

    if (!bannerResult || !bannerResult.success) {
      throw new Error("Banner upload failed");
    }
    uploadedPublicIds.push(bannerResult.public_id);

    const bannerDoc = await resourceFile.create({
      resourceId: createdResource._id,
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
        `educate-hub/resources/${createdResource._id}/previews`
      );
      if (!r || !r.success) {
        throw new Error("Preview upload failed");
      }
      uploadedPublicIds.push(r.public_id);

      const pf = await resourceFile.create({
        resourceId: createdResource._id,
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
        `educate-hub/resources/${createdResource._id}/files`
      );
      if (!r || !r.success) {
        throw new Error("resource file upload failed");
      }
      uploadedPublicIds.push(r.public_id);

      const fd = await resourceFile.create({
        resourceId: createdResource._id,
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

    // ---- update resource with references ----
    // set coverPhoto to bannerDoc._id, previewImages to previewDocs ids, mainFile to first file doc
    createdResource.coverPhoto = bannerDoc._id;
    createdResource.previewImages = previewDocs.map((d) => d._id);
    createdResource.mainFile = fileDocs[0]._id; // mainFile is single id per schema
    await createdResource.save();

    // populate file refs for response
    const populatedResource = await resource
      .findById(createdResource._id)
      .populate("coverPhoto")
      .populate("previewImages")
      .populate("mainFile")
      .populate("createdBy.userId", "firstName lastName email");

    return successResponse(
      res,
      "resource created successfully",
      populatedResource
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
      shortDescription,
      type,
      license,
      publishing,
      isFree,
      price,
      currency,
    } = req.body;

    // Apply updates only if provided
    if (title) resource.title = title;
    if (description) resource.description = description;
    if (shortDescription) resource.shortDescription = shortDescription;
    if (type) resource.type = type;
    if (license) resource.license = license;
    if (publishing) resource.publishing = publishing;

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

    return successResponse(res, "resource updated successfully", { resource });
  } catch (err) {
    console.error("updateResource error:", err);
    return errorResponse(res, "Failed to update resource", 500);
  }
};
