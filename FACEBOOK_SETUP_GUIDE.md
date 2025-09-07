# Facebook OAuth Setup Guide

This guide provides detailed step-by-step instructions for setting up Facebook Login in the Facebook Developer Console.

## Prerequisites

- Facebook account
- Access to Facebook Developers
- Your application's callback URLs

## Step 1: Create a Facebook App

1. **Go to Facebook Developers**

   - Visit [https://developers.facebook.com/](https://developers.facebook.com/)
   - Sign in with your Facebook account

2. **Create a New App**

   - Click "My Apps" in the top navigation
   - Click "Create App"
   - Select "Consumer" as the app type
   - Click "Next"

3. **Fill in App Details**

   - **App name**: `Educate Global Hub`
   - **App contact email**: Your email address
   - **App purpose**: Select "Education" or "Other"
   - Click "Create App"

4. **Complete Security Check**
   - Complete any security verification if prompted
   - Your app will be created and you'll be redirected to the app dashboard

## Step 2: Add Facebook Login Product

1. **Navigate to App Dashboard**

   - You should be on your app's dashboard
   - If not, go to [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/) and select your app

2. **Add Facebook Login**

   - In the "Add a Product" section, find "Facebook Login"
   - Click "Set Up" on the Facebook Login card

3. **Choose Platform**

   - Select "Web" as your platform
   - Click "Next"

4. **Enter Site URL**
   - **Site URL**:
     - Development: `http://localhost:5000`
     - Production: `https://yourdomain.com`
   - Click "Save"

## Step 3: Configure Facebook Login Settings

1. **Go to Facebook Login Settings**

   - In the left sidebar, click "Facebook Login" → "Settings"

2. **Configure Valid OAuth Redirect URIs**

   - In the "Valid OAuth Redirect URIs" section, click "Add URI"
   - Add the following URLs:
     - `http://localhost:5000/api/v1/auth/facebook/callback` (for development)
     - `https://yourdomain.com/api/v1/auth/facebook/callback` (for production)
   - Click "Save Changes"

3. **Configure Client OAuth Settings**
   - **Use Strict Mode for Redirect URIs**: Enable this for security
   - **Enforce HTTPS**: Enable for production
   - **Valid OAuth Redirect URIs**: Should match what you added above

## Step 4: Configure App Settings

1. **Go to App Settings**

   - In the left sidebar, click "Settings" → "Basic"

2. **Add App Domains**

   - In the "App Domains" section, add:
     - `localhost` (for development)
     - `yourdomain.com` (for production)

3. **Add Website URL**

   - In the "Website" section, add:
     - Development: `http://localhost:5000`
     - Production: `https://yourdomain.com`

4. **Privacy Policy URL**

   - Add your privacy policy URL (required for production)
   - Development: You can use a placeholder like `http://localhost:5000/privacy`

5. **Terms of Service URL**

   - Add your terms of service URL (required for production)
   - Development: You can use a placeholder like `http://localhost:5000/terms`

6. **Save Changes**
   - Click "Save Changes" at the bottom of the page

## Step 5: Get App Credentials

1. **Find App ID and App Secret**
   - In "Settings" → "Basic", you'll find:
     - **App ID**: Copy this value
     - **App Secret**: Click "Show" and copy this value
   - ⚠️ **Important**: Keep these credentials secure and never commit them to version control

## Step 6: Configure Permissions

1. **Go to App Review**

   - In the left sidebar, click "App Review" → "Permissions and Features"

2. **Review Required Permissions**

   - The following permissions are usually approved automatically:
     - `email` - Access user's email address
     - `public_profile` - Access user's public profile information

3. **Request Additional Permissions (if needed)**
   - If you need additional permissions, click "Request" next to them
   - Follow Facebook's review process

## Step 7: Configure Environment Variables

Add the following to your `.env` file:

```env
# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/v1/auth/facebook/callback
```

For production, update the redirect URI:

```env
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/v1/auth/facebook/callback
```

## Step 8: Test Your Configuration

1. **Start Your Backend Server**

   ```bash
   npm run dev
   ```

2. **Test the OAuth Flow**
   - Visit: `http://localhost:5000/api/v1/auth/facebook`
   - You should be redirected to Facebook's OAuth consent screen
   - After authorization, you should be redirected back to your application

## Step 9: Production Setup

### 1. Update App Settings

- Go to "Settings" → "Basic"
- Update all URLs to use your production domain
- Ensure HTTPS is enforced

### 2. Submit for App Review

- Go to "App Review" → "Permissions and Features"
- Submit your app for review if you need additional permissions
- This removes the "App Not Verified" warning

### 3. Configure Business Verification

- For production apps, you may need to verify your business
- Go to "Settings" → "Business Verification"
- Follow Facebook's verification process

## Troubleshooting

### Common Issues

1. **"Invalid OAuth access token"**

   - Verify your App ID and App Secret are correct
   - Ensure the app is not in development mode restrictions

2. **"Redirect URI mismatch"**

   - Ensure the redirect URI in your environment variables exactly matches what's configured in Facebook Console
   - Check for trailing slashes and protocol (http vs https)

3. **"App not verified"**

   - This is normal for development
   - For production, submit your app for verification

4. **"Permissions error"**

   - Check that you've requested the necessary permissions
   - Some permissions require app review

5. **"App in development mode"**
   - Add test users in "Roles" → "Test Users"
   - Or submit your app for review to make it public

### Debug Steps

1. **Check Facebook Developer Console**

   - Verify your app settings are correct
   - Check that Facebook Login is properly configured
   - Ensure redirect URIs match exactly

2. **Check Environment Variables**

   - Ensure all Facebook OAuth variables are set correctly
   - Verify App ID and App Secret are correct

3. **Check Backend Logs**

   - Look for OAuth-related errors
   - Verify Passport configuration

4. **Use Facebook Graph API Explorer**
   - Use [Graph API Explorer](https://developers.facebook.com/tools/explorer/) to test your app's permissions

### App Review Process

1. **Prepare Your App**

   - Ensure your app is fully functional
   - Add proper privacy policy and terms of service
   - Test all requested permissions

2. **Submit for Review**

   - Go to "App Review" → "Permissions and Features"
   - Click "Request" next to permissions you need
   - Provide detailed explanations for why you need each permission

3. **Provide Screenshots**
   - Show how each permission will be used in your app
   - Provide step-by-step instructions for reviewers

## Security Best Practices

1. **Keep Credentials Secure**

   - Never commit OAuth credentials to version control
   - Use environment variables for all sensitive data
   - Rotate App Secret regularly

2. **Use HTTPS in Production**

   - Facebook requires HTTPS for production OAuth flows
   - Ensure your production domain has a valid SSL certificate

3. **Limit Permissions**

   - Only request the permissions you actually need
   - Review and remove unused permissions regularly

4. **Monitor Usage**

   - Check Facebook Analytics for your app
   - Monitor for unusual activity

5. **Implement Proper Error Handling**
   - Handle OAuth errors gracefully
   - Provide clear error messages to users

## Additional Resources

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Facebook Developers Console](https://developers.facebook.com/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Facebook App Review Guidelines](https://developers.facebook.com/docs/app-review/)

## Testing with Test Users

1. **Create Test Users**

   - Go to "Roles" → "Test Users"
   - Click "Add Test Users"
   - Create test users for development

2. **Test OAuth Flow**
   - Use test user accounts to test the OAuth flow
   - This allows you to test without affecting real users

---

**Note**: Facebook's policies and requirements may change. Always refer to the official Facebook Developer documentation for the most up-to-date information.
