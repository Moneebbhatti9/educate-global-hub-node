# Educate Global Hub Backend API

A comprehensive education platform API for connecting schools, teachers, and educational resources with a clean, scalable architecture.

## 🏗️ Project Structure

```
project-root/
│── src/
│   ├── config/                    # Configuration files
│   │   ├── db.js                  # MongoDB connection
│   │   ├── jwt.config.js          # JWT + Refresh token setup
│   │   ├── nodemailer.config.js   # Gmail SMTP transport
│   │   ├── socket.config.js       # Socket.IO server setup
│   │   └── swagger.config.js      # Swagger setup
│   │
│   ├── middlewares/               # Express middleware
│   │   ├── authMiddleware.js      # JWT auth verification
│   │   ├── roleMiddleware.js      # Role-based access control
│   │   ├── rateLimiter.js         # Auth / API rate limiting
│   │   └── errorHandler.js        # Centralized error handler
│   │
│   ├── models/                    # MongoDB models (to be implemented)
│   │   ├── User.js               # User model with auth fields
│   │   ├── Token.js              # Refresh token storage
│   │   ├── Notification.js       # Notifications persistence
│   │   ├── School.js             # School-specific profile
│   │   ├── Teacher.js            # Teacher-specific profile
│   │   ├── Admin.js              # Admin-specific profile
│   │   ├── Job.js                # Job listings
│   │   ├── Application.js        # Job applications
│   │   └── CV.js                 # CV/resume storage
│   │
│   ├── auth/                     # Authentication module
│   │   ├── controllers/          # Auth controllers
│   │   ├── services/             # Auth business logic
│   │   ├── routes/               # Auth routes
│   │   ├── validations/          # Input validation
│   │   └── helpers/              # Auth utilities
│   │
│   ├── roles/                    # Role-based modules
│   │   ├── school/               # School-specific features
│   │   ├── teacher/              # Teacher-specific features
│   │   ├── supplier/             # Supplier features (future)
│   │   ├── recruiter/            # Recruiter features (future)
│   │   └── admin/                # Admin management features
│   │
│   ├── notifications/            # Notification system
│   │   ├── controllers/          # Notification controllers
│   │   ├── services/             # Notification services
│   │   ├── routes/               # Notification routes
│   │   └── helpers/              # Notification utilities
│   │
│   ├── socket/                   # Real-time features
│   │   ├── socket.js             # Socket.IO server bootstrap
│   │   └── handlers/             # Socket event handlers
│   │
│   ├── docs/                     # API documentation
│   │   ├── swagger.json          # OpenAPI spec (JSON)
│   │   └── swagger.yaml          # OpenAPI spec (YAML)
│   │
│   ├── utils/                    # Utility functions
│   │   ├── responseHandler.js    # Standard API responses
│   │   ├── password.util.js      # Password hashing/comparison
│   │   └── fileUpload.util.js    # File upload utilities
│   │
│   ├── app.js                    # Express application setup
│   └── server.js                 # Server entry point
│
├── old-src/                      # Previous code (backup)
├── .env                          # Environment variables
├── package.json                  # Dependencies
└── README.md                     # This file
```

## 🚀 Features

### ✅ Implemented
- **Clean Architecture**: Modular, scalable folder structure
- **Configuration Management**: Centralized config for all services
- **Security Middleware**: JWT auth, role-based access, rate limiting
- **Error Handling**: Centralized error management
- **File Upload**: Cloudinary integration with Multer
- **Real-time**: Socket.IO setup for notifications
- **Documentation**: Swagger/OpenAPI integration
- **Utilities**: Standardized response handling, password utilities

### 🔄 In Progress
- **Authentication System**: Login, registration, email verification, OTP
- **User Models**: User, School, Teacher, Admin profiles
- **Role-based APIs**: School, Teacher, Admin specific endpoints
- **Notification System**: Real-time and email notifications

### 📋 Planned
- **Job Management**: Job posting, applications, matching
- **File Management**: CV uploads, document storage
- **Admin Panel**: User approval, content moderation
- **Advanced Features**: Search, filtering, recommendations

## 🛠️ Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- Gmail account (for SMTP)
- Cloudinary account (for file uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd educate-global-hub-node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Configure your `.env` file with:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   API_VERSION=v1

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/educate_global_hub

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Email Configuration (Gmail)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=your_email@gmail.com

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Security Configuration
   BCRYPT_SALT_ROUNDS=12
   SESSION_SECRET=your_session_secret_here

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   AUTH_RATE_LIMIT_WINDOW_MS=900000
   AUTH_RATE_LIMIT_MAX=5

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

   # File Upload Configuration
   MAX_FILE_SIZE=5242880
   ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document

   # OTP Configuration
   OTP_EXPIRY_MINUTES=10
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`
- **API Base**: `http://localhost:5000/api/v1`

## 🔐 API Naming Convention

All endpoints follow the pattern: `/api/v1/{resource}/{action}`

### Examples:
```
GET    /api/v1/auth/getCurrentUser
POST   /api/v1/auth/createUser
PATCH  /api/v1/users/:id/updateUserStatus
DELETE /api/v1/users/:id/deleteUser
```

## 🏛️ Architecture Principles

### 1. **Separation of Concerns**
- Controllers: Handle HTTP requests/responses
- Services: Business logic
- Models: Data structure and validation
- Routes: URL mapping
- Middleware: Request processing

### 2. **Role-Based Access Control**
- School: Can post jobs, manage applications
- Teacher: Can apply for jobs, manage profile
- Admin: Can approve users, moderate content
- Supplier/Recruiter: Future roles

### 3. **Security First**
- JWT authentication with refresh tokens
- Rate limiting on all endpoints
- Input validation with Joi/Zod
- Password hashing with bcrypt
- CORS protection

### 4. **Scalability**
- Modular folder structure
- Reusable middleware
- Standardized response format
- Error handling
- Logging and monitoring

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📝 Development Workflow

1. **Create new feature**: Follow the established folder structure
2. **Add validation**: Use Joi schemas in validation files
3. **Implement business logic**: In service files
4. **Handle HTTP**: In controller files
5. **Define routes**: In route files
6. **Add documentation**: Update Swagger specs
7. **Test thoroughly**: Unit and integration tests

## 🔄 Migration Status

- ✅ **Safe Migration**: Old code preserved in `old-src/`
- ✅ **New Structure**: Clean, scalable architecture implemented
- ✅ **Core Config**: Database, JWT, Email, Socket, Swagger setup
- ✅ **Middleware**: Auth, roles, rate limiting, error handling
- ✅ **Utilities**: Response handling, password, file upload
- 🔄 **Next Steps**: Implement authentication system

## 📞 Support

For questions or issues:
- Create an issue in the repository
- Contact the development team
- Check the API documentation at `/api-docs`

---

**Educate Global Hub Team** | Built with ❤️ for education
