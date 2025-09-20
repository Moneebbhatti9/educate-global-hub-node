const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import the User model
const User = require("../src/models/User");

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/educate-global-hub",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log("Connected to MongoDB");

    const adminEmail = "hukkhan@yahoo.co.uk";
    const adminPassword = "Admin@123";

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("Admin user already exists with email:", adminEmail);
      console.log("User details:", {
        id: existingAdmin._id,
        email: existingAdmin.email,
        firstName: existingAdmin.firstName,
        lastName: existingAdmin.lastName,
        role: existingAdmin.role,
        status: existingAdmin.status,
        isEmailVerified: existingAdmin.isEmailVerified,
        isProfileComplete: existingAdmin.isProfileComplete,
      });
      return;
    }

    // Hash the password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    // Create admin user
    const adminUser = new User({
      email: adminEmail,
      passwordHash: passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isProfileComplete: true,
    });

    // Save the admin user
    await adminUser.save();

    console.log("✅ Admin user created successfully!");
    console.log("Admin user details:", {
      id: adminUser._id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      status: adminUser.status,
      isEmailVerified: adminUser.isEmailVerified,
      isProfileComplete: adminUser.isProfileComplete,
    });

    console.log("\n📧 Email:", adminEmail);
    console.log("🔑 Password:", adminPassword);
    console.log(
      "\n⚠️  Please change the password after first login for security!"
    );
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
    if (error.code === 11000) {
      console.error("Duplicate email error - admin user might already exist");
    }
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
};

// Run the script
createAdminUser();

