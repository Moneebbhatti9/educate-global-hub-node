const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const TeacherProfile = require("../models/TeacherProfile");
const SchoolProfile = require("../models/SchoolProfile");
const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const SavedJob = require("../models/SavedJob");
const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const Resource = require("../models/resource");
const Review = require("../models/Review");
const DataExportRequest = require("../models/DataExportRequest");
const DataBreachNotification = require("../models/DataBreachNotification");
const ConsentRecord = require("../models/ConsentRecord");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
} = require("../utils/response");

/**
 * Export all user data (GDPR Article 20 - Right to Data Portability)
 * GET /api/v1/gdpr/export-data
 */
const exportUserData = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get user basic info
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Collect all user data based on role
    const exportData = {
      exportedAt: new Date().toISOString(),
      dataController: "Educate Global Hub",
      dataSubject: {
        id: user._id,
        email: user.email,
      },
      personalData: {},
    };

    // Basic user info
    exportData.personalData.account = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActive: user.lastActive,
    };

    // User profile
    const userProfile = await UserProfile.findOne({ userId });
    if (userProfile) {
      exportData.personalData.profile = {
        bio: userProfile.bio,
        address: userProfile.address,
        roleSpecificData: userProfile.roleSpecificData,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt,
      };
    }

    // Role-specific data
    if (user.role === "teacher") {
      const teacherProfile = await TeacherProfile.findOne({ userId });
      if (teacherProfile) {
        exportData.personalData.teacherProfile = teacherProfile.toObject();
        delete exportData.personalData.teacherProfile.__v;
      }

      // Job applications
      const applications = await JobApplication.find({ teacherId: userId })
        .populate("jobId", "title company location")
        .lean();
      exportData.personalData.jobApplications = applications;

      // Saved jobs
      const savedJobs = await SavedJob.find({ userId })
        .populate("jobId", "title company location")
        .lean();
      exportData.personalData.savedJobs = savedJobs;
    }

    if (user.role === "school") {
      const schoolProfile = await SchoolProfile.findOne({ userId });
      if (schoolProfile) {
        exportData.personalData.schoolProfile = schoolProfile.toObject();
        delete exportData.personalData.schoolProfile.__v;
      }

      // Jobs posted
      const jobs = await Job.find({ postedBy: userId }).lean();
      exportData.personalData.jobsPosted = jobs;
    }

    // Forum activity
    const discussions = await Discussion.find({ authorId: userId }).lean();
    exportData.personalData.forumDiscussions = discussions;

    const replies = await Reply.find({ authorId: userId }).lean();
    exportData.personalData.forumReplies = replies;

    // Resources
    const resources = await Resource.find({ uploadedBy: userId }).lean();
    exportData.personalData.resources = resources;

    // Reviews
    const reviewsGiven = await Review.find({ reviewerId: userId }).lean();
    exportData.personalData.reviewsGiven = reviewsGiven;

    const reviewsReceived = await Review.find({ targetId: userId }).lean();
    exportData.personalData.reviewsReceived = reviewsReceived;

    // Consent records
    const consentRecords = await ConsentRecord.find({ userId }).lean();
    exportData.personalData.consentHistory = consentRecords;

    // Log the export request
    await DataExportRequest.create({
      userId,
      requestedAt: new Date(),
      completedAt: new Date(),
      status: "completed",
      format: "json",
    });

    return successResponse(res, exportData, "Data exported successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Request data deletion (GDPR Article 17 - Right to Erasure)
 * POST /api/v1/gdpr/request-deletion
 */
const requestDataDeletion = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { reason, confirmEmail } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Verify email matches
    if (confirmEmail !== user.email) {
      return errorResponse(res, "Email confirmation does not match", 400);
    }

    // Create deletion request (will be processed by admin or automated)
    // For now, we'll mark the account for deletion
    user.status = "pending_deletion";
    user.deletionRequestedAt = new Date();
    user.deletionReason = reason || "User requested deletion";
    await user.save();

    // Log consent withdrawal
    await ConsentRecord.create({
      userId,
      consentType: "data_processing",
      action: "withdrawn",
      reason: "Account deletion requested",
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      {
        message: "Deletion request submitted",
        estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      "Your account deletion request has been submitted. Your data will be deleted within 30 days as per GDPR requirements."
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record user consent (for tracking purposes)
 * POST /api/v1/gdpr/consent
 */
const recordConsent = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { consentType, granted, preferences } = req.body;

    const consentRecord = await ConsentRecord.create({
      userId: userId || null,
      consentType, // 'cookies', 'marketing', 'data_processing', 'terms'
      action: granted ? "granted" : "withdrawn",
      preferences: preferences || {},
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return createdResponse(res, consentRecord, "Consent recorded successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's consent history
 * GET /api/v1/gdpr/consent-history
 */
const getConsentHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const consentRecords = await ConsentRecord.find({ userId })
      .sort({ timestamp: -1 })
      .lean();

    return successResponse(res, consentRecords, "Consent history retrieved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get data export requests history
 * GET /api/v1/gdpr/export-history
 */
const getExportHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const exportRequests = await DataExportRequest.find({ userId })
      .sort({ requestedAt: -1 })
      .lean();

    return successResponse(res, exportRequests, "Export history retrieved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Get breach notifications for user
 * GET /api/v1/gdpr/breach-notifications
 */
const getBreachNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const notifications = await DataBreachNotification.find({
      $or: [
        { affectedUsers: userId },
        { affectedUsers: { $exists: false } }, // Global notifications
      ],
    })
      .sort({ notifiedAt: -1 })
      .lean();

    return successResponse(res, notifications, "Breach notifications retrieved");
  } catch (error) {
    next(error);
  }
};

/**
 * Update data rectification (GDPR Article 16)
 * POST /api/v1/gdpr/rectification-request
 */
const requestDataRectification = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { dataField, currentValue, correctedValue, reason } = req.body;

    // For now, we'll create a ticket/request that admins can review
    // In a production system, this might integrate with a ticketing system

    // Log the rectification request
    await ConsentRecord.create({
      userId,
      consentType: "rectification_request",
      action: "requested",
      preferences: {
        dataField,
        currentValue,
        correctedValue,
        reason,
      },
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      { requestId: new Date().getTime() },
      "Rectification request submitted. We will review and update your data within 30 days."
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get GDPR information/rights summary
 * GET /api/v1/gdpr/rights
 */
const getGDPRRights = async (req, res, next) => {
  try {
    const rights = {
      dataController: {
        name: "Educate Global Hub",
        email: "gdpr@educatelink.com",
        dpo: "dpo@educatelink.com",
        address: "Your Company Address",
      },
      yourRights: [
        {
          name: "Right of Access (Article 15)",
          description: "You can request a copy of all personal data we hold about you.",
          endpoint: "/api/v1/gdpr/export-data",
        },
        {
          name: "Right to Rectification (Article 16)",
          description: "You can request correction of inaccurate personal data.",
          endpoint: "/api/v1/gdpr/rectification-request",
        },
        {
          name: "Right to Erasure (Article 17)",
          description: "You can request deletion of your personal data.",
          endpoint: "/api/v1/gdpr/request-deletion",
        },
        {
          name: "Right to Data Portability (Article 20)",
          description: "You can receive your data in a machine-readable format.",
          endpoint: "/api/v1/gdpr/export-data",
        },
        {
          name: "Right to Withdraw Consent",
          description: "You can withdraw consent for data processing at any time.",
          endpoint: "/api/v1/gdpr/consent",
        },
      ],
      dataRetention: {
        accountData: "Retained while account is active, deleted within 30 days of deletion request",
        transactionRecords: "Retained for 7 years for legal compliance",
        communicationLogs: "Retained for 2 years",
        analyticsData: "Anonymized after 26 months",
      },
      dataProcessingPurposes: [
        "Account management and authentication",
        "Providing our services (job matching, resource marketplace)",
        "Communication and notifications",
        "Legal compliance",
        "Service improvement (with consent)",
        "Marketing (with explicit consent)",
      ],
      thirdPartyProcessors: [
        { name: "Stripe", purpose: "Payment processing", location: "USA" },
        { name: "Cloudinary", purpose: "Image/file storage", location: "USA" },
        { name: "MongoDB Atlas", purpose: "Database hosting", location: "EU/USA" },
      ],
      contactForComplaints: {
        supervisoryAuthority: "Information Commissioner's Office (ICO)",
        website: "https://ico.org.uk",
      },
    };

    return successResponse(res, rights, "GDPR rights information retrieved");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportUserData,
  requestDataDeletion,
  recordConsent,
  getConsentHistory,
  getExportHistory,
  getBreachNotifications,
  requestDataRectification,
  getGDPRRights,
};
