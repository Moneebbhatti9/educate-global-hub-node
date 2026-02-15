const ConsentRecord = require("../models/ConsentRecord");
const TeacherProfile = require("../models/TeacherProfile");
const {
  successResponse,
  errorResponse,
  createdResponse,
} = require("../utils/response");

/**
 * POST /opt-in
 * Teacher opts into the talent pool with GDPR-compliant consent recording
 */
const optIn = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Role check
    if (req.user.role !== "teacher") {
      return errorResponse(res, "Only teachers can opt into the talent pool", 403);
    }

    const { consentText } = req.body;
    if (!consentText) {
      return errorResponse(res, "Consent text is required", 400);
    }

    // Check if teacher already has active talent pool consent
    const alreadyOptedIn = await ConsentRecord.hasActiveConsent(userId, "talent_pool");
    if (alreadyOptedIn) {
      return errorResponse(res, "Already opted in", 400);
    }

    // Create immutable ConsentRecord
    const consent = await ConsentRecord.create({
      userId,
      consentType: "talent_pool",
      action: "granted",
      consentText,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isActive: true,
      source: "website",
      policyVersion: "1.0",
    });

    // Update denormalized flag on TeacherProfile
    await TeacherProfile.findOneAndUpdate(
      { userId },
      { talentPoolOptedIn: true }
    );

    return createdResponse(
      res,
      {
        consent: {
          id: consent._id,
          consentType: consent.consentType,
          action: consent.action,
          expiresAt: consent.expiresAt,
        },
      },
      "Successfully opted into talent pool"
    );
  } catch (error) {
    console.error("Talent pool opt-in error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * POST /opt-out
 * Teacher opts out of the talent pool with consent withdrawal recording
 */
const optOut = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Role check
    if (req.user.role !== "teacher") {
      return errorResponse(res, "Only teachers can opt out of the talent pool", 403);
    }

    // Find the latest active granted consent
    const previousConsent = await ConsentRecord.findOne({
      userId,
      consentType: "talent_pool",
      action: "granted",
      isActive: true,
    }).sort({ timestamp: -1 });

    if (!previousConsent) {
      return errorResponse(res, "Not currently opted in", 400);
    }

    // Mark existing consent as inactive (do NOT delete -- immutable audit trail)
    previousConsent.isActive = false;
    await previousConsent.save();

    // Create NEW withdrawal ConsentRecord with chain reference
    await ConsentRecord.create({
      userId,
      consentType: "talent_pool",
      action: "withdrawn",
      previousConsentId: previousConsent._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      isActive: true,
      source: "website",
      policyVersion: "1.0",
    });

    // Update denormalized flags on TeacherProfile
    await TeacherProfile.findOneAndUpdate(
      { userId },
      { talentPoolOptedIn: false, availabilityStatus: "not_looking" }
    );

    return successResponse(res, null, "Successfully opted out of talent pool");
  } catch (error) {
    console.error("Talent pool opt-out error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET /consent-status
 * Get current talent pool consent status and availability
 */
const getConsentStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Role check
    if (req.user.role !== "teacher") {
      return errorResponse(res, "Only teachers can check talent pool consent status", 403);
    }

    // Get latest consent record
    const latestConsent = await ConsentRecord.getLatestConsent(userId, "talent_pool");

    // Get TeacherProfile for availability status
    const profile = await TeacherProfile.findOne({ userId }).select(
      "availabilityStatus talentPoolOptedIn"
    );

    const optedIn = latestConsent
      ? latestConsent.action === "granted" &&
        latestConsent.isActive &&
        (!latestConsent.expiresAt || latestConsent.expiresAt > new Date())
      : false;

    return successResponse(res, {
      optedIn,
      availabilityStatus: profile ? profile.availabilityStatus : "not_looking",
      consentExpiresAt: latestConsent && latestConsent.action === "granted" ? latestConsent.expiresAt : null,
      lastAction: latestConsent ? latestConsent.action : null,
    });
  } catch (error) {
    console.error("Talent pool consent status error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * PATCH /availability
 * Update teacher's availability status (only if opted in)
 */
const updateAvailability = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Role check
    if (req.user.role !== "teacher") {
      return errorResponse(res, "Only teachers can update availability", 403);
    }

    const { availabilityStatus } = req.body;
    const validStatuses = ["available", "open_to_offers", "not_looking"];

    if (!availabilityStatus || !validStatuses.includes(availabilityStatus)) {
      return errorResponse(
        res,
        "Invalid availability status. Must be one of: available, open_to_offers, not_looking",
        400
      );
    }

    // Check teacher has active talent pool consent
    const hasConsent = await ConsentRecord.hasActiveConsent(userId, "talent_pool");
    if (!hasConsent) {
      return errorResponse(res, "Must opt into talent pool first", 400);
    }

    // Update availability
    const updatedProfile = await TeacherProfile.findOneAndUpdate(
      { userId },
      { availabilityStatus },
      { new: true }
    ).select("availabilityStatus talentPoolOptedIn");

    return successResponse(res, {
      availabilityStatus: updatedProfile.availabilityStatus,
    }, "Availability status updated successfully");
  } catch (error) {
    console.error("Update availability error:", error);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  optIn,
  optOut,
  getConsentStatus,
  updateAvailability,
};
