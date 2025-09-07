const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");
const { generateTokens } = require("../utils/auth");

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, name, photos } = profile;
        const email = emails[0].value;
        const firstName = name.givenName;
        const lastName = name.familyName;
        const avatarUrl = photos[0]?.value;

        // Check if user already exists with this Google ID
        let user = await User.findOne({ "socialAuth.google.id": id });

        if (user) {
          // Update last active
          user.lastActive = new Date();
          await user.save();
          return done(null, user);
        }

        // Check if user exists with this email
        user = await User.findOne({ email });

        if (user) {
          // Link Google account to existing user
          user.socialAuth.google = {
            id,
            email,
          };
          if (avatarUrl && !user.avatarUrl) {
            user.avatarUrl = avatarUrl;
          }
          user.lastActive = new Date();
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = new User({
          email,
          firstName,
          lastName,
          socialAuth: {
            google: {
              id,
              email,
            },
          },
          avatarUrl,
          isEmailVerified: true, // Google emails are pre-verified
          status: "active",
        });

        await user.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Facebook OAuth Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI,
      profileFields: ["id", "emails", "name", "picture.type(large)"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, name, photos } = profile;
        const email = emails[0].value;
        const firstName = name.givenName;
        const lastName = name.familyName;
        const avatarUrl = photos[0]?.value;

        // Check if user already exists with this Facebook ID
        let user = await User.findOne({ "socialAuth.facebook.id": id });

        if (user) {
          // Update last active
          user.lastActive = new Date();
          await user.save();
          return done(null, user);
        }

        // Check if user exists with this email
        user = await User.findOne({ email });

        if (user) {
          // Link Facebook account to existing user
          user.socialAuth.facebook = {
            id,
            email,
          };
          if (avatarUrl && !user.avatarUrl) {
            user.avatarUrl = avatarUrl;
          }
          user.lastActive = new Date();
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = new User({
          email,
          firstName,
          lastName,
          socialAuth: {
            facebook: {
              id,
              email,
            },
          },
          avatarUrl,
          isEmailVerified: true, // Facebook emails are pre-verified
          status: "active",
        });

        await user.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
