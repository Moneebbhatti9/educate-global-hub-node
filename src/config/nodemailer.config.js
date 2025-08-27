const nodemailer = require('nodemailer');

// Create transporter for Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Use App Password for Gmail
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Email configuration
const emailConfig = {
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  replyTo: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  subjectPrefix: '[Educate Global Hub] ',
  
  // Email templates configuration
  templates: {
    verification: {
      subject: 'Email Verification - Educate Global Hub',
      template: 'verification'
    },
    welcome: {
      subject: 'Welcome to Educate Global Hub',
      template: 'welcome'
    },
    passwordReset: {
      subject: 'Password Reset Request',
      template: 'password-reset'
    },
    otp: {
      subject: 'OTP Verification Code',
      template: 'otp'
    },
    adminApproval: {
      subject: 'Account Approval Status',
      template: 'admin-approval'
    }
  }
};

// Verify transporter connection
const verifyConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email transporter verification failed:', error.message);
    return false;
  }
};

// Send email function
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: emailConfig.from,
      to: options.to,
      subject: emailConfig.subjectPrefix + options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

module.exports = {
  createTransporter,
  emailConfig,
  verifyConnection,
  sendEmail
};
