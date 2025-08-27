const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Personal Information (from User model, but stored here for profile completeness)
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },

  // Contact Information
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+[1-9]\d{1,14}$/, 'Please enter a valid phone number with country code (e.g., +1234567890)']
  },

  // Location Information
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  provinceState: {
    type: String,
    required: [true, 'Province/State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^\d+$/.test(v);
      },
      message: 'Zip code must contain only numbers'
    }
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },

  // Professional Information
  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    enum: ['Bachelor', 'Master', 'PhD', 'Diploma', 'Certificate', 'Other'],
    trim: true
  },
  teachingSubjects: [{
    type: String,
    required: [true, 'At least one teaching subject is required'],
    trim: true,
    minlength: [2, 'Teaching subject must be at least 2 characters long'],
    maxlength: [50, 'Teaching subject cannot exceed 50 characters']
  }],
  yearsOfExperience: {
    type: Number,
    required: [true, 'Years of experience is required'],
    min: [0, 'Years of experience cannot be negative'],
    max: [50, 'Years of experience cannot exceed 50']
  },
  pgce: {
    type: Boolean,
    default: false
  },

  // Professional Bio
  professionalBio: {
    type: String,
    required: [true, 'Professional bio is required'],
    trim: true,
    minlength: [30, 'Professional bio must be at least 30 words'],
    maxlength: [200, 'Professional bio cannot exceed 200 words'],
    validate: {
      validator: function(v) {
        const wordCount = v.trim().split(/\s+/).length;
        return wordCount >= 30 && wordCount <= 200;
      },
      message: 'Professional bio must be between 30 and 200 words'
    }
  },

  // Achievements and Certifications
  keyAchievements: [{
    type: String,
    trim: true,
    minlength: [10, 'Achievement must be at least 10 characters long'],
    maxlength: [200, 'Achievement cannot exceed 200 characters']
  }],
  certifications: [{
    type: String,
    trim: true,
    minlength: [5, 'Certification must be at least 5 characters long'],
    maxlength: [100, 'Certification cannot exceed 100 characters']
  }],

  // Profile Status
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  profileCompletedAt: {
    type: Date,
    default: null
  },

  // Additional Information
  cvUrl: {
    type: String,
    default: null
  },
  coverLetterUrl: {
    type: String,
    default: null
  },
  references: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    position: {
      type: String,
      required: true,
      trim: true
    },
    organization: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    }
  }],

  // Preferences
  preferredLocations: [{
    type: String,
    trim: true
  }],
  preferredSalary: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  availability: {
    type: String,
    enum: ['Immediate', '2 weeks', '1 month', '3 months', 'Flexible'],
    default: 'Flexible'
  }
}, {
  timestamps: true
});

// Indexes
teacherSchema.index({ userId: 1 });
teacherSchema.index({ country: 1 });
teacherSchema.index({ city: 1 });
teacherSchema.index({ teachingSubjects: 1 });
teacherSchema.index({ yearsOfExperience: 1 });
teacherSchema.index({ isProfileComplete: 1 });

// Virtual for full name
teacherSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for experience level
teacherSchema.virtual('experienceLevel').get(function() {
  if (this.yearsOfExperience < 2) return 'Beginner';
  if (this.yearsOfExperience < 5) return 'Intermediate';
  if (this.yearsOfExperience < 10) return 'Experienced';
  return 'Senior';
});

// Pre-save middleware to update profile completion
teacherSchema.pre('save', function(next) {
  const requiredFields = [
    'firstName', 'lastName', 'phoneNumber', 'country', 'city', 
    'provinceState', 'address', 'qualification', 'teachingSubjects', 
    'yearsOfExperience', 'professionalBio'
  ];

  const isComplete = requiredFields.every(field => {
    const value = this[field];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value && value.toString().trim().length > 0;
  });

  if (isComplete && !this.isProfileComplete) {
    this.isProfileComplete = true;
    this.profileCompletedAt = new Date();
  } else if (!isComplete && this.isProfileComplete) {
    this.isProfileComplete = false;
    this.profileCompletedAt = null;
  }

  next();
});

// Static method to find by user ID
teacherSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

// Static method to find complete profiles
teacherSchema.statics.findCompleteProfiles = function() {
  return this.find({ isProfileComplete: true });
};

// Static method to search teachers
teacherSchema.statics.searchTeachers = function(criteria) {
  const query = { isProfileComplete: true };
  
  if (criteria.country) query.country = new RegExp(criteria.country, 'i');
  if (criteria.city) query.city = new RegExp(criteria.city, 'i');
  if (criteria.teachingSubjects && criteria.teachingSubjects.length > 0) {
    query.teachingSubjects = { $in: criteria.teachingSubjects };
  }
  if (criteria.minExperience) query.yearsOfExperience = { $gte: criteria.minExperience };
  if (criteria.maxExperience) query.yearsOfExperience = { ...query.yearsOfExperience, $lte: criteria.maxExperience };

  return this.find(query);
};

const Teacher = mongoose.model('Teacher', teacherSchema);

module.exports = Teacher;
