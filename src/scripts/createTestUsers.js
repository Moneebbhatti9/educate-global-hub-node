/**
 * Script to create test user accounts for development
 * Run with: node src/scripts/createTestUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import User model
const User = require('../models/User');

const testUsers = [
  {
    email: 'moneebbhatti987@gmail.com',
    password: 'Teacher@123',
    firstName: 'Moneeb',
    lastName: 'Teacher',
    role: 'teacher',
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
  },
  {
    email: 'moneebprimary@gmail.com',
    password: 'School@123',
    firstName: 'Moneeb',
    lastName: 'School',
    role: 'school',
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
  },
];

async function createTestUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/educate-link';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        console.log(`User ${userData.email} already exists, updating password...`);
        // Update the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(userData.password, salt);
        existingUser.passwordHash = passwordHash;
        existingUser.status = 'active';
        existingUser.isEmailVerified = true;
        await existingUser.save();
        console.log(`Updated password for ${userData.email}`);
      } else {
        // Create new user
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(userData.password, salt);

        const newUser = new User({
          email: userData.email,
          passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          status: userData.status,
          isEmailVerified: userData.isEmailVerified,
          isProfileComplete: userData.isProfileComplete,
        });

        await newUser.save();
        console.log(`Created user: ${userData.email} (${userData.role})`);
      }
    }

    console.log('\n=== Test Users Created Successfully ===');
    console.log('Teacher Account:');
    console.log('  Email: moneebbhatti987@gmail.com');
    console.log('  Password: Teacher@123');
    console.log('\nSchool Account:');
    console.log('  Email: moneebprimary@gmail.com');
    console.log('  Password: School@123');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

createTestUsers();
