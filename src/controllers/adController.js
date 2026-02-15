const mongoose = require("mongoose");
const AdTier = require("../models/AdTier");
const AdRequest = require("../models/AdRequest");
const JobNotification = require("../models/JobNotification");
const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");
const { createOrGetCustomer } = require("../config/stripe");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
} = require("../utils/response");
const { sendAdFeedbackEmail } = require("../config/email");

/**
 * Ad Controller
 * Handles ad tier listing and ad request operations.
 */

/**
 * GET /api/v1/ads/tiers
 * Get all active ad tiers with pricing
 * Public endpoint - used on post-job success page for upsell
 */
const getAdTiers = async (req, res) => {
  try {
    const tiers = await AdTier.findActive();

    return successResponse(res, { tiers }, "Ad tiers retrieved successfully");
  } catch (error) {
    console.error("Error in getAdTiers:", error);
    return errorResponse(res, "Failed to retrieve ad tiers", 500);
  }
};

/**
 * GET /api/v1/ads/tiers/:slug
 * Get a single ad tier by slug
 * Public endpoint
 */
const getAdTierBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const tier = await AdTier.findBySlug(slug);

    if (!tier) {
      return notFoundResponse(res, "Ad tier not found");
    }

    return successResponse(res, { tier }, "Ad tier retrieved successfully");
  } catch (error) {
    console.error("Error in getAdTierBySlug:", error);
    return errorResponse(res, "Failed to retrieve ad tier", 500);
  }
};

/**
 * POST /api/v1/ads/requests
 * Create a new ad request with banner image upload
 * School-only endpoint
 */
const createAdRequest = async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role !== "school") {
      return forbiddenResponse(res, "Only schools can create ad requests");
    }

    const { jobId, tierId, headline, description } = req.body;

    if (!jobId || !tierId) {
      return errorResponse(res, "Job ID and Tier ID are required", 400);
    }

    // Validate tier exists
    const tier = await AdTier.findById(tierId);
    if (!tier || !tier.isActive) {
      return notFoundResponse(res, "Ad tier not found or inactive");
    }

    // Validate file upload
    if (!req.file) {
      return errorResponse(res, "Banner image is required", 400);
    }

    // Upload banner to Cloudinary
    const base64Image = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: "ad-banners",
      transformation: [
        { width: 1200, height: 400, crop: "fill" },
        { quality: "auto:good" },
      ],
    });

    // Create ad request
    const adRequest = await AdRequest.create({
      jobId,
      schoolId: userId,
      tierId,
      bannerImageUrl: uploadResult.secure_url,
      headline: headline || null,
      description: description || null,
      status: "PENDING_REVIEW",
    });

    // Populate for response
    const populated = await AdRequest.findById(adRequest._id)
      .populate("jobId", "title organization")
      .populate("tierId", "name slug durationLabel");

    // Notify admins about new ad request
    const admins = await User.find({ role: "admin" }).select("_id");
    for (const admin of admins) {
      await sendAdNotification(
        admin._id,
        "ad_request_submitted",
        "New Ad Request Submitted",
        `A school has submitted a new ad request for "${req.body.jobId}". Please review it.`,
        jobId,
        "/admin/ad-management"
      );
    }

    return createdResponse(
      res,
      { adRequest: populated },
      "Ad request submitted successfully"
    );
  } catch (error) {
    console.error("Error in createAdRequest:", error);
    return errorResponse(res, "Failed to create ad request", 500);
  }
};

/**
 * GET /api/v1/ads/requests/my
 * Get ad requests for the current school
 * School-only endpoint
 */
const getMyAdRequests = async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role !== "school") {
      return forbiddenResponse(res, "Only schools can view their ad requests");
    }

    // Lazy expiration: expire overdue ads before returning results
    await AdRequest.expireOverdueAds();

    const adRequests = await AdRequest.findBySchool(userId);

    return successResponse(
      res,
      { adRequests },
      "Ad requests retrieved successfully"
    );
  } catch (error) {
    console.error("Error in getMyAdRequests:", error);
    return errorResponse(res, "Failed to retrieve ad requests", 500);
  }
};

/**
 * PATCH /api/v1/ads/requests/:id/cancel
 * Cancel a pending ad request
 * School-only endpoint - can only cancel PENDING_REVIEW requests
 */
const cancelAdRequest = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;

    if (role !== "school") {
      return forbiddenResponse(res, "Only schools can cancel ad requests");
    }

    const adRequest = await AdRequest.findById(id);
    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    // Verify ownership
    if (adRequest.schoolId.toString() !== userId.toString()) {
      return forbiddenResponse(res, "You can only cancel your own ad requests");
    }

    // Can only cancel PENDING_REVIEW requests
    if (adRequest.status !== "PENDING_REVIEW") {
      return errorResponse(
        res,
        "Only pending review requests can be cancelled",
        400
      );
    }

    adRequest.status = "CANCELLED";
    await adRequest.save();

    return successResponse(
      res,
      { adRequest },
      "Ad request cancelled successfully"
    );
  } catch (error) {
    console.error("Error in cancelAdRequest:", error);
    return errorResponse(res, "Failed to cancel ad request", 500);
  }
};

/**
 * PATCH /api/v1/ads/requests/:id/resubmit
 * Resubmit an ad request after admin requests changes
 * School-only endpoint - can only resubmit CHANGES_REQUESTED requests
 */
const resubmitAdRequest = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;

    if (role !== "school") {
      return forbiddenResponse(res, "Only schools can resubmit ad requests");
    }

    const adRequest = await AdRequest.findById(id).populate("jobId", "title");
    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    // Verify ownership
    if (adRequest.schoolId.toString() !== userId.toString()) {
      return forbiddenResponse(res, "You can only resubmit your own ad requests");
    }

    // Can only resubmit CHANGES_REQUESTED requests
    if (adRequest.status !== "CHANGES_REQUESTED") {
      return errorResponse(
        res,
        "Only requests with status 'Changes Requested' can be resubmitted",
        400
      );
    }

    // Handle optional new banner image
    if (req.file) {
      const base64Image = req.file.buffer.toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "ad-banners",
        transformation: [
          { width: 1200, height: 400, crop: "fill" },
          { quality: "auto:good" },
        ],
      });

      adRequest.bannerImageUrl = uploadResult.secure_url;
    }

    // Update headline/description if provided
    const { headline, description } = req.body;
    if (headline !== undefined) adRequest.headline = headline || null;
    if (description !== undefined) adRequest.description = description || null;

    // Transition status back to PENDING_REVIEW
    adRequest.status = "PENDING_REVIEW";
    adRequest.adminComment = null;
    adRequest.reviewedBy = null;
    adRequest.reviewedAt = null;
    await adRequest.save();

    // Notify admins about resubmission
    const admins = await User.find({ role: "admin" }).select("_id");
    for (const admin of admins) {
      await sendAdNotification(
        admin._id,
        "ad_request_resubmitted",
        "Ad Request Resubmitted",
        `A school has resubmitted their ad request for "${adRequest.jobId?.title}". Please review it.`,
        adRequest.jobId?._id,
        "/dashboard/admin/ad-management"
      );
    }

    // Re-populate for response
    const populated = await AdRequest.findById(adRequest._id)
      .populate("jobId", "title organization")
      .populate("tierId", "name slug durationLabel");

    return successResponse(
      res,
      { adRequest: populated },
      "Ad request resubmitted successfully"
    );
  } catch (error) {
    console.error("Error in resubmitAdRequest:", error);
    return errorResponse(res, "Failed to resubmit ad request", 500);
  }
};

/**
 * GET /api/v1/ads/banners/active
 * Get active, non-expired banner ads for the carousel
 * Public endpoint
 */
const getActiveBanners = async (req, res) => {
  try {
    // Lazy expiration: expire overdue ads before returning
    await AdRequest.expireOverdueAds();

    const banners = await AdRequest.findActiveBanners();

    return successResponse(
      res,
      { banners },
      "Active banners retrieved successfully"
    );
  } catch (error) {
    console.error("Error in getActiveBanners:", error);
    return errorResponse(res, "Failed to retrieve active banners", 500);
  }
};

/**
 * POST /api/v1/ads/requests/:id/checkout
 * Create Stripe Checkout session for an approved ad request
 * School-only endpoint - ad must be in PENDING_PAYMENT status
 */
const createAdCheckout = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;

    if (role !== "school") {
      return forbiddenResponse(res, "Only schools can pay for ad requests");
    }

    const adRequest = await AdRequest.findById(id)
      .populate("tierId")
      .populate("jobId", "title");

    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    // Verify ownership
    if (adRequest.schoolId.toString() !== userId.toString()) {
      return forbiddenResponse(res, "You can only pay for your own ad requests");
    }

    // Must be in PENDING_PAYMENT status
    if (adRequest.status !== "PENDING_PAYMENT") {
      return errorResponse(
        res,
        "Ad request must be approved before payment",
        400
      );
    }

    const tier = adRequest.tierId;
    if (!tier) {
      return errorResponse(res, "Ad tier not found", 500);
    }

    // Get effective price
    const effectivePrice = tier.hasActiveLaunchPricing
      ? (tier.launchPrice ? parseFloat(tier.launchPrice.toString()) : 0)
      : (tier.normalPrice ? parseFloat(tier.normalPrice.toString()) : 0);

    // Get or create Stripe customer
    const user = await User.findById(userId);
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await createOrGetCustomer({
        email: user.email,
        userId: userId.toString(),
        name: `${user.firstName} ${user.lastName}`,
        metadata: { role: user.role },
      });
      stripeCustomerId = customer.id;
      await User.findByIdAndUpdate(userId, { stripeCustomerId });
    }

    // Build URLs
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const successUrl = `${frontendUrl}/dashboard/school/my-advertisements?payment=success`;
    const cancelUrl = `${frontendUrl}/dashboard/school/my-advertisements?payment=cancelled`;

    // Create Stripe Checkout session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${tier.name} - ${adRequest.jobId?.title || "Job Ad"}`,
              description: `${tier.durationLabel} advertisement`,
            },
            unit_amount: Math.round(effectivePrice),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "ad_payment",
        ad_request_id: adRequest._id.toString(),
        tier_id: tier._id.toString(),
        school_id: userId.toString(),
        marketplace: "educate_global_hub",
      },
    });

    return successResponse(
      res,
      { checkoutUrl: session.url, sessionId: session.id },
      "Checkout session created"
    );
  } catch (error) {
    console.error("Error in createAdCheckout:", error);
    return errorResponse(res, "Failed to create checkout session", 500);
  }
};

// ==========================================
// Admin endpoints
// ==========================================

/**
 * GET /api/v1/ads/admin/stats
 * Get ad request statistics for the admin dashboard cards
 * Admin-only endpoint
 */
const adminGetAdStats = async (req, res) => {
  try {
    const [
      totalRequests,
      pendingReview,
      active,
      pendingPayment,
      rejected,
      expired,
      cancelled,
      changesRequested,
      approved,
    ] = await Promise.all([
      AdRequest.countDocuments(),
      AdRequest.countDocuments({ status: "PENDING_REVIEW" }),
      AdRequest.countDocuments({ status: "ACTIVE" }),
      AdRequest.countDocuments({ status: "PENDING_PAYMENT" }),
      AdRequest.countDocuments({ status: "REJECTED" }),
      AdRequest.countDocuments({ status: "EXPIRED" }),
      AdRequest.countDocuments({ status: "CANCELLED" }),
      AdRequest.countDocuments({ status: "CHANGES_REQUESTED" }),
      AdRequest.countDocuments({ status: "APPROVED" }),
    ]);

    return successResponse(
      res,
      {
        stats: {
          totalRequests,
          pendingReview,
          active,
          pendingPayment,
          rejected,
          expired,
          cancelled,
          changesRequested,
          approved,
        },
      },
      "Ad stats retrieved successfully"
    );
  } catch (error) {
    console.error("Error in adminGetAdStats:", error);
    return errorResponse(res, "Failed to retrieve ad stats", 500);
  }
};

// ==========================================
// Admin Ad Tier CRUD
// ==========================================

/**
 * GET /api/v1/ads/admin/tiers
 * Get all ad tiers (including inactive) for admin management
 * Admin-only endpoint
 */
const adminGetAllAdTiers = async (req, res) => {
  try {
    const tiers = await AdTier.find().sort({ sortOrder: 1, createdAt: -1 });
    return successResponse(res, { tiers }, "Ad tiers retrieved successfully");
  } catch (error) {
    console.error("Error in adminGetAllAdTiers:", error);
    return errorResponse(res, "Failed to retrieve ad tiers", 500);
  }
};

/**
 * POST /api/v1/ads/admin/tiers
 * Create a new ad tier
 * Admin-only endpoint
 */
const adminCreateAdTier = async (req, res) => {
  try {
    const {
      name, slug, description, normalPrice, launchPrice, currency,
      durationDays, durationLabel, features, isActive, sortOrder,
      highlight, isLaunchPricing, launchPricingExpiresAt,
    } = req.body;

    if (!name || !slug || !durationLabel || normalPrice === undefined || launchPrice === undefined || durationDays === undefined) {
      return errorResponse(res, "Name, slug, durationLabel, normalPrice, launchPrice, and durationDays are required", 400);
    }

    // Check slug uniqueness
    const existing = await AdTier.findOne({ slug: slug.toLowerCase() });
    if (existing) {
      return errorResponse(res, "A tier with this slug already exists", 400);
    }

    const tier = await AdTier.create({
      name,
      slug: slug.toLowerCase(),
      description: description || "",
      normalPrice: mongoose.Types.Decimal128.fromString(String(normalPrice)),
      launchPrice: mongoose.Types.Decimal128.fromString(String(launchPrice)),
      currency: currency || "GBP",
      durationDays,
      durationLabel,
      features: features || [],
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
      highlight: highlight || null,
      isLaunchPricing: isLaunchPricing !== undefined ? isLaunchPricing : true,
      launchPricingExpiresAt: launchPricingExpiresAt || null,
    });

    return createdResponse(res, { tier }, "Ad tier created successfully");
  } catch (error) {
    console.error("Error in adminCreateAdTier:", error);
    return errorResponse(res, "Failed to create ad tier", 500);
  }
};

/**
 * PUT /api/v1/ads/admin/tiers/:id
 * Update an ad tier
 * Admin-only endpoint
 */
const adminUpdateAdTier = async (req, res) => {
  try {
    const { id } = req.params;
    const tier = await AdTier.findById(id);
    if (!tier) {
      return notFoundResponse(res, "Ad tier not found");
    }

    const {
      name, slug, description, normalPrice, launchPrice, currency,
      durationDays, durationLabel, features, isActive, sortOrder,
      highlight, isLaunchPricing, launchPricingExpiresAt,
    } = req.body;

    // Check slug uniqueness if changing
    if (slug && slug.toLowerCase() !== tier.slug) {
      const existing = await AdTier.findOne({ slug: slug.toLowerCase(), _id: { $ne: id } });
      if (existing) {
        return errorResponse(res, "A tier with this slug already exists", 400);
      }
      tier.slug = slug.toLowerCase();
    }

    if (name !== undefined) tier.name = name;
    if (description !== undefined) tier.description = description;
    if (normalPrice !== undefined) tier.normalPrice = mongoose.Types.Decimal128.fromString(String(normalPrice));
    if (launchPrice !== undefined) tier.launchPrice = mongoose.Types.Decimal128.fromString(String(launchPrice));
    if (currency !== undefined) tier.currency = currency;
    if (durationDays !== undefined) tier.durationDays = durationDays;
    if (durationLabel !== undefined) tier.durationLabel = durationLabel;
    if (features !== undefined) tier.features = features;
    if (isActive !== undefined) tier.isActive = isActive;
    if (sortOrder !== undefined) tier.sortOrder = sortOrder;
    if (highlight !== undefined) tier.highlight = highlight || null;
    if (isLaunchPricing !== undefined) tier.isLaunchPricing = isLaunchPricing;
    if (launchPricingExpiresAt !== undefined) tier.launchPricingExpiresAt = launchPricingExpiresAt || null;

    await tier.save();

    return successResponse(res, { tier }, "Ad tier updated successfully");
  } catch (error) {
    console.error("Error in adminUpdateAdTier:", error);
    return errorResponse(res, "Failed to update ad tier", 500);
  }
};

/**
 * DELETE /api/v1/ads/admin/tiers/:id
 * Delete an ad tier (only if no active ad requests use it)
 * Admin-only endpoint
 */
const adminDeleteAdTier = async (req, res) => {
  try {
    const { id } = req.params;
    const tier = await AdTier.findById(id);
    if (!tier) {
      return notFoundResponse(res, "Ad tier not found");
    }

    // Check for active or pending ad requests using this tier
    const activeRequests = await AdRequest.countDocuments({
      tierId: id,
      status: { $in: ["PENDING_REVIEW", "APPROVED", "PENDING_PAYMENT", "ACTIVE"] },
    });

    if (activeRequests > 0) {
      return errorResponse(
        res,
        `Cannot delete this tier. It has ${activeRequests} active/pending ad request(s). Deactivate the tier instead.`,
        400
      );
    }

    await AdTier.findByIdAndDelete(id);

    return successResponse(res, null, "Ad tier deleted successfully");
  } catch (error) {
    console.error("Error in adminDeleteAdTier:", error);
    return errorResponse(res, "Failed to delete ad tier", 500);
  }
};

/**
 * Helper: Send ad notification
 */
const sendAdNotification = async (userId, type, title, message, jobId = null, actionUrl = null) => {
  try {
    // Build full URL if a relative path is provided (model validates for https?://)
    let fullActionUrl = actionUrl;
    if (actionUrl && !actionUrl.startsWith("http")) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      fullActionUrl = `${frontendUrl}${actionUrl}`;
    }

    await JobNotification.create({
      userId,
      jobId,
      type,
      title,
      message,
      priority: "medium",
      category: "advertisement",
      actionRequired: !!fullActionUrl,
      actionUrl: fullActionUrl,
      actionText: fullActionUrl ? "View Details" : undefined,
    });
  } catch (error) {
    console.error("Failed to send ad notification:", error);
  }
};

/**
 * GET /api/v1/ads/admin/requests
 * Get all ad requests (admin view) with optional status filter
 * Admin-only endpoint
 */
const adminGetAdRequests = async (req, res) => {
  try {
    // Lazy expiration: expire overdue ads before returning results
    await AdRequest.expireOverdueAds();

    const { status, search } = req.query;

    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    let adRequests = await AdRequest.find(query)
      .populate("jobId", "title organization")
      .populate("schoolId", "firstName lastName email")
      .populate("tierId", "name slug effectivePrice durationLabel")
      .sort({ createdAt: -1 });

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      adRequests = adRequests.filter((req) => {
        const jobTitle = req.jobId?.title?.toLowerCase() || "";
        const schoolName =
          `${req.schoolId?.firstName || ""} ${req.schoolId?.lastName || ""}`.toLowerCase();
        const schoolEmail = req.schoolId?.email?.toLowerCase() || "";
        return (
          jobTitle.includes(searchLower) ||
          schoolName.includes(searchLower) ||
          schoolEmail.includes(searchLower)
        );
      });
    }

    return successResponse(
      res,
      { adRequests },
      "Ad requests retrieved successfully"
    );
  } catch (error) {
    console.error("Error in adminGetAdRequests:", error);
    return errorResponse(res, "Failed to retrieve ad requests", 500);
  }
};

/**
 * GET /api/v1/ads/admin/requests/:id
 * Get a single ad request detail (admin view)
 * Admin-only endpoint
 */
const adminGetAdRequestDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const adRequest = await AdRequest.findById(id)
      .populate("jobId", "title organization slug city country")
      .populate("schoolId", "firstName lastName email")
      .populate("tierId", "name slug normalPrice launchPrice effectivePrice durationLabel durationDays features")
      .populate("reviewedBy", "firstName lastName");

    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    return successResponse(
      res,
      { adRequest },
      "Ad request retrieved successfully"
    );
  } catch (error) {
    console.error("Error in adminGetAdRequestDetail:", error);
    return errorResponse(res, "Failed to retrieve ad request", 500);
  }
};

/**
 * PATCH /api/v1/ads/admin/requests/:id/approve
 * Approve an ad request → status PENDING_PAYMENT
 * Admin-only endpoint
 */
const adminApproveAdRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const adRequest = await AdRequest.findById(id).populate("jobId", "title");
    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    if (adRequest.status !== "PENDING_REVIEW") {
      return errorResponse(
        res,
        `Cannot approve request with status: ${adRequest.status}`,
        400
      );
    }

    adRequest.status = "PENDING_PAYMENT";
    adRequest.reviewedBy = userId;
    adRequest.reviewedAt = new Date();
    await adRequest.save();

    // Notify school
    await sendAdNotification(
      adRequest.schoolId,
      "ad_request_approved",
      "Ad Request Approved!",
      `Your ad request for "${adRequest.jobId?.title}" has been approved. Please complete payment to activate your ad.`,
      adRequest.jobId?._id,
      "/dashboard/school/my-advertisements"
    );

    // Send email notification to school (non-blocking)
    try {
      const schoolUser = await User.findById(adRequest.schoolId).select("email firstName lastName");
      if (schoolUser?.email) {
        const userName = `${schoolUser.firstName || ""} ${schoolUser.lastName || ""}`.trim();
        await sendAdFeedbackEmail(schoolUser.email, userName, adRequest.jobId?.title || "Job Ad", "Approved", "Your ad request has been approved! Please complete payment to activate your advertisement.");
      }
    } catch (emailError) {
      console.error("Failed to send ad approval email:", emailError);
    }

    return successResponse(
      res,
      { adRequest },
      "Ad request approved successfully"
    );
  } catch (error) {
    console.error("Error in adminApproveAdRequest:", error);
    return errorResponse(res, "Failed to approve ad request", 500);
  }
};

/**
 * PATCH /api/v1/ads/admin/requests/:id/reject
 * Reject an ad request with required comment → status REJECTED
 * Admin-only endpoint
 */
const adminRejectAdRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { comment } = req.body;

    if (!comment || comment.trim().length < 10) {
      return errorResponse(
        res,
        "Rejection comment is required (minimum 10 characters)",
        400
      );
    }

    const adRequest = await AdRequest.findById(id).populate("jobId", "title");
    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    if (adRequest.status !== "PENDING_REVIEW") {
      return errorResponse(
        res,
        `Cannot reject request with status: ${adRequest.status}`,
        400
      );
    }

    adRequest.status = "REJECTED";
    adRequest.adminComment = comment.trim();
    adRequest.reviewedBy = userId;
    adRequest.reviewedAt = new Date();
    await adRequest.save();

    // Notify school
    await sendAdNotification(
      adRequest.schoolId,
      "ad_request_rejected",
      "Ad Request Rejected",
      `Your ad request for "${adRequest.jobId?.title}" has been rejected. Reason: ${comment.trim()}`,
      adRequest.jobId?._id,
      "/dashboard/school/my-advertisements"
    );

    // Send email notification to school (non-blocking)
    try {
      const schoolUser = await User.findById(adRequest.schoolId).select("email firstName lastName");
      if (schoolUser?.email) {
        const userName = `${schoolUser.firstName || ""} ${schoolUser.lastName || ""}`.trim();
        await sendAdFeedbackEmail(schoolUser.email, userName, adRequest.jobId?.title || "Job Ad", "Rejected", comment.trim());
      }
    } catch (emailError) {
      console.error("Failed to send ad rejection email:", emailError);
    }

    return successResponse(
      res,
      { adRequest },
      "Ad request rejected"
    );
  } catch (error) {
    console.error("Error in adminRejectAdRequest:", error);
    return errorResponse(res, "Failed to reject ad request", 500);
  }
};

/**
 * PATCH /api/v1/ads/admin/requests/:id/request-changes
 * Request changes on an ad request with feedback → status CHANGES_REQUESTED
 * Admin-only endpoint
 */
const adminRequestChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { comment } = req.body;

    if (!comment || comment.trim().length < 10) {
      return errorResponse(
        res,
        "Feedback comment is required (minimum 10 characters)",
        400
      );
    }

    const adRequest = await AdRequest.findById(id).populate("jobId", "title");
    if (!adRequest) {
      return notFoundResponse(res, "Ad request not found");
    }

    if (adRequest.status !== "PENDING_REVIEW") {
      return errorResponse(
        res,
        `Cannot request changes on request with status: ${adRequest.status}`,
        400
      );
    }

    adRequest.status = "CHANGES_REQUESTED";
    adRequest.adminComment = comment.trim();
    adRequest.reviewedBy = userId;
    adRequest.reviewedAt = new Date();
    await adRequest.save();

    // Notify school
    await sendAdNotification(
      adRequest.schoolId,
      "ad_request_changes",
      "Changes Requested for Your Ad",
      `Changes have been requested for your ad for "${adRequest.jobId?.title}". Feedback: ${comment.trim()}`,
      adRequest.jobId?._id,
      "/dashboard/school/my-advertisements"
    );

    // Send email notification to school (non-blocking)
    try {
      const schoolUser = await User.findById(adRequest.schoolId).select("email firstName lastName");
      if (schoolUser?.email) {
        const userName = `${schoolUser.firstName || ""} ${schoolUser.lastName || ""}`.trim();
        await sendAdFeedbackEmail(schoolUser.email, userName, adRequest.jobId?.title || "Job Ad", "Changes Requested", comment.trim());
      }
    } catch (emailError) {
      console.error("Failed to send ad changes-requested email:", emailError);
    }

    return successResponse(
      res,
      { adRequest },
      "Changes requested successfully"
    );
  } catch (error) {
    console.error("Error in adminRequestChanges:", error);
    return errorResponse(res, "Failed to request changes", 500);
  }
};

module.exports = {
  // Public
  getAdTiers,
  getAdTierBySlug,
  getActiveBanners,
  // School
  createAdRequest,
  getMyAdRequests,
  cancelAdRequest,
  resubmitAdRequest,
  createAdCheckout,
  // Admin
  adminGetAdStats,
  adminGetAdRequests,
  adminGetAdRequestDetail,
  adminApproveAdRequest,
  adminRejectAdRequest,
  adminRequestChanges,
  // Admin Ad Tier CRUD
  adminGetAllAdTiers,
  adminCreateAdTier,
  adminUpdateAdTier,
  adminDeleteAdTier,
};
