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
      required: function () {
        // Password is required only if user is not using social login
        return !this.socialAuth || Object.keys(this.socialAuth).length === 0;
      },
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
      enum: ["teacher", "school", "recruiter", "supplier", "admin"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "pending",
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
    lastActive: {
      type: Date,
      default: Date.now,
    },
    socialAuth: {
      google: {
        id: {
          type: String,
          sparse: true,
        },
        email: {
          type: String,
          lowercase: true,
          trim: true,
        },
      },
      facebook: {
        id: {
          type: String,
          sparse: true,
        },
        email: {
          type: String,
          lowercase: true,
          trim: true,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// Note: email index is automatically created by unique: true constraint
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ lastActive: 1 });
userSchema.index({ "socialAuth.google.id": 1 });
userSchema.index({ "socialAuth.facebook.id": 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual populate for teacher profile
userSchema.virtual("teacherProfile", {
  ref: "TeacherProfile",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Virtual populate for school profile
userSchema.virtual("schoolProfile", {
  ref: "SchoolProfile",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    return false; // Social login users don't have passwords
  }
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
