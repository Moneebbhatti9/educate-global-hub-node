# Educate Global Hub Backend

A comprehensive backend API for the Educate Global Hub platform, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**

  - JWT-based authentication with access and refresh tokens
  - Role-based access control (Student, Teacher, School, Recruiter, Supplier, Admin)
  - Email verification with OTP
  - Password reset functionality
  - Secure password hashing with bcrypt

- **User Management**

  - User registration and profile management
  - Role-specific profile data
  - Avatar upload and management
  - Public and private profile views

- **File Management**

  - Cloudinary integration for file uploads
  - Support for images and documents
  - Automatic file optimization and transformation

- **Security Features**

  - Rate limiting and request throttling
  - CORS configuration
  - Security headers with Helmet
  - Input validation with Joi
  - SQL injection protection (MongoDB)

- **Email Services**
  - Welcome emails
  - Email verification
  - Password reset emails
  - HTML email templates

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Cloudinary
- **Email**: Nodemailer
- **Validation**: Joi
- **Security**: Helmet, bcryptjs, express-rate-limit
- **Testing**: Jest, Supertest
- **Code Quality**: ESLint

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd educate-global-hub-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   ```bash
   cp env.example .env
   ```

   Update the `.env` file with your configuration:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   API_VERSION=v1

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/educate_global_hub
   MONGODB_URI_PROD=mongodb+srv://username:password@cluster.mongodb.net/educate_global_hub

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Email Configuration
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

## 🗄 Database Setup

### MongoDB Setup

#### Option 1: Local MongoDB Installation

1. **Install MongoDB Community Edition**

   - [Download MongoDB](https://www.mongodb.com/try/download/community)
   - Follow installation instructions for your OS

2. **Start MongoDB Service**

   ```bash
   # macOS/Linux
   sudo systemctl start mongod

   # Windows
   net start MongoDB
   ```

3. **Create Database**
   ```bash
   mongosh
   use educate_global_hub
   ```

#### Option 2: MongoDB Atlas (Cloud)

1. **Create MongoDB Atlas Account**

   - Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free account

2. **Create Cluster**

   - Create a new cluster (free tier available)
   - Configure network access (IP whitelist)
   - Create database user

3. **Get Connection String**
   - Copy the connection string
   - Replace `<username>`, `<password>`, and `<cluster>` with your values
   - Update `MONGODB_URI_PROD` in your `.env` file

#### Option 3: Docker

1. **Run MongoDB Container**

   ```bash
   docker run -d \
     --name mongodb \
     -p 27017:27017 \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=password \
     mongo:latest
   ```

2. **Update Connection String**
   ```env
   MONGODB_URI=mongodb://admin:password@localhost:27017/educate_global_hub?authSource=admin
   ```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/v1/auth/signup`

Register a new user

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student"
}
```

#### POST `/api/v1/auth/login`

Authenticate user

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### POST `/api/v1/auth/send-otp`

Send OTP for email verification

```json
{
  "email": "user@example.com",
  "type": "verification"
}
```

#### POST `/api/v1/auth/verify-otp`

Verify OTP

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "type": "verification"
}
```

#### POST `/api/v1/auth/password-reset`

Send password reset email

```json
{
  "email": "user@example.com"
}
```

#### POST `/api/v1/auth/password-reset-confirm`

Reset password with OTP

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

#### POST `/api/v1/auth/refresh`

Refresh access token

```json
{
  "refreshToken": "your_refresh_token"
}
```

#### POST `/api/v1/auth/logout`

Logout user

```json
{
  "refreshToken": "your_refresh_token"
}
```

#### GET `/api/v1/auth/me`

Get current user (requires authentication)

### User Management Endpoints

#### POST `/api/v1/users/complete-profile`

Complete user profile (requires authentication)

```json
{
  "bio": "Software developer with 5 years of experience",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "roleSpecificData": {
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": "5 years"
  }
}
```

#### PUT `/api/v1/users/profile`

Update user profile (requires authentication)

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890",
  "bio": "Updated bio"
}
```

#### GET `/api/v1/users/profile`

Get current user profile (requires authentication)

#### GET `/api/v1/users/:id`

Get public user profile by ID

#### GET `/api/v1/users`

Get users list with filtering and pagination

```
GET /api/v1/users?page=1&limit=10&role=teacher&search=john&sortBy=createdAt&sortOrder=desc
```

#### PUT `/api/v1/users/avatar`

Update user avatar (requires authentication)

```json
{
  "avatarUrl": "https://res.cloudinary.com/example/image/upload/v123/avatar.jpg"
}
```

#### DELETE `/api/v1/users/account`

Delete user account (requires authentication)

### File Upload Endpoints

#### POST `/api/v1/upload/avatar`

Upload user avatar (requires authentication)

- Content-Type: `multipart/form-data`
- Field: `avatar` (file)

#### POST `/api/v1/upload/document`

Upload document (requires authentication)

- Content-Type: `multipart/form-data`
- Field: `document` (file)
- Field: `documentType` (string)

#### DELETE `/api/v1/upload/:publicId`

Delete file from Cloudinary (requires authentication)

#### GET `/api/v1/upload/preset`

Get upload preset for client-side uploads (requires authentication)

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable salt rounds
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security headers
- **File Upload Security**: File type and size validation

## 📧 Email Templates

The application includes HTML email templates for:

- Welcome emails
- Email verification
- Password reset

Templates are located in `src/config/email.js` and can be customized.

## 🧪 Testing

The project includes comprehensive tests:

- Unit tests for utilities and helpers
- Integration tests for API endpoints
- Authentication and authorization tests

Run tests with:

```bash
npm test
```

## 🚀 Deployment

### Environment Variables

Ensure all required environment variables are set in production:

- Database connection strings
- JWT secrets
- Email configuration
- Cloudinary credentials
- Security settings

### Production Considerations

- Use MongoDB Atlas or managed MongoDB service
- Set up proper logging and monitoring
- Configure SSL/TLS certificates
- Set up backup strategies
- Use environment-specific configurations

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Changelog

### v1.0.0

- Initial release
- MongoDB integration
- JWT authentication
- User management
- File upload functionality
- Email services
- Security features
