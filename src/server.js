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
applyMiddlewares(app);

app.use(limiter);
app.use(speedLimiter);

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
const apiVersion = process.env.API_VERSION || "v1";
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

io.on("connection", (socket) => {
  console.log(` New client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(` Client disconnected: ${socket.id}`);
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
