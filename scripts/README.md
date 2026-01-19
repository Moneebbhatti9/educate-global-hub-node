# Admin User Creation Script

This script creates an admin user for the Educate Global Hub application.

## Usage

### Method 1: Using npm script (Recommended)

```bash
npm run create-admin
```

### Method 2: Direct execution

```bash
node scripts/createAdminUser.js
```

## Admin User Details

- **Email**: hukkhan@yahoo.co.uk
- **Password**: Admin@123
- **Role**: admin
- **Status**: active
- **Email Verified**: true
- **Profile Complete**: true

## Features

- ✅ Checks if admin user already exists
- ✅ Creates admin user with proper role and status
- ✅ Hashes password securely
- ✅ Sets email as verified and profile as complete
- ✅ Provides clear success/error messages
- ✅ Closes database connection properly

## Security Note

⚠️ **Important**: Please change the password after first login for security purposes.

## Prerequisites

- MongoDB connection must be configured in your `.env` file
- All required dependencies must be installed (`npm install`)

## Environment Variables

Make sure your `.env` file contains:

```
MONGODB_URI=your_mongodb_connection_string
BCRYPT_SALT_ROUNDS=12
```

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**

   - Check your `MONGODB_URI` in `.env` file
   - Ensure MongoDB is running

2. **Duplicate Email Error**

   - The script will show existing admin user details if already created
   - No duplicate admin will be created

3. **Permission Errors**
   - Ensure you have write permissions to the database
   - Check your MongoDB user permissions

