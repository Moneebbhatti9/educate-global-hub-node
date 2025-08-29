const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Educate Global Hub API",
      version: "1.0.0",
      description: "A comprehensive API for the Educate Global Hub platform",
      contact: {
        name: "API Support",
        email: "support@educateglobalhub.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://api.educateglobalhub.com"
            : `http://localhost:${process.env.PORT || 3000}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format: Bearer <token>",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439011" },
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            email: {
              type: "string",
              format: "email",
              example: "john.doe@example.com",
            },
            role: {
              type: "string",
              enum: ["teacher", "school", "supplier", "recruiter", "admin"],
              example: "teacher",
            },
            status: {
              type: "string",
              enum: ["active", "inactive", "suspended"],
              example: "active",
            },
            isEmailVerified: { type: "boolean", example: false },
            isProfileComplete: { type: "boolean", example: false },
            avatarUrl: {
              type: "string",
              example: "https://example.com/avatar.jpg",
            },
            lastLogin: { type: "string", format: "date-time" },
            isAdminVerified: { type: "boolean", example: false },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Teacher: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439012" },
            userId: { type: "string", example: "507f1f77bcf86cd799439011" },
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            phoneNumber: { type: "string", example: "+1234567890" },
            country: { type: "string", example: "United States" },
            city: { type: "string", example: "New York" },
            provinceState: { type: "string", example: "NY" },
            zipCode: { type: "string", example: "10001" },
            address: { type: "string", example: "123 Main St" },
            qualification: {
              type: "string",
              enum: [
                "Bachelor",
                "Master",
                "PhD",
                "Diploma",
                "Certificate",
                "Other",
              ],
              example: "Master",
            },
            teachingSubjects: {
              type: "array",
              items: { type: "string" },
              example: ["Mathematics", "Physics"],
            },
            yearsOfExperience: { type: "number", example: 5 },
            pgce: { type: "boolean", example: true },
            professionalBio: {
              type: "string",
              example:
                "Experienced mathematics teacher with 5 years of teaching experience...",
            },
            keyAchievements: {
              type: "array",
              items: { type: "string" },
              example: [
                "Teacher of the Year 2022",
                "Published 3 research papers",
              ],
            },
            certifications: {
              type: "array",
              items: { type: "string" },
              example: ["PGCE", "TEFL Certificate"],
            },
          },
        },
        School: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439013" },
            userId: { type: "string", example: "507f1f77bcf86cd799439011" },
            schoolName: {
              type: "string",
              example: "Example International School",
            },
            schoolEmail: {
              type: "string",
              format: "email",
              example: "info@exampleinternational.edu",
            },
            schoolContactNumber: { type: "string", example: "+1234567890" },
            country: { type: "string", example: "United States" },
            city: { type: "string", example: "New York" },
            provinceState: { type: "string", example: "NY" },
            zipCode: { type: "string", example: "10001" },
            curriculum: {
              type: "array",
              items: { type: "string" },
              example: ["British Curriculum", "American Curriculum"],
            },
            schoolSize: {
              type: "string",
              enum: [
                "Small (1-100 students)",
                "Medium (101-500 students)",
                "Large (501-1000 students)",
                "Very Large (1000+ students)",
              ],
              example: "Medium (101-500 students)",
            },
            schoolType: {
              type: "string",
              enum: [
                "Public",
                "Private",
                "International",
                "Charter",
                "Religious",
              ],
              example: "International",
            },
            genderType: {
              type: "string",
              enum: ["Co-educational", "Boys only", "Girls only"],
              example: "Co-educational",
            },
            ageGroups: {
              type: "array",
              items: { type: "string" },
              example: ["Primary (3-11 years)", "Secondary (11-18 years)"],
            },
            website: {
              type: "string",
              format: "uri",
              example: "https://exampleinternational.edu",
            },
            aboutSchool: {
              type: "string",
              example:
                "Example International School is a leading educational institution...",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
            errors: {
              type: "array",
              items: { type: "string" },
              example: ["Field is required"],
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
            meta: { type: "object" },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Users",
        description: "User management operations",
      },
      {
        name: "Teachers",
        description: "Teacher profile management",
      },
      {
        name: "Schools",
        description: "School profile management",
      },
      {
        name: "Upload",
        description: "File upload operations to Cloudinary",
      },
    ],
  },
  apis: [
    "./src/auth/routes/*.js",
    "./src/roles/**/*.js",
    "./src/utils/*.js",
    "./src/notifications/routes/*.js",
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Function to generate static swagger files
const generateSwaggerFiles = () => {
  try {
    // Ensure docs directory exists
    const docsDir = path.join(__dirname, "..", "docs");
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Generate swagger.json
    const swaggerJsonPath = path.join(docsDir, "swagger.json");
    fs.writeFileSync(swaggerJsonPath, JSON.stringify(swaggerSpec, null, 2));
    console.log("📄 Generated swagger.json");

    // Generate swagger.yaml
    const swaggerYamlPath = path.join(docsDir, "swagger.yaml");
    const yamlContent = yaml.dump(swaggerSpec, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    fs.writeFileSync(swaggerYamlPath, yamlContent);
    console.log("📄 Generated swagger.yaml");
  } catch (error) {
    console.error("❌ Error generating swagger files:", error.message);
  }
};

const setupSwagger = (app) => {
  // Generate static files only if they don't exist
  const docsDir = path.join(__dirname, "..", "docs");
  const swaggerJsonPath = path.join(docsDir, "swagger.json");
  const swaggerYamlPath = path.join(docsDir, "swagger.yaml");

  if (!fs.existsSync(swaggerJsonPath) || !fs.existsSync(swaggerYamlPath)) {
    generateSwaggerFiles();
  }

  // Serve Swagger UI
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Educate Global Hub API Documentation",
      customfavIcon: "/favicon.ico",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tryItOutEnabled: true,
        requestInterceptor: (request) => {
          // Add authorization header if token exists
          const token = localStorage.getItem("authToken");
          if (token) {
            request.headers.Authorization = `Bearer ${token}`;
          }
          return request;
        },
      },
    })
  );

  // Serve static swagger files
  app.get("/api-docs/swagger.json", (req, res) => {
    const swaggerJsonPath = path.join(__dirname, "..", "docs", "swagger.json");
    res.sendFile(swaggerJsonPath);
  });

  app.get("/api-docs/swagger.yaml", (req, res) => {
    const swaggerYamlPath = path.join(__dirname, "..", "docs", "swagger.yaml");
    res.sendFile(swaggerYamlPath);
  });

  console.log("📚 Swagger UI available at /api-docs");
  console.log("📄 Static swagger files available at:");
  console.log("   - /api-docs/swagger.json");
  console.log("   - /api-docs/swagger.yaml");
};

module.exports = { swaggerSpec, setupSwagger, generateSwaggerFiles };
