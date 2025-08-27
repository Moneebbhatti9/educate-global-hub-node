const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // School Information
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    minlength: [2, 'School name must be at least 2 characters long'],
    maxlength: [100, 'School name cannot exceed 100 characters']
  },
  schoolEmail: {
    type: String,
    required: [true, 'School email is required'],
    trim: true,
    lowercase: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please enter a valid professional email address'
    ]
  },
  schoolContactNumber: {
    type: String,
    required: [true, 'School contact number is required'],
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

  // School Characteristics
  curriculum: {
    type: [String],
    required: [true, 'At least one curriculum is required'],
    enum: [
      "British Curriculum",
      "American Curriculum",
      "IB (International Baccalaureate)",
      "Canadian Curriculum",
      "Australian Curriculum",
      "National Curriculum",
      "Montessori",
      "Waldorf",
      "Reggio Emilia",
      "Other"
    ],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one curriculum must be selected'
    }
  },
  schoolSize: {
    type: String,
    required: [true, 'School size is required'],
    enum: [
      "Small (1-500 students)",
      "Medium (501-1000 students)",
      "Large (1001+ students)"
    ]
  },
  schoolType: {
    type: String,
    required: [true, 'School type is required'],
    enum: [
      "Public",
      "Private",
      "International",
      "Charter",
      "Religious",
      "Other"
    ]
  },
  genderType: {
    type: String,
    required: [true, 'Gender type is required'],
    enum: ["Boys Only", "Girls Only", "Mixed"]
  },
  ageGroups: {
    type: [String],
    required: [true, 'At least one age group is required'],
    enum: [
      "Early Years (2-5 years)",
      "Primary (6-11 years)",
      "Secondary (12-16 years)",
      "Sixth Form/High School (17-18 years)",
      "All Ages"
    ],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one age group must be selected'
    }
  },

  // Online Presence
  website: {
    type: String,
    trim: true,
    match: [
      /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
      'Please enter a valid website URL'
    ]
  },

  // About School
  aboutSchool: {
    type: String,
    required: [true, 'About school is required'],
    trim: true,
    minlength: [50, 'About school must be at least 50 words'],
    maxlength: [250, 'About school cannot exceed 250 words'],
    validate: {
      validator: function(v) {
        const wordCount = v.trim().split(/\s+/).length;
        return wordCount >= 50 && wordCount <= 250;
      },
      message: 'About school must be between 50 and 250 words'
    }
  },

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
  foundedYear: {
    type: Number,
    min: [1800, 'Founded year cannot be before 1800'],
    max: [new Date().getFullYear(), 'Founded year cannot be in the future']
  },
  accreditation: [{
    type: String,
    trim: true
  }],
  facilities: [{
    type: String,
    trim: true
  }],
  extracurricularActivities: [{
    type: String,
    trim: true
  }],

  // Contact Person
  contactPerson: {
    name: {
      type: String,
      trim: true
    },
    position: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    }
  },

  // School Documents
  schoolLogo: {
    type: String,
    default: null
  },
  schoolPhotos: [{
    type: String
  }],
  prospectus: {
    type: String,
    default: null
  },

  // School Statistics
  studentCount: {
    type: Number,
    min: [0, 'Student count cannot be negative']
  },
  teacherCount: {
    type: Number,
    min: [0, 'Teacher count cannot be negative']
  },
  classSize: {
    average: {
      type: Number,
      min: [1, 'Average class size must be at least 1']
    },
    max: {
      type: Number,
      min: [1, 'Maximum class size must be at least 1']
    }
  },

  // School Hours
  schoolHours: {
    start: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
    },
    end: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
    }
  },

  // Academic Information
  academicYear: {
    start: {
      type: String,
      match: [/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, 'Please enter a valid month']
    },
    end: {
      type: String,
      match: [/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, 'Please enter a valid month']
    }
  },
  applicationDeadline: {
    type: Date
  },
  interviewRequired: {
    type: Boolean,
    default: false
  },
  entranceExam: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
schoolSchema.index({ userId: 1 });
schoolSchema.index({ schoolName: 1 });
schoolSchema.index({ country: 1 });
schoolSchema.index({ city: 1 });
schoolSchema.index({ curriculum: 1 });
schoolSchema.index({ schoolType: 1 });
schoolSchema.index({ isProfileComplete: 1 });

// Virtual for school size category
schoolSchema.virtual('sizeCategory').get(function() {
  if (this.studentCount) {
    if (this.studentCount <= 500) return 'Small';
    if (this.studentCount <= 1000) return 'Medium';
    return 'Large';
  }
  return this.schoolSize;
});

// Virtual for full address
schoolSchema.virtual('fullAddress').get(function() {
  const parts = [this.address, this.city, this.provinceState, this.zipCode, this.country];
  return parts.filter(part => part).join(', ');
});

// Pre-save middleware to update profile completion
schoolSchema.pre('save', function(next) {
  const requiredFields = [
    'schoolName', 'schoolEmail', 'schoolContactNumber', 'country', 'city', 
    'provinceState', 'curriculum', 'schoolSize', 'schoolType', 'genderType', 
    'ageGroups', 'aboutSchool'
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
schoolSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

// Static method to find complete profiles
schoolSchema.statics.findCompleteProfiles = function() {
  return this.find({ isProfileComplete: true });
};

// Static method to search schools
schoolSchema.statics.searchSchools = function(criteria) {
  const query = { isProfileComplete: true };
  
  if (criteria.country) query.country = new RegExp(criteria.country, 'i');
  if (criteria.city) query.city = new RegExp(criteria.city, 'i');
  if (criteria.curriculum && criteria.curriculum.length > 0) {
    query.curriculum = { $in: criteria.curriculum };
  }
  if (criteria.schoolType) query.schoolType = criteria.schoolType;
  if (criteria.genderType) query.genderType = criteria.genderType;
  if (criteria.ageGroups && criteria.ageGroups.length > 0) {
    query.ageGroups = { $in: criteria.ageGroups };
  }

  return this.find(query);
};

const School = mongoose.model('School', schoolSchema);

module.exports = School;
