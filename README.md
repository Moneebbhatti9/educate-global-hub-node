# Educate Global Hub - Backend API

A robust, secure, and scalable REST API for the Educate Global Hub platform. Built with Node.js, Express, and MongoDB.

## Overview

This backend API powers the Educate Global Hub platform, providing:
- User authentication and authorization
- Job posting and application management
- Resource marketplace with Stripe payments
- Real-time notifications via Socket.io
- GDPR-compliant data handling

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js >= 18 | Runtime |
| Express.js | Web Framework |
| MongoDB | Database |
| Mongoose | ODM |
| JWT | Authentication |
| Bcrypt | Password Hashing |
| Stripe | Payment Processing |
| Cloudinary | File Storage |
| Socket.io | Real-time Communication |
| Nodemailer | Email Service |
| Helmet | Security Headers |
| Swagger | API Documentation |

## Features

### Authentication & Authorization
- Email/password authentication with OTP verification
- JWT access tokens (60 min) + refresh tokens (7 days)
- Role-based access control (Teacher, School, Admin)
- Password reset via email OTP

### User Management
- Complete profile management for teachers and schools
- Avatar upload via Cloudinary
- Account deletion with GDPR compliance

### Job Management
- Job posting (schools)
- Job search with filters
- Application submission and tracking
- Saved jobs functionality

### Resource Marketplace
- Upload and sell educational resources
- Stripe Connect for seller payouts
- Purchase and download system
- Review and rating system

### Forum
- Discussion threads
- Replies with real-time updates
- Notifications for replies

### GDPR Compliance
- User data export (Article 20)
- Account deletion requests (Article 17)
- Consent recording and history
- Breach notification system
- Data retention policies

### Security
- Helmet.js security headers
- Rate limiting and speed limiting
- CORS configuration
- Input validation with Joi
- SQL injection prevention
- XSS protection

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- Cloudinary account
- Stripe account (for payments)
- Gmail account (for emails)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/educate-global-hub-node.git
cd educate-global-hub-node
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables (see [Environment Variables](#environment-variables))

5. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start production server |
| `npm run start:prod` | Start production (omit dev dependencies) |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run create-admin` | Create admin user |

## Project Structure

```
src/
├── config/
│   ├── database.js      # MongoDB connection
│   ├── cloudinary.js    # Cloudinary configuration
│   ├── email.js         # Nodemailer configuration
│   └── stripe.js        # Stripe configuration
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── jobController.js
│   ├── gdprController.js
│   ├── adminGdprController.js
│   └── ...
├── middleware/
│   ├── auth.js          # JWT authentication
│   ├── validation.js    # Request validation
│   ├── errorHandler.js  # Error handling
│   └── ...
├── models/
│   ├── User.js
│   ├── Job.js
│   ├── ConsentRecord.js
│   ├── DataBreachNotification.js
│   └── ...
├── routes/
│   ├── auth.js
│   ├── user.js
│   ├── jobs.js
│   ├── gdpr.js
│   ├── adminGdpr.js
│   └── ...
├── services/
│   ├── dataRetentionService.js
│   ├── breachNotificationService.js
│   └── ...
├── utils/
│   ├── response.js      # Standardized responses
│   ├── auth.js          # Auth utilities
│   └── ...
├── docs/
│   └── DATA_PROCESSING_RECORDS.md
└── server.js            # Entry point
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
API_VERSION=v1

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_EXPIRES_IN=60m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@yourdomain.com

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security Configuration
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your_session_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# OTP Configuration
OTP_EXPIRY_MINUTES=10

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

## API Documentation

### Swagger UI

Access the interactive API documentation at:
```
http://localhost:5000/api-docs
```

### Main Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Register new user |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/verify-otp` | Verify email OTP |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/change-password` | Change password |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/profile` | Get current user profile |
| PUT | `/api/v1/users/profile` | Update profile |
| POST | `/api/v1/users/complete-profile` | Complete profile setup |
| DELETE | `/api/v1/users/account` | Delete account |

#### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/jobs` | List all jobs |
| GET | `/api/v1/jobs/:id` | Get job details |
| POST | `/api/v1/jobs` | Create job (School) |
| PUT | `/api/v1/jobs/:id` | Update job (School) |
| DELETE | `/api/v1/jobs/:id` | Delete job (School) |

#### GDPR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gdpr/rights` | Get GDPR rights info |
| GET | `/api/v1/gdpr/export-data` | Export user data |
| POST | `/api/v1/gdpr/request-deletion` | Request account deletion |
| POST | `/api/v1/gdpr/consent` | Record consent |
| GET | `/api/v1/gdpr/consent-history` | Get consent history |

#### Admin GDPR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/gdpr/dashboard` | GDPR compliance dashboard |
| POST | `/api/v1/admin/gdpr/breaches` | Create breach notification |
| POST | `/api/v1/admin/gdpr/breaches/:id/notify` | Notify affected users |
| POST | `/api/v1/admin/gdpr/retention/run` | Run retention tasks |

## GDPR Compliance

This API includes comprehensive GDPR compliance features:

### User Rights Implementation
- **Right of Access (Article 15)**: `GET /api/v1/gdpr/export-data`
- **Right to Rectification (Article 16)**: `POST /api/v1/gdpr/rectification-request`
- **Right to Erasure (Article 17)**: `POST /api/v1/gdpr/request-deletion`
- **Right to Data Portability (Article 20)**: `GET /api/v1/gdpr/export-data`

### Data Retention
Automated data retention service handles:
- Pending deletion processing (30 days)
- Expired OTP cleanup (24 hours)
- Expired token cleanup
- Inactive user warnings
- Analytics data anonymization (26 months)

### Breach Notification
- Breach creation and documentation
- User notification via email
- Supervisory authority report generation
- 72-hour deadline tracking

### Documentation
See `src/docs/DATA_PROCESSING_RECORDS.md` for complete GDPR Article 30 documentation.

## Security

### Headers (Helmet.js)
- Content Security Policy
- X-Frame-Options: DENY
- HSTS (2 years)
- Referrer-Policy
- Permissions-Policy

### Rate Limiting
- 100 requests per 15 minutes per IP
- 5 auth attempts per 15 minutes
- Speed limiting after 50 requests

### Password Security
- Bcrypt hashing with 12 salt rounds
- Password complexity validation
- Secure password reset flow

## Deployment

### Build for Production

```bash
npm run start:prod
```

### Deploy to Railway

1. Connect your GitHub repository
2. Set environment variables
3. Deploy

### Deploy to Render

1. Create a new Web Service
2. Connect your repository
3. Set environment variables
4. Build command: `npm install`
5. Start command: `npm start`

### Health Check

```
GET /health
```

Returns:
```json
{
  "success": true,
  "message": "Educate Global Hub API is running",
  "timestamp": "2025-01-19T00:00:00.000Z",
  "environment": "production"
}
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Creating Admin User

```bash
npm run create-admin
```

Follow the prompts to create an admin user.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Related

- [Frontend Repository](../educate-global-hub) - React/Vite frontend
- [API Documentation](http://localhost:5000/api-docs) - Swagger UI

## Support

For support, email support@educatelink.com or create an issue on GitHub.
