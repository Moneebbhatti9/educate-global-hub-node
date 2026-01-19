/**
 * Breach Notification Service
 *
 * Implements GDPR Article 33 & 34 requirements:
 * - Notify supervisory authority within 72 hours of breach discovery
 * - Notify affected individuals without undue delay if high risk
 * - Document all breaches
 */

const DataBreachNotification = require("../models/DataBreachNotification");
const User = require("../models/User");
const { sendEmail } = require("../config/email");
const crypto = require("crypto");

/**
 * Generate unique breach ID
 */
const generateBreachId = () => {
  return `BREACH-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

/**
 * Create a new breach notification
 */
const createBreachNotification = async (breachData, createdBy) => {
  const breach = new DataBreachNotification({
    breachId: generateBreachId(),
    title: breachData.title,
    description: breachData.description,
    breachDate: breachData.breachDate,
    discoveredAt: breachData.discoveredAt || new Date(),
    severity: breachData.severity,
    dataTypesAffected: breachData.dataTypesAffected,
    affectedUsers: breachData.affectedUsers || [],
    estimatedAffectedCount: breachData.estimatedAffectedCount || 0,
    isGlobalNotification: breachData.isGlobalNotification || false,
    immediateActions: breachData.immediateActions || [],
    recommendedUserActions: breachData.recommendedUserActions || [],
    mitigationSteps: breachData.mitigationSteps || [],
    contactEmail: breachData.contactEmail || "gdpr@educatelink.com",
    contactPhone: breachData.contactPhone,
    status: "draft",
    createdBy,
  });

  await breach.save();
  return breach;
};

/**
 * Send breach notification to affected users
 */
const notifyAffectedUsers = async (breachId) => {
  const breach = await DataBreachNotification.findOne({ breachId });

  if (!breach) {
    throw new Error("Breach notification not found");
  }

  // Get affected users
  let usersToNotify = [];

  if (breach.isGlobalNotification) {
    // Notify all users
    usersToNotify = await User.find({ status: "active" }).select("email firstName lastName");
  } else if (breach.affectedUsers && breach.affectedUsers.length > 0) {
    // Notify specific users
    usersToNotify = await User.find({
      _id: { $in: breach.affectedUsers },
    }).select("email firstName lastName");
  }

  console.log(`Notifying ${usersToNotify.length} users about breach ${breachId}`);

  breach.status = "notifying";
  await breach.save();

  let successCount = 0;
  let failCount = 0;

  for (const user of usersToNotify) {
    try {
      await sendBreachEmail(user, breach);
      successCount++;
    } catch (error) {
      console.error(`Failed to notify user ${user.email}:`, error);
      failCount++;
    }
  }

  // Update breach status
  breach.status = "notified";
  breach.notifiedAt = new Date();
  await breach.save();

  return {
    totalUsers: usersToNotify.length,
    successCount,
    failCount,
  };
};

/**
 * Send breach notification email to a user
 */
const sendBreachEmail = async (user, breach) => {
  const dataTypesFormatted = breach.dataTypesAffected
    .map((type) => type.replace(/_/g, " "))
    .join(", ");

  const recommendedActionsHtml = breach.recommendedUserActions
    .map((action) => `<li>${action}</li>`)
    .join("");

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">Important Security Notice</h2>

      <p>Dear ${user.firstName},</p>

      <p>We are writing to inform you about a data security incident that may affect your personal information.</p>

      <h3>What Happened</h3>
      <p>${breach.description}</p>

      <h3>What Information Was Involved</h3>
      <p>The following types of data may have been affected: <strong>${dataTypesFormatted}</strong></p>

      <h3>What We Are Doing</h3>
      <ul>
        ${breach.immediateActions.map((action) => `<li>${action}</li>`).join("")}
      </ul>

      <h3>What You Can Do</h3>
      <ul>
        ${recommendedActionsHtml}
      </ul>

      <h3>For More Information</h3>
      <p>If you have any questions or concerns, please contact us:</p>
      <ul>
        <li>Email: ${breach.contactEmail}</li>
        ${breach.contactPhone ? `<li>Phone: ${breach.contactPhone}</li>` : ""}
      </ul>

      <p>We sincerely apologize for any inconvenience this may cause and appreciate your understanding.</p>

      <p>Best regards,<br>
      Educate Global Hub Security Team</p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">
        Breach Reference: ${breach.breachId}<br>
        Breach Date: ${new Date(breach.breachDate).toLocaleDateString()}<br>
        This notice is sent in compliance with GDPR Article 34.
      </p>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `[Security Notice] ${breach.title} - Educate Global Hub`,
    html: emailContent,
  });
};

/**
 * Generate breach report for supervisory authority
 */
const generateSupervisoryAuthorityReport = async (breachId) => {
  const breach = await DataBreachNotification.findOne({ breachId });

  if (!breach) {
    throw new Error("Breach notification not found");
  }

  const report = {
    reportGeneratedAt: new Date().toISOString(),
    breachReference: breach.breachId,

    // Section 1: Nature of the breach
    section1_NatureOfBreach: {
      dateOfBreach: breach.breachDate,
      dateDiscovered: breach.discoveredAt,
      description: breach.description,
      categoriesOfDataAffected: breach.dataTypesAffected,
      approximateNumberOfDataSubjects: breach.estimatedAffectedCount,
      categoriesOfDataSubjects: ["Registered users of the platform"],
    },

    // Section 2: Name and contact details of DPO
    section2_DPOContact: {
      name: "Data Protection Officer",
      email: "dpo@educatelink.com",
      phone: "+44 XXX XXX XXXX",
      address: "Your Company Address",
    },

    // Section 3: Likely consequences
    section3_LikelyConsequences: {
      severity: breach.severity,
      potentialImpact:
        breach.severity === "critical" || breach.severity === "high"
          ? "High risk to rights and freedoms of data subjects"
          : "Limited risk to data subjects",
      specificRisks: breach.dataTypesAffected.includes("authentication_credentials")
        ? ["Identity theft", "Unauthorized account access", "Phishing attacks"]
        : ["Potential disclosure of personal information"],
    },

    // Section 4: Measures taken
    section4_MeasuresTaken: {
      immediateActions: breach.immediateActions,
      mitigationSteps: breach.mitigationSteps,
      futurePreventionMeasures: [
        "Security audit and penetration testing",
        "Enhanced monitoring systems",
        "Staff security training update",
        "Review of access controls",
      ],
    },

    // Section 5: Communication to data subjects
    section5_DataSubjectCommunication: {
      willDataSubjectsBeInformed: breach.severity !== "low",
      reasoningIfNot:
        breach.severity === "low"
          ? "The breach is unlikely to result in a risk to the rights and freedoms of natural persons"
          : null,
      methodOfCommunication: ["Email notification"],
      dateOfNotification: breach.notifiedAt,
      contentOfCommunication: breach.recommendedUserActions,
    },

    // Additional information
    additionalInformation: {
      dataControllerName: "Educate Global Hub",
      registrationNumber: "Your Registration Number",
      notificationSubmittedBy: "Data Protection Officer",
    },
  };

  return report;
};

/**
 * Mark breach as reported to supervisory authority
 */
const markAsReportedToAuthority = async (breachId, referenceNumber) => {
  const breach = await DataBreachNotification.findOneAndUpdate(
    { breachId },
    {
      supervisoryAuthorityNotified: true,
      supervisoryAuthorityNotifiedAt: new Date(),
      supervisoryAuthorityReference: referenceNumber,
    },
    { new: true }
  );

  return breach;
};

/**
 * Resolve a breach
 */
const resolveBreach = async (breachId, resolutionNotes) => {
  const breach = await DataBreachNotification.findOneAndUpdate(
    { breachId },
    {
      status: "resolved",
      resolvedAt: new Date(),
      resolutionNotes,
    },
    { new: true }
  );

  return breach;
};

/**
 * Get all breaches with pagination
 */
const getBreaches = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    severity,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = {};
  if (status) query.status = status;
  if (severity) query.severity = severity;

  const total = await DataBreachNotification.countDocuments(query);
  const breaches = await DataBreachNotification.find(query)
    .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("createdBy", "firstName lastName email");

  return {
    breaches,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get breach by ID
 */
const getBreachById = async (breachId) => {
  return DataBreachNotification.findOne({ breachId })
    .populate("createdBy", "firstName lastName email")
    .populate("affectedUsers", "firstName lastName email");
};

/**
 * Check if 72-hour deadline is approaching
 */
const checkDeadlineAlerts = async () => {
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const overdueBreachers = await DataBreachNotification.find({
    discoveredAt: { $lte: seventyTwoHoursAgo },
    supervisoryAuthorityNotified: false,
    status: { $ne: "closed" },
  });

  return overdueBreachers;
};

module.exports = {
  createBreachNotification,
  notifyAffectedUsers,
  sendBreachEmail,
  generateSupervisoryAuthorityReport,
  markAsReportedToAuthority,
  resolveBreach,
  getBreaches,
  getBreachById,
  checkDeadlineAlerts,
};
