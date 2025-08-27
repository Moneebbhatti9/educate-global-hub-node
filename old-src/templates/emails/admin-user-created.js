const fs = require('fs');
const path = require('path');

const adminUserCreatedTemplate = (userData) => {
  const { firstName, lastName, email, role, defaultPassword } = userData;

  const roleDisplayName =
    role === "teacher"
      ? "Teacher"
      : role === "school"
      ? "School"
      : role === "recruiter"
      ? "Recruiter"
      : role === "supplier"
      ? "Supplier"
      : role;

  // Read the HTML template file
  const templatePath = path.join(__dirname, 'admin-user-created.html');
  let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

  // Replace template variables
  const frontendUrl = process.env.FRONTEND_URL || "https://educateglobalhub.com";
  
  htmlTemplate = htmlTemplate
    .replace(/{{firstName}}/g, firstName)
    .replace(/{{lastName}}/g, lastName)
    .replace(/{{email}}/g, email)
    .replace(/{{roleDisplayName}}/g, roleDisplayName)
    .replace(/{{defaultPassword}}/g, defaultPassword)
    .replace(/{{frontendUrl}}/g, frontendUrl);

  return htmlTemplate;
};

const adminUserCreatedTextTemplate = (userData) => {
  const { firstName, lastName, email, role, defaultPassword } = userData;

  const roleDisplayName =
    role === "teacher"
      ? "Teacher"
      : role === "school"
      ? "School"
      : role === "recruiter"
      ? "Recruiter"
      : role === "supplier"
      ? "Supplier"
      : role;

  return `
Welcome to Educate Global Hub!

Hello ${firstName} ${lastName},

Welcome to Educate Global Hub! Your account has been created by an administrator with the role of ${roleDisplayName}.

Your Login Credentials:
Email: ${email}
Default Password: ${defaultPassword}

IMPORTANT SECURITY NOTICE:
This is your default password. For security reasons, please change it immediately after your first login.

You can now log in to your account and start using our platform. We recommend completing your profile to get the most out of our services.

What's Next?
- Log in with your credentials
- Change your password
- Complete your profile
- Start exploring our platform

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Educate Global Hub Team

---
This email was sent to ${email} because an account was created for you on Educate Global Hub.
If you didn't expect this email, please contact our support team immediately.
  `;
};

module.exports = {
  adminUserCreatedTemplate,
  adminUserCreatedTextTemplate,
};
