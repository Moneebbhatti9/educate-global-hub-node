const passport = require("passport");
const dayjs = require("dayjs");
const User = require("../models/User");
const {
  generateTokens,
  hashPassword,
  storeRefreshToken,
} = require("../utils/auth");
const {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  createdResponse,
} = require("../utils/response");

// Google OAuth login
const googleLogin = (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
};

// Google OAuth callback
const googleCallback = async (req, res, next) => {
  passport.authenticate("google", async (err, user) => {
    if (err) {
      console.error("Google OAuth error:", err);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=oauth_error`
      );
    }

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=authentication_failed`
      );
    }

    try {
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        user._id,
        user.email,
        user.role
      );

      // Store refresh token
      const refreshTokenHash = await hashPassword(refreshToken);
      const expiresAt = dayjs().add(7, "day").toDate();
      await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

      // Check if user profile is complete
      const needsProfileCompletion = !user.isProfileComplete || !user.role;

      // Redirect to frontend with tokens and profile completion status
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}&user_id=${user._id}&needs_profile=${needsProfileCompletion}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("Token generation error:", error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=token_generation_failed`
      );
    }
  })(req, res, next);
};

// Facebook OAuth login
const facebookLogin = (req, res, next) => {
  passport.authenticate("facebook", {
    scope: ["email"],
  })(req, res, next);
};

// Facebook OAuth callback
const facebookCallback = async (req, res, next) => {
  passport.authenticate("facebook", async (err, user) => {
    if (err) {
      console.error("Facebook OAuth error:", err);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=oauth_error`
      );
    }

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=authentication_failed`
      );
    }

    try {
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        user._id,
        user.email,
        user.role
      );

      // Store refresh token
      const refreshTokenHash = await hashPassword(refreshToken);
      const expiresAt = dayjs().add(7, "day").toDate();
      await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

      // Check if user profile is complete
      const needsProfileCompletion = !user.isProfileComplete || !user.role;

      // Redirect to frontend with tokens and profile completion status
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}&user_id=${user._id}&needs_profile=${needsProfileCompletion}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("Token generation error:", error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=token_generation_failed`
      );
    }
  })(req, res, next);
};

// Alternative API endpoint for social login (for mobile apps or direct API calls)
const socialLoginAPI = async (req, res, next) => {
  try {
    const { provider, accessToken } = req.body;

    if (!provider || !accessToken) {
      return errorResponse(res, "Provider and access token are required", 400);
    }

    let userProfile;

    if (provider === "google") {
      // Verify Google access token and get user profile
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );
      if (!response.ok) {
        return unauthorizedResponse(res, "Invalid Google access token");
      }
      userProfile = await response.json();
    } else if (provider === "facebook") {
      // Verify Facebook access token and get user profile
      const response = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );
      if (!response.ok) {
        return unauthorizedResponse(res, "Invalid Facebook access token");
      }
      userProfile = await response.json();
    } else {
      return errorResponse(res, "Unsupported provider", 400);
    }

    const { id, email, name, picture } = userProfile;
    const firstName = name.split(" ")[0];
    const lastName = name.split(" ").slice(1).join(" ") || "";
    const avatarUrl = picture?.data?.url || picture;

    // Check if user already exists with this social ID
    let user = await User.findOne({ [`socialAuth.${provider}.id`]: id });

    if (user) {
      // Update last active
      user.lastActive = new Date();
      await user.save();
    } else {
      // Check if user exists with this email
      user = await User.findOne({ email });

      if (user) {
        // Link social account to existing user
        user.socialAuth[provider] = { id, email };
        if (avatarUrl && !user.avatarUrl) {
          user.avatarUrl = avatarUrl;
        }
        user.lastActive = new Date();
        await user.save();
      } else {
        // Create new user
        user = new User({
          email,
          firstName,
          lastName,
          socialAuth: {
            [provider]: { id, email },
          },
          avatarUrl,
          isEmailVerified: true,
          status: "active",
        });

        await user.save();
      }
    }

    // Generate tokens
    const { accessToken: jwtAccessToken, refreshToken } = generateTokens(
      user._id,
      user.email,
      user.role
    );

    // Store refresh token
    const refreshTokenHash = await hashPassword(refreshToken);
    const expiresAt = dayjs().add(7, "day").toDate();
    await storeRefreshToken(user._id, refreshTokenHash, expiresAt);

    return successResponse(
      res,
      {
        user: user.toSafeObject(),
        accessToken: jwtAccessToken,
        refreshToken,
        needsProfileCompletion: !user.isProfileComplete || !user.role,
      },
      "Social login successful"
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleLogin,
  googleCallback,
  facebookLogin,
  facebookCallback,
  socialLoginAPI,
};
