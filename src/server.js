require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const socketIo = require("socket.io");

const { connectDB } = require("./config/database");
const { errorHandler } = require("./middleware/errorHandler");
const { notFoundHandler } = require("./middleware/notFoundHandler");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const uploadRoutes = require("./routes/upload");
const teacherProfileRoutes = require("./routes/teacherProfile");
const schoolProfileRoutes = require("./routes/schoolProfile");
const jobRoutes = require("./routes/jobs");
const notificationRoutes = require("./routes/notification");
const adminRoutes = require("./routes/admin");
const teacherDashboardRoutes = require("./routes/teacherDasboard");
const schoolDashboardRoutes = require("./routes/schoolDashboard");
const adminDashboardRoutes = require("./routes/adminDashboard");
const discussionRoutes = require("./routes/discussion");
const replyRoutes = require("./routes/reply");
const adminForumRoutes = require("./routes/adminForum");
const resourceRoutes = require("./routes/resource");
const forumNotificationRoutes = require("./routes/forumNotifications");
const salesRoutes = require("./routes/sales");
const withdrawalRoutes = require("./routes/withdrawals");
const webhookRoutes = require("./routes/webhooks");
const reviewRoutes = require("./routes/reviews");
const { applyMiddlewares, applyErrorMiddlewares } = require("./middleware");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting (needed when behind reverse proxy)
app.set("trust proxy", 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "http://localhost:5173",
          "http://localhost:5000",
        ], // 👈 allow Vite frontend and local API
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: "deny" }, // adds X-Frame-Options: DENY
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "no-referrer-when-downgrade" },
  })
);

// Add Permissions-Policy manually
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  next();
});

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
});
// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Compression middleware
app.use(compression());

// Webhook routes (MUST come before body parsing middleware)
// Webhooks need raw body for signature verification
const apiVersion = process.env.API_VERSION || "v1";
app.use(
  `/api/${apiVersion}/webhooks`,
  express.raw({ type: "application/json" }),
  webhookRoutes
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply custom middlewares (including Swagger docs)
applyMiddlewares(app);

// Rate limiting (after body parsing but before routes)
app.use(limiter);
app.use(speedLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Educate Global Hub API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/upload`, uploadRoutes);
app.use(`/api/${apiVersion}/teacher-profiles`, teacherProfileRoutes);
app.use(`/api/${apiVersion}/school-profiles`, schoolProfileRoutes);
app.use(`/api/${apiVersion}/jobs`, jobRoutes);
app.use(`/api/${apiVersion}/notifications`, notificationRoutes);
app.use(`/api/${apiVersion}/admin`, adminRoutes);
app.use(`/api/${apiVersion}/teacherDashboard`, teacherDashboardRoutes);
app.use(`/api/${apiVersion}/schoolDashboard`, schoolDashboardRoutes);
app.use(`/api/${apiVersion}/adminDashboard`, adminDashboardRoutes);
app.use(`/api/${apiVersion}/discussion`, discussionRoutes);
app.use(`/api/${apiVersion}/reply`, replyRoutes);
app.use(`/api/${apiVersion}/adminForum`, adminForumRoutes);
app.use(`/api/${apiVersion}/resources`, resourceRoutes);
app.use(`/api/${apiVersion}/forum-notifications`, forumNotificationRoutes);
app.use(`/api/${apiVersion}/sales`, salesRoutes);
app.use(`/api/${apiVersion}/withdrawals`, withdrawalRoutes);
app.use(`/api/${apiVersion}/reviews`, reviewRoutes);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${apiVersion}`);
});

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * LinkedIn-style Socket.IO Event Handlers
 * Real-time updates for forum interactions
 */
io.on("connection", (socket) => {
  console.log(`✅ New client connected: ${socket.id}`);

  // User joins their personal room for notifications
  socket.on("user:join", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`👤 User ${userId} joined personal room`);
  });

  // User joins a discussion room for real-time updates
  socket.on("discussion:join", (discussionId) => {
    socket.join(`discussion:${discussionId}`);
    console.log(`📝 Socket ${socket.id} joined discussion: ${discussionId}`);
  });

  // User leaves a discussion room
  socket.on("discussion:leave", (discussionId) => {
    socket.leave(`discussion:${discussionId}`);
    console.log(`👋 Socket ${socket.id} left discussion: ${discussionId}`);
  });

  // Typing indicator for comments
  socket.on("user:typing", ({ discussionId, userId, userName }) => {
    socket.to(`discussion:${discussionId}`).emit("user:typing:indicator", {
      userId,
      userName,
    });
  });

  // Stop typing indicator
  socket.on("user:stop-typing", ({ discussionId, userId }) => {
    socket.to(`discussion:${discussionId}`).emit("user:stop-typing:indicator", {
      userId,
    });
  });

  // Track post view (for analytics)
  socket.on("post:view", async ({ discussionId, userId }) => {
    // This is handled by the REST API, but we can emit to analytics service
    console.log(`👁️ User ${userId} viewed discussion ${discussionId}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// make io accessible to controllers
app.set("io", io);

applyErrorMiddlewares(app);

// Start server

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

module.exports = app;
