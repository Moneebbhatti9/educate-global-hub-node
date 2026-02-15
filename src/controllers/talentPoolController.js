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

/**
 * GET /search
 * Search talent pool - only returns teachers with active consent and professional data only
 * GDPR data minimization: NO email, phone, address, passport, DOB in response
 */
const searchTalentPool = async (req, res) => {
  try {
    // Role check - only schools can search the talent pool
    if (req.user.role !== "school") {
      return errorResponse(res, "Only schools can search the talent pool", 403);
    }

    const {
      subject,
      country,
      city,
      qualification,
      minExperience,
      availabilityStatus,
    } = req.query;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 50) limit = 50;

    // Step 1: Get all users with active talent pool consent
    const activeConsents = await ConsentRecord.find({
      consentType: "talent_pool",
      action: "granted",
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }).select("userId").lean();

    const consentedUserIds = activeConsents.map((c) => c.userId);

    if (consentedUserIds.length === 0) {
      return successResponse(res, {
        teachers: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Step 2: Build query filtering only consented teachers
    const query = { userId: { $in: consentedUserIds }, talentPoolOptedIn: true };
    if (subject) query.subject = { $regex: subject, $options: "i" };
    if (country) query.country = { $regex: country, $options: "i" };
    if (city) query.city = { $regex: city, $options: "i" };
    if (qualification) query.qualification = qualification;
    if (minExperience) query.yearsOfTeachingExperience = { $gte: parseInt(minExperience) };
    if (availabilityStatus) query.availabilityStatus = availabilityStatus;

    // Step 3: Execute search with ONLY professional fields via .select() and .lean()
    // CRITICAL: Never include email, phoneNumber, alternatePhone, streetAddress,
    // passportNumber, dateOfBirth, placeOfBirth, gender, maritalStatus, postalCode, stateProvince
    const skip = (page - 1) * limit;
    const teachers = await TeacherProfile.find(query)
      .select("firstName lastName subject qualification yearsOfTeachingExperience city country professionalBio certifications availabilityStatus")
      .lean()
      .sort({ yearsOfTeachingExperience: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TeacherProfile.countDocuments(query);

    // Step 4: Sanitize response to ensure NO personal data leaks
    const sanitized = teachers.map((t) => ({
      id: t._id,
      name: `${t.firstName} ${t.lastName}`,
      subject: t.subject,
      qualification: t.qualification,
      experience: t.yearsOfTeachingExperience,
      location: `${t.city}, ${t.country}`,
      bio: t.professionalBio,
      certifications: t.certifications || [],
      availabilityStatus: t.availabilityStatus || "not_looking",
    }));

    return successResponse(res, {
      teachers: sanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Talent pool search error:", error);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  optIn,
  optOut,
  getConsentStatus,
  updateAvailability,
  searchTalentPool,
};
