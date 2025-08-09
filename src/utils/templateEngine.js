const fs = require("fs").promises;
const path = require("path");

// Template cache to avoid reading files repeatedly
const templateCache = new Map();

/**
 * Load and cache HTML template
 * @param {string} templateName - Name of the template file (without .html extension)
 * @returns {Promise<string>} - HTML template content
 */
const loadTemplate = async (templateName) => {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  try {
    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "emails",
      `${templateName}.html`
    );
    const templateContent = await fs.readFile(templatePath, "utf8");
    templateCache.set(templateName, templateContent);
    return templateContent;
  } catch (error) {
    throw new Error(`Template not found: ${templateName}`);
  }
};

/**
 * Replace template variables with actual values
 * @param {string} template - HTML template string
 * @param {Object} variables - Object containing variable values
 * @returns {string} - Processed HTML
 */
const processTemplate = (template, variables = {}) => {
  let processedTemplate = template;

  // Replace all {{variable}} placeholders with actual values
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    processedTemplate = processedTemplate.replace(placeholder, value || "");
  });

  return processedTemplate;
};

/**
 * Get processed email template
 * @param {string} templateName - Name of the template
 * @param {Object} variables - Variables to substitute
 * @returns {Promise<string>} - Processed HTML email
 */
const getEmailTemplate = async (templateName, variables = {}) => {
  const template = await loadTemplate(templateName);
  return processTemplate(template, variables);
};

/**
 * Clear template cache (useful for development)
 */
const clearCache = () => {
  templateCache.clear();
};

module.exports = {
  loadTemplate,
  processTemplate,
  getEmailTemplate,
  clearCache,
};
