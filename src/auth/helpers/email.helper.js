const { sendEmail } = require('../../config/nodemailer.config');
const fs = require('fs');
const path = require('path');
const { EmailError } = require('../../utils/customErrors');

/**
 * Email Helper Functions
 * Handles email templates and sending various types of emails
 */

// Function to read email template
const readEmailTemplate = (templateName) => {
  try {
    const templatePath = path.join(__dirname, '../../templates/emails', `${templateName}.html`);
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error reading template ${templateName}:`, error.message);
    return null;
  }
};

// Function to replace template variables
const replaceTemplateVariables = (template, variables) => {
  let result = template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key]);
  });
  return result;
};

/**
 * Send OTP email
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose of OTP (verification, reset, etc.)
 * @returns {Promise<Object>} - Email sending result
 */
const sendOtpEmail = async (to, otp, purpose = 'verification') => {
  const subject = purpose === 'reset' 
    ? 'Password Reset OTP - Educate Global Hub'
    : 'Email Verification OTP - Educate Global Hub';

  // Read the verification template
  let template = readEmailTemplate('verification');
  
  if (!template) {
    // Fallback to simple HTML if template not found
    template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .otp-box { background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .warning { background: #FFF3CD; border: 1px solid #FFEAA7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Educate Global Hub</h1>
          </div>
          <div class="content">
            <h2>${purpose === 'reset' ? 'Password Reset' : 'Email Verification'}</h2>
            <p>Hello!</p>
            <p>You have requested ${purpose === 'reset' ? 'a password reset' : 'email verification'} for your Educate Global Hub account.</p>
            
            <div class="otp-box">
              <p>Your verification code is:</p>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in 10 minutes.</p>
            </div>
            
            <div class="warning">
              <strong>Security Notice:</strong>
              <ul>
                <li>Never share this code with anyone</li>
                <li>Educate Global Hub will never ask for this code via phone or email</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>The Educate Global Hub Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Educate Global Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Replace template variables
  const html = replaceTemplateVariables(template, {
    userName: to.split('@')[0], // Use email prefix as username
    otp: otp
  });

  const text = `
    Educate Global Hub - ${subject}
    
    Hello!
    
    You have requested ${purpose === 'reset' ? 'a password reset' : 'email verification'} for your Educate Global Hub account.
    
    Your verification code is: ${otp}
    
    This code will expire in 10 minutes.
    
    Security Notice:
    - Never share this code with anyone
    - Educate Global Hub will never ask for this code via phone or email
    - If you didn't request this code, please ignore this email
    
    If you have any questions, please contact our support team.
    
    Best regards,
    The Educate Global Hub Team
    
    © 2024 Educate Global Hub. All rights reserved.
  `;

  try {
    return await sendEmail({
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    throw new EmailError(`Failed to send OTP email: ${error.message}`);
  }
};

/**
 * Send welcome email
 * @param {string} to - Recipient email
 * @param {string} firstName - User's first name
 * @param {string} role - User's role
 * @returns {Promise<Object>} - Email sending result
 */
const sendWelcomeEmail = async (to, firstName, role) => {
  const subject = 'Welcome to Educate Global Hub!';
  
  const roleText = {
    teacher: 'teacher looking for opportunities',
    school: 'school looking for talented educators',
    admin: 'administrator',
    supplier: 'supplier',
    recruiter: 'recruiter'
  };

  // Read the welcome template
  let template = readEmailTemplate('welcome');
  
  if (!template) {
    // Fallback to simple HTML if template not found
    template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Educate Global Hub!</h1>
          </div>
          <div class="content">
            <h2>Hello ${firstName}!</h2>
            <p>Welcome to Educate Global Hub! We're excited to have you join our community of ${roleText[role]}.</p>
            
            <p>Your account has been created successfully. Here's what you can do next:</p>
            
            <ul>
              <li>Complete your profile to get started</li>
              <li>Explore our platform features</li>
              <li>Connect with other educators and institutions</li>
              <li>Find opportunities that match your skills and interests</li>
            </ul>
            
            <p>If you have any questions or need assistance, our support team is here to help!</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
            
            <p>Best regards,<br>The Educate Global Hub Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Educate Global Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Replace template variables
  const html = replaceTemplateVariables(template, {
    userName: firstName,
    role: roleText[role],
    dashboardUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  });

  const text = `
    Welcome to Educate Global Hub!
    
    Hello ${firstName}!
    
    Welcome to Educate Global Hub! We're excited to have you join our community of ${roleText[role]}.
    
    Your account has been created successfully. Here's what you can do next:
    
    - Complete your profile to get started
    - Explore our platform features
    - Connect with other educators and institutions
    - Find opportunities that match your skills and interests
    
    If you have any questions or need assistance, our support team is here to help!
    
    Visit your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard
    
    Best regards,
    The Educate Global Hub Team
    
    © 2024 Educate Global Hub. All rights reserved.
  `;

  try {
    return await sendEmail({
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    throw new EmailError(`Failed to send welcome email: ${error.message}`);
  }
};

/**
 * Send email verification success email
 * @param {string} to - Recipient email
 * @param {string} firstName - User's first name
 * @returns {Promise<Object>} - Email sending result
 */
const sendVerificationSuccessEmail = async (to, firstName) => {
  const subject = 'Email Verified Successfully - Educate Global Hub';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .success-icon { font-size: 48px; text-align: center; color: #10B981; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verified Successfully!</h1>
        </div>
        <div class="content">
          <div class="success-icon">✓</div>
          <h2>Congratulations ${firstName}!</h2>
          <p>Your email address has been successfully verified. Your account is now active and ready to use.</p>
          
          <p>You can now:</p>
          <ul>
            <li>Complete your profile</li>
            <li>Access all platform features</li>
            <li>Start connecting with the community</li>
          </ul>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
          
          <p>Best regards,<br>The Educate Global Hub Team</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Educate Global Hub. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Email Verified Successfully - Educate Global Hub
    
    Congratulations ${firstName}!
    
    Your email address has been successfully verified. Your account is now active and ready to use.
    
    You can now:
    - Complete your profile
    - Access all platform features
    - Start connecting with the community
    
    Visit your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard
    
    Best regards,
    The Educate Global Hub Team
    
    © 2024 Educate Global Hub. All rights reserved.
  `;

  try {
    return await sendEmail({
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    throw new EmailError(`Failed to send verification success email: ${error.message}`);
  }
};

/**
 * Send password reset success email
 * @param {string} to - Recipient email
 * @param {string} firstName - User's first name
 * @returns {Promise<Object>} - Email sending result
 */
const sendPasswordResetSuccessEmail = async (to, firstName) => {
  const subject = 'Password Reset Successful - Educate Global Hub';
  
  // Read the password reset template
  let template = readEmailTemplate('password-reset');
  
  if (!template) {
    // Fallback to simple HTML if template not found
    template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .success-icon { font-size: 48px; text-align: center; color: #10B981; }
          .warning { background: #FFF3CD; border: 1px solid #FFEAA7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful!</h1>
          </div>
          <div class="content">
            <div class="success-icon">✓</div>
            <h2>Hello ${firstName}!</h2>
            <p>Your password has been successfully reset. You can now log in to your account with your new password.</p>
            
            <div class="warning">
              <strong>Security Notice:</strong>
              <p>If you didn't request this password reset, please contact our support team immediately.</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">Login Now</a>
            
            <p>Best regards,<br>The Educate Global Hub Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Educate Global Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Replace template variables
  const html = replaceTemplateVariables(template, {
    userName: firstName,
    loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  });

  const text = `
    Password Reset Successful - Educate Global Hub
    
    Hello ${firstName}!
    
    Your password has been successfully reset. You can now log in to your account with your new password.
    
    Security Notice:
    If you didn't request this password reset, please contact our support team immediately.
    
    Login: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login
    
    Best regards,
    The Educate Global Hub Team
    
    © 2024 Educate Global Hub. All rights reserved.
  `;

  try {
    return await sendEmail({
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    throw new EmailError(`Failed to send password reset success email: ${error.message}`);
  }
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendVerificationSuccessEmail,
  sendPasswordResetSuccessEmail
};
