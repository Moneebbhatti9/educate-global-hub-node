const nodemailer = require("nodemailer");
const { getEmailTemplate } = require("../utils/templateEngine");

// Create transporter
const createTransporter = () =>
  nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

// Email subjects
const emailSubjects = {
  verification: "Verify Your Email - Educate Global Hub",
  passwordReset: "Password Reset Request - Educate Global Hub",
  welcome: "Welcome to Educate Global Hub! 🎉",
  applicationConfirmation:
    "Application Submitted Successfully - Educate Global Hub",
  newApplicationNotification:
    "New Job Application Received - Educate Global Hub",
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
    console.log("Email sent successfully:", result.messageId);
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

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendApplicationConfirmationEmail,
  sendNewApplicationNotificationEmail,
};
