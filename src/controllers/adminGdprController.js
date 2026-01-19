/**
 * Admin GDPR Controller
 * Handles admin-level GDPR operations including breach management,
 * data retention, and compliance reporting.
 */

const breachService = require("../services/breachNotificationService");
const retentionService = require("../services/dataRetentionService");
const ConsentRecord = require("../models/ConsentRecord");
const DataExportRequest = require("../models/DataExportRequest");
const User = require("../models/User");
const {
  successResponse,
  errorResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
} = require("../utils/response");

/**
 * Create a new breach notification
 * POST /api/v1/admin/gdpr/breaches
 */
const createBreach = async (req, res, next) => {
  try {
    const breach = await breachService.createBreachNotification(
      req.body,
      req.user.userId
    );

    return createdResponse(
      res,
      breach,
      "Breach notification created successfully"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all breach notifications
 * GET /api/v1/admin/gdpr/breaches
 */
const getBreaches = async (req, res, next) => {
  try {
    const { page, limit, status, severity, sortBy, sortOrder } = req.query;

    const result = await breachService.getBreaches({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      severity,
      sortBy,
      sortOrder,
    });

    return paginatedResponse(
      res,
      "Breaches retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single breach by ID
 * GET /api/v1/admin/gdpr/breaches/:breachId
 */
const getBreach = async (req, res, next) => {
  try {
    const breach = await breachService.getBreachById(req.params.breachId);

    if (!breach) {
      return notFoundResponse(res, "Breach notification not found");
    }

    return successResponse(res, breach, "Breach retrieved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Send notifications to affected users
 * POST /api/v1/admin/gdpr/breaches/:breachId/notify
 */
const notifyUsers = async (req, res, next) => {
  try {
    const result = await breachService.notifyAffectedUsers(req.params.breachId);

    return successResponse(
      res,
      result,
      `Notifications sent to ${result.successCount} users`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Generate supervisory authority report
 * GET /api/v1/admin/gdpr/breaches/:breachId/report
 */
const generateReport = async (req, res, next) => {
  try {
    const report = await breachService.generateSupervisoryAuthorityReport(
      req.params.breachId
    );

    return successResponse(res, report, "Report generated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Mark breach as reported to authority
 * POST /api/v1/admin/gdpr/breaches/:breachId/mark-reported
 */
const markReported = async (req, res, next) => {
  try {
    const { referenceNumber } = req.body;

    const breach = await breachService.markAsReportedToAuthority(
      req.params.breachId,
      referenceNumber
    );

    if (!breach) {
      return notFoundResponse(res, "Breach notification not found");
    }

    return successResponse(
      res,
      breach,
      "Breach marked as reported to supervisory authority"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve a breach
 * POST /api/v1/admin/gdpr/breaches/:breachId/resolve
 */
const resolveBreach = async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;

    const breach = await breachService.resolveBreach(
      req.params.breachId,
      resolutionNotes
    );

    if (!breach) {
      return notFoundResponse(res, "Breach notification not found");
    }

    return successResponse(res, breach, "Breach resolved successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * Check for overdue breach notifications
 * GET /api/v1/admin/gdpr/breaches/deadline-alerts
 */
const checkDeadlines = async (req, res, next) => {
  try {
    const overdue = await breachService.checkDeadlineAlerts();

    return successResponse(
      res,
      {
        overdueCount: overdue.length,
        breaches: overdue,
      },
      overdue.length > 0
        ? `${overdue.length} breaches approaching/past 72-hour deadline`
        : "No overdue breaches"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Run data retention tasks
 * POST /api/v1/admin/gdpr/retention/run
 */
const runRetentionTasks = async (req, res, next) => {
  try {
    const results = await retentionService.runRetentionTasks();

    return successResponse(res, results, "Retention tasks completed");
  } catch (error) {
    next(error);
  }
};

/**
 * Get data retention report
 * GET /api/v1/admin/gdpr/retention/report
 */
const getRetentionReport = async (req, res, next) => {
  try {
    const report = await retentionService.generateRetentionReport();

    return successResponse(res, report, "Retention report generated");
  } catch (error) {
    next(error);
  }
};

/**
 * Get consent statistics
 * GET /api/v1/admin/gdpr/consent/stats
 */
const getConsentStats = async (req, res, next) => {
  try {
    const stats = await ConsentRecord.aggregate([
      {
        $group: {
          _id: {
            consentType: "$consentType",
            action: "$action",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.consentType",
          actions: {
            $push: {
              action: "$_id.action",
              count: "$count",
            },
          },
          total: { $sum: "$count" },
        },
      },
    ]);

    const totalRecords = await ConsentRecord.countDocuments();
    const activeConsents = await ConsentRecord.countDocuments({
      action: "granted",
      isActive: true,
    });

    return successResponse(
      res,
      {
        totalRecords,
        activeConsents,
        byType: stats,
      },
      "Consent statistics retrieved"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get export request statistics
 * GET /api/v1/admin/gdpr/exports/stats
 */
const getExportStats = async (req, res, next) => {
  try {
    const stats = await DataExportRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalExports = await DataExportRequest.countDocuments();
    const recentExports = await DataExportRequest.countDocuments({
      requestedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    return successResponse(
      res,
      {
        totalExports,
        recentExports,
        byStatus: stats,
      },
      "Export statistics retrieved"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending deletion requests
 * GET /api/v1/admin/gdpr/deletion-requests
 */
const getDeletionRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pendingDeletions = await User.find({ status: "pending_deletion" })
      .select("email firstName lastName deletionRequestedAt deletionReason")
      .sort({ deletionRequestedAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments({ status: "pending_deletion" });

    return paginatedResponse(res, "Deletion requests retrieved", {
      requests: pendingDeletions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process a deletion request immediately
 * POST /api/v1/admin/gdpr/deletion-requests/:userId/process
 */
const processDeletionRequest = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (user.status !== "pending_deletion") {
      return errorResponse(res, "User does not have a pending deletion request", 400);
    }

    await retentionService.deleteUserData(userId);

    return successResponse(
      res,
      { deletedUserId: userId },
      "User data deleted successfully"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get GDPR compliance dashboard data
 * GET /api/v1/admin/gdpr/dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const [
      retentionReport,
      overdueBreaches,
      recentExports,
      pendingDeletions,
    ] = await Promise.all([
      retentionService.generateRetentionReport(),
      breachService.checkDeadlineAlerts(),
      DataExportRequest.countDocuments({
        requestedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      User.countDocuments({ status: "pending_deletion" }),
    ]);

    const dashboard = {
      overview: {
        totalUsers: retentionReport.totalUsers,
        activeUsers: retentionReport.activeUsers,
        pendingDeletions,
        recentExports,
      },
      alerts: {
        overdueBreaches: overdueBreaches.length,
        breachesRequiringAction: overdueBreaches,
      },
      retention: {
        inactiveUsers: retentionReport.inactiveUsers,
        expiredTokens: retentionReport.expiredTokens,
        expiredOTPs: retentionReport.expiredOTPs,
      },
      consent: {
        totalRecords: retentionReport.consentRecords,
        exportRequests: retentionReport.exportRequests,
      },
    };

    return successResponse(res, dashboard, "Dashboard data retrieved");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBreach,
  getBreaches,
  getBreach,
  notifyUsers,
  generateReport,
  markReported,
  resolveBreach,
  checkDeadlines,
  runRetentionTasks,
  getRetentionReport,
  getConsentStats,
  getExportStats,
  getDeletionRequests,
  processDeletionRequest,
  getDashboard,
};
