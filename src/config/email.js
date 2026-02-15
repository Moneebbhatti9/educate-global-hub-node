const nodemailer = require("nodemailer");
const { getEmailTemplate } = require("../utils/templateEngine");

// Create transporter
const createTransporter = () => {
  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    throw new Error(
      "Email configuration incomplete. Please check EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables."
    );
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Email subjects
const emailSubjects = {
  verification: "Verify Your Email - Educate Global Hub",
  passwordReset: "Password Reset Request - Educate Global Hub",
  welcome: "Welcome to Educate Global Hub!",
  applicationConfirmation:
    "Application Submitted Successfully - Educate Global Hub",
  newApplicationNotification:
    "New Job Application Received - Educate Global Hub",
  resourceApprovalRejection: "Resource Status Update - Educate Global Hub",
  twoFactorAuth: "Your Verification Code - Educate Global Hub",
  kycSubmitted: "KYC Documents Received - Educate Global Hub",
  kycApproved: "KYC Approved - Welcome to Educate Global Hub!",
  kycRejected: "KYC Review Update - Action Required",
  kycResubmission: "KYC Resubmission Required - Educate Global Hub",
  adFeedback: "Ad Request Update - Educate Global Hub",
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message };
  }
};

// Send verification email
const sendVerificationEmail = async (email, userName, otp) => {
  const html = await getEmailTemplate("verification", {
    userName,
    otp,
  });

  return await sendEmail(email, emailSubjects.verification, html);
};

// Send password reset email
const sendPasswordResetEmail = async (email, userName, otp) => {
  const html = await getEmailTemplate("password-reset", {
    userName,
    otp,
  });

  return await sendEmail(email, emailSubjects.passwordReset, html);
};

// Send welcome email
const sendWelcomeEmail = async (email, userName) => {
  const html = await getEmailTemplate("welcome", {
    userName,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  });

  return await sendEmail(email, emailSubjects.welcome, html);
};

// Send application confirmation email to teacher
const sendApplicationConfirmationEmail = async (email, templateData) => {
  const html = await getEmailTemplate("application-confirmation", templateData);
  return await sendEmail(email, emailSubjects.applicationConfirmation, html);
};

// Send new application notification email to school
const sendNewApplicationNotificationEmail = async (email, templateData) => {
  const html = await getEmailTemplate(
    "new-application-notification",
    templateData
  );
  return await sendEmail(email, emailSubjects.newApplicationNotification, html);
};

const sendResourceStatusUpdateEmail = async (
  email,
  userName,
  resourceTitle,
  status
) => {
  const html = await getEmailTemplate("resource-status-update", {
    userName,
    resourceTitle,
    status: status.charAt(0).toUpperCase() + status.slice(1), // Capitalize
  });

  return await sendEmail(email, emailSubjects.resourceApprovalRejection, html);
};

// Send 2FA verification email
const send2FAEmail = async (email, userName, otp) => {
  const html = await getEmailTemplate("two-factor-auth", {
    userName,
    otp,
  });

  return await sendEmail(email, emailSubjects.twoFactorAuth, html);
};

// Send KYC submission confirmation email
const sendKYCSubmittedEmail = async (email, userName) => {
  const html = await getEmailTemplate("kyc-submitted", {
    userName,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  });

  return await sendEmail(email, emailSubjects.kycSubmitted, html);
};

// Send KYC approved email
const sendKYCApprovedEmail = async (email, userName) => {
  const html = await getEmailTemplate("kyc-approved", {
    userName,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  });

  return await sendEmail(email, emailSubjects.kycApproved, html);
};

// Send KYC rejected email
const sendKYCRejectedEmail = async (email, userName, reason) => {
  const html = await getEmailTemplate("kyc-rejected", {
    userName,
    reason,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  });

  return await sendEmail(email, emailSubjects.kycRejected, html);
};

// Send KYC resubmission required email
const sendKYCResubmissionEmail = async (email, userName, reason) => {
  const html = await getEmailTemplate("kyc-resubmission", {
    userName,
    reason,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  });

  return await sendEmail(email, emailSubjects.kycResubmission, html);
};

// Send ad feedback email (reject/changes requested)
const sendAdFeedbackEmail = async (email, userName, jobTitle, status, feedback) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const html = await getEmailTemplate("ad-feedback", {
    userName,
    jobTitle,
    status,
    feedback,
    actionUrl: `${frontendUrl}/dashboard/school/my-advertisements`,
  });

  return await sendEmail(email, emailSubjects.adFeedback, html);
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendApplicationConfirmationEmail,
  sendNewApplicationNotificationEmail,
  sendResourceStatusUpdateEmail,
  send2FAEmail,
  sendKYCSubmittedEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendKYCResubmissionEmail,
  sendAdFeedbackEmail,
};
