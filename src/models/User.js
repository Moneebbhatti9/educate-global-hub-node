const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { isValidPhoneNumber } = require("../utils/phoneUtils");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["student", "teacher", "school", "recruiter", "supplier", "admin"],
      default: "student",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
      validate: {
        validator: function (value) {
          // Allow null/undefined values (optional field)
          if (!value) return true;
          return isValidPhoneNumber(value);
        },
        message: "Phone number must include country code (e.g., +1234567890)",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isEmailVerified: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to hash password
userSchema.methods.hashPassword = async function (password) {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

// Pre-save middleware to hash password if modified
userSchema.pre("save", async function (next) {
  if (this.isModified("passwordHash")) {
    // Password is already hashed when passed to this model
    next();
  } else {
    next();
  }
});

// Pre-save middleware to ensure phone number has country code
userSchema.pre("save", function (next) {
  if (this.phone && !this.phone.startsWith("+")) {
    // If phone number doesn't start with +, we can't auto-format without country info
    // This will be caught by the validation and show an error
    next();
  } else {
    next();
  }
});

// Method to sanitize user data for response
userSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

module.exports = mongoose.model("User", userSchema);
