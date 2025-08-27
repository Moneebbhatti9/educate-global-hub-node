require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

// Import configurations
const { connectDB } = require('./config/db');
const { setupSwagger } = require('./config/swagger.config');
const { initializeSocket } = require('./config/socket.config');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { apiLimiter, speedLimiter } = require('./middlewares/rateLimiter');

// Import routes
const authRoutes = require('./auth/routes/auth.routes');
// const notificationRoutes = require('./notifications/routes/notification.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting (needed when behind reverse proxy)
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
app.use(apiLimiter);
app.use(speedLimiter);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Educate Global Hub API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
const apiVersion = process.env.API_VERSION || 'v1';
const apiPrefix = `/api/${apiVersion}`;

// Auth routes
app.use(`${apiPrefix}/auth`, authRoutes);

// Notification routes
// app.use(`${apiPrefix}/notifications`, notificationRoutes);

// Role-based routes (will be added as we implement them)
// app.use(`${apiPrefix}/schools`, require('./roles/school/routes/school.routes'));
// app.use(`${apiPrefix}/teachers`, require('./roles/teacher/routes/teacher.routes'));
// app.use(`${apiPrefix}/admin`, require('./roles/admin/routes/admin.routes'));

// Setup Swagger documentation
setupSwagger(app);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = { app, PORT };
