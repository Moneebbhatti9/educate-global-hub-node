/**
 * Script to create School and Teacher user accounts with complete profiles
 * Run with: node src/scripts/createSchoolAndTeacherAccounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const SchoolProfile = require('../models/SchoolProfile');

// Account configurations
const accounts = {
  school: {
    user: {
      email: 'school@educatelink.com',
      password: 'School@123',
      firstName: 'Global',
      lastName: 'Academy',
      role: 'school',
      status: 'active',
      isEmailVerified: true,
      isProfileComplete: true,
      kycStatus: 'approved',
      is2FAEnabled: false,
    },
    profile: {
      schoolName: 'Global International Academy',
      schoolEmail: 'school@educatelink.com',
      schoolContactNumber: '+442012345678',
      country: 'United Kingdom',
      city: 'London',
      province: 'Greater London',
      zipCode: 'SW1A 1AA',
      address: '123 Education Street, Westminster',
      curriculum: ['British Curriculum', 'IB (International Baccalaureate)'],
      schoolSize: 'Medium (501-1000 students)',
      schoolType: 'International',
      genderType: 'Mixed',
      ageGroup: ['Primary (6-11 years)', 'Secondary (12-16 years)', 'Sixth Form/High School (17-18 years)'],
      schoolWebsite: 'https://www.globalacademy.edu',
      aboutSchool: 'Global International Academy is a leading international school dedicated to providing world-class education. Our diverse curriculum combines British standards with the International Baccalaureate program, preparing students for success in a globalized world. We focus on academic excellence, character development, and holistic growth.',
      registrationNumber: 'SCH-2024-001',
      establishedYear: 2005,
      mission: 'To nurture curious minds and develop global citizens who are prepared to lead and innovate in an ever-changing world.',
      vision: 'To be a world-renowned institution that transforms education through innovation, inclusivity, and excellence.',
      isProfileComplete: true,
    },
  },
  teacher: {
    user: {
      email: 'teacher@educatelink.com',
      password: 'Teacher@123',
      firstName: 'John',
      lastName: 'Smith',
      role: 'teacher',
      status: 'active',
      isEmailVerified: true,
      isProfileComplete: true,
      kycStatus: 'approved',
      is2FAEnabled: false,
    },
    profile: {
      firstName: 'John',
      lastName: 'Smith',
      professionalTitle: 'Senior Mathematics Teacher & Department Head',
      email: 'teacher@educatelink.com',
      phoneNumber: '+447123456789',
      dateOfBirth: new Date('1985-06-15'),
      placeOfBirth: 'Manchester',
      nationality: 'British',
      gender: 'Male',
      maritalStatus: 'Married',
      streetAddress: '45 Elm Avenue',
      city: 'London',
      stateProvince: 'Greater London',
      country: 'United Kingdom',
      postalCode: 'NW1 2AB',
      province: 'Greater London',
      address: '45 Elm Avenue, Camden',
      linkedin: 'https://linkedin.com/in/johnsmith-teacher',
      languages: [
        { language: 'English', proficiency: 'Native', isNative: true },
        { language: 'French', proficiency: 'Advanced', isNative: false },
        { language: 'Spanish', proficiency: 'Intermediate', isNative: false },
      ],
      qualification: 'Master',
      subject: 'Mathematics',
      pgce: true,
      yearsOfTeachingExperience: 12,
      professionalBio: 'Passionate mathematics educator with over 12 years of experience teaching at both secondary and sixth form levels. Specialized in preparing students for GCSE and A-Level examinations with consistently high pass rates. Experienced in implementing innovative teaching methodologies and integrating technology into the classroom. Strong track record of mentoring junior teachers and leading departmental initiatives.',
      keyAchievements: [
        '95% A*-C pass rate in GCSE Mathematics for 5 consecutive years',
        'Developed award-winning mathematics curriculum for gifted students',
        'Published research on effective STEM teaching methods',
        'Recipient of Outstanding Teacher Award 2022',
      ],
      certifications: [
        'PGCE Secondary Mathematics - University of Manchester',
        'Advanced Certificate in Educational Leadership',
        'Google Certified Educator Level 2',
      ],
      additionalQualifications: [
        'BSc Mathematics (First Class Honours) - University of Oxford',
        'MSc Applied Mathematics - Imperial College London',
        'Certificate in Special Educational Needs (SEN)',
      ],
      isProfileComplete: true,
      profileCompletion: 100,
    },
  },
};

async function createAccounts() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/educate-link';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    const results = {
      school: { userCreated: false, profileCreated: false },
      teacher: { userCreated: false, profileCreated: false },
    };

    // Process each account type
    for (const [accountType, config] of Object.entries(accounts)) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Processing ${accountType.toUpperCase()} Account`);
      console.log('='.repeat(50));

      // Check if user already exists
      let user = await User.findOne({ email: config.user.email });

      if (user) {
        console.log(`User ${config.user.email} already exists. Updating...`);

        // Update password and status
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(config.user.password, salt);

        user.passwordHash = passwordHash;
        user.status = config.user.status;
        user.isEmailVerified = config.user.isEmailVerified;
        user.isProfileComplete = config.user.isProfileComplete;
        user.kycStatus = config.user.kycStatus;
        user.firstName = config.user.firstName;
        user.lastName = config.user.lastName;
        user.is2FAEnabled = config.user.is2FAEnabled;

        await user.save();
        console.log(`✓ Updated user: ${config.user.email}`);
      } else {
        // Create new user
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(config.user.password, salt);

        user = new User({
          email: config.user.email,
          passwordHash,
          firstName: config.user.firstName,
          lastName: config.user.lastName,
          role: config.user.role,
          status: config.user.status,
          isEmailVerified: config.user.isEmailVerified,
          isProfileComplete: config.user.isProfileComplete,
          kycStatus: config.user.kycStatus,
          is2FAEnabled: config.user.is2FAEnabled,
        });

        await user.save();
        console.log(`✓ Created user: ${config.user.email}`);
        results[accountType].userCreated = true;
      }

      // Create or update profile
      const ProfileModel = accountType === 'school' ? SchoolProfile : TeacherProfile;
      let profile = await ProfileModel.findOne({ userId: user._id });

      if (profile) {
        console.log(`Profile for ${config.user.email} already exists. Updating...`);

        // Update profile fields
        Object.assign(profile, config.profile);
        await profile.save();
        console.log(`✓ Updated ${accountType} profile`);
      } else {
        // Create new profile
        profile = new ProfileModel({
          userId: user._id,
          ...config.profile,
        });

        await profile.save();
        console.log(`✓ Created ${accountType} profile`);
        results[accountType].profileCreated = true;
      }

      console.log(`✓ ${accountType.charAt(0).toUpperCase() + accountType.slice(1)} account setup complete`);
    }

    // Print summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           ACCOUNTS CREATED SUCCESSFULLY                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log('║  SCHOOL ACCOUNT:                                           ║');
    console.log('║  ├─ Email:    school@educatelink.com                       ║');
    console.log('║  ├─ Password: School@123                                   ║');
    console.log('║  └─ Role:     school                                       ║');
    console.log('║                                                            ║');
    console.log('║  TEACHER ACCOUNT:                                          ║');
    console.log('║  ├─ Email:    teacher@educatelink.com                      ║');
    console.log('║  ├─ Password: Teacher@123                                  ║');
    console.log('║  └─ Role:     teacher                                      ║');
    console.log('║                                                            ║');
    console.log('║  Both accounts have:                                       ║');
    console.log('║  ✓ Email verified                                          ║');
    console.log('║  ✓ Profile completed                                       ║');
    console.log('║  ✓ KYC approved                                            ║');
    console.log('║  ✓ Status active                                           ║');
    console.log('║  ✓ 2FA disabled (no OTP required)                          ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error creating accounts:', error.message);
    if (error.errors) {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach((key) => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
createAccounts();
