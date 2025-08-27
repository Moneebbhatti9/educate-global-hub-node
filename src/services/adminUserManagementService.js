const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const SchoolProfile = require("../models/SchoolProfile");
const bcrypt = require("bcryptjs");

class AdminUserManagementService {
  // Get all users with pagination, search, and filters
  static async getAllUsers(queryParams) {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      status = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryParams;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};

    // Always exclude admin users from results
    query.role = { $ne: "admin" };

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Role filter (but still exclude admin)
    if (role && role !== "all") {
      if (role === "admin") {
        // If admin role is specifically requested, return empty result
        return {
          users: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      query.role = role;
    }

    // Status filter (using new status field)
    if (status && status !== "all") {
      if (status === "verified") {
        // For verified status, check both status and email verification
        query.$and = [{ status: "active" }, { isEmailVerified: true }];
      } else if (status === "unverified") {
        // For unverified status, check if status is not active or email not verified
        query.$or = [{ status: { $ne: "active" } }, { isEmailVerified: false }];
      } else {
        // Direct status filter
        query.status = status;
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with profile population
    const users = await User.find(query)
      .select("-passwordHash")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    // Enhance users with profile information for location and join date
    const enhancedUsers = await Promise.all(
      users.map(async (user) => {
        const userObj = user.toSafeObject();

        // Add join date (createdAt)
        userObj.joinDate = user.createdAt;

        // Get location information from profile
        let location = "";
        if (user.role === "teacher") {
          const teacherProfile = await TeacherProfile.findOne({
            userId: user._id,
          });
          if (teacherProfile) {
            const city = teacherProfile.city || "";
            const country = teacherProfile.country || "";
            location = [city, country].filter(Boolean).join(", ");
          }
        } else if (user.role === "school") {
          const schoolProfile = await SchoolProfile.findOne({
            userId: user._id,
          });
          if (schoolProfile) {
            const city = schoolProfile.city || "";
            const country = schoolProfile.country || "";
            location = [city, country].filter(Boolean).join(", ");
          }
        }

        userObj.location = location;
        return userObj;
      })
    );

    return {
      users: enhancedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    };
  }

  // Get user by ID
  static async getUserById(userId) {
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // Create new user
  static async createUser(userData) {
    const {
      role,
      firstName,
      lastName,
      email,
      phoneNumber,
      country,
      city,
      province,
      postalCode,
      address,
      qualification,
      subject,
      pgce,
      yearsOfTeachingExperience,
      professionalBio,
      keyAchievements,
      certifications,
      additionalQualifications,
      schoolName,
      schoolEmail,
      schoolContactNumber,
      curriculum,
      schoolSize,
      schoolType,
      genderType,
      ageGroup,
      schoolWebsite,
      aboutSchool,
    } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Generate default password based on role
    let defaultPassword;
    if (role === "teacher") {
      defaultPassword = "Teacher@123";
    } else if (role === "school") {
      defaultPassword = "School@123";
    } else if (role === "recruiter") {
      defaultPassword = "Recruiter@123";
    } else if (role === "supplier") {
      defaultPassword = "Supplier@123";
    } else {
      defaultPassword = "User@123"; // Fallback for other roles
    }

    // Hash the default password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    // Create user with verified status
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash,
      role,
      status: role === "teacher" || role === "admin" ? "active" : "pending",
      isEmailVerified: true, // Admin-created users are automatically verified
      isProfileComplete: true,
      phone: phoneNumber || null,
    });

    await user.save();

    // Create profile based on role
    if (role === "teacher") {
      const teacherProfile = new TeacherProfile({
        userId: user._id,

        // --- Required Personal/Contact ---
        firstName,
        lastName,
        professionalTitle: userData.professionalTitle || "",
        email, // required now
        phoneNumber: phoneNumber || "",
        alternatePhone: userData.alternatePhone || "",

        dateOfBirth: userData.dateOfBirth || null,
        placeOfBirth: userData.placeOfBirth || "",
        nationality: userData.nationality || "",
        passportNumber: userData.passportNumber || "",
        gender: userData.gender || undefined,
        maritalStatus: userData.maritalStatus || undefined,

        // --- Address (all required now) ---
        streetAddress: userData.streetAddress || address || "",
        city: city || "",
        stateProvince: userData.stateProvince || province || "",
        country: country || "",
        postalCode: userData.postalCode || postalCode || "",

        linkedin: userData.linkedin || "",

        // --- Professional ---
        qualification: qualification || "Bachelor",
        subject: subject || "",
        pgce: pgce || false,
        yearsOfTeachingExperience: yearsOfTeachingExperience || 0,
        professionalBio: professionalBio || "",

        keyAchievements: keyAchievements || [],
        certifications: certifications || [],
        additionalQualifications: additionalQualifications || [],

        // Legacy fields (still required by schema)
        province: userData.stateProvince || province || "",
        address: userData.streetAddress || address || "",
      });

      await teacherProfile.save();
    } else if (role === "school") {
      const schoolProfile = new SchoolProfile({
        userId: user._id,
        schoolName: schoolName || "",
        schoolEmail: schoolEmail || email,
        schoolContactNumber: schoolContactNumber || "",

        // --- Address ---
        streetAddress: userData.streetAddress || address || "",
        city: city || "",
        stateProvince: userData.stateProvince || province || "",
        country: country || "",
        postalCode: userData.postalCode || postalCode || "",

        curriculum: curriculum || [],
        schoolSize: schoolSize || "Small (1-500 students)",
        schoolType: schoolType || "Public",
        genderType: genderType || "Mixed",
        ageGroup: ageGroup || [],
        schoolWebsite: schoolWebsite || "",
        aboutSchool: aboutSchool || "",
      });

      await schoolProfile.save();
    }

    // Return user data with default password for email sending
    const userResponse = user.toSafeObject();
    userResponse.defaultPassword = defaultPassword;

    return userResponse;
  }

  // Update user
  static async updateUserProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let profile = null;

    if (user.role === "teacher") {
      profile = await TeacherProfile.findOne({ userId });
      if (!profile) {
        throw new Error("Teacher profile not found");
      }

      // --- Normalize teacher fields ---
      if (profileData.phoneNumber) {
        const { validateAndFormatPhone } = require("../utils/phoneUtils");
        const phoneValidation = validateAndFormatPhone(
          profileData.phoneNumber,
          profileData.country
        );
        if (!phoneValidation.isValid) throw new Error(phoneValidation.error);
        profileData.phoneNumber = phoneValidation.formatted;
      }

      if (profileData.alternatePhone) {
        const { validateAndFormatPhone } = require("../utils/phoneUtils");
        const altVal = validateAndFormatPhone(
          profileData.alternatePhone,
          profileData.country
        );
        if (!altVal.isValid)
          throw new Error(`Alternate phone: ${altVal.error}`);
        profileData.alternatePhone = altVal.formatted;
      }

      if (profileData.dateOfBirth) {
        const dob = new Date(profileData.dateOfBirth);
        if (isNaN(dob.getTime())) throw new Error("Invalid dateOfBirth");
        profileData.dateOfBirth = dob;
      }

      if (profileData.languages) {
        profileData.languages = profileData.languages
          .map((l) => ({
            language: String(l.language || l.name || "").trim(),
            proficiency: l.proficiency,
            isNative:
              !!l.isNative ||
              String(l.proficiency || "").toLowerCase() === "native",
          }))
          .filter((l) => l.language);
      }

      // --- Backward compat mapping ---
      if (profileData.stateProvince)
        profileData.province = profileData.stateProvince;
      if (profileData.streetAddress)
        profileData.address = profileData.streetAddress;
      if (profileData.postalCode) profileData.zipCode = profileData.postalCode;

      // Assign only valid schema fields
      Object.keys(profileData).forEach((key) => {
        if (profile.schema.paths[key]) {
          profile[key] = profileData[key];
        }
      });

      await profile.save();

      // --- Recalculate profile completion ---
      const completion = await profile.checkProfileCompletion();
      profile.profileCompletion = completion;
      profile.isProfileComplete = completion === 100;
      await profile.save();
    } else if (user.role === "school") {
      profile = await SchoolProfile.findOne({ userId });
      if (!profile) {
        throw new Error("School profile not found");
      }

      // --- Normalize school fields ---
      if (profileData.schoolContactNumber) {
        const { validateAndFormatPhone } = require("../utils/phoneUtils");
        const phoneValidation = validateAndFormatPhone(
          profileData.schoolContactNumber,
          profileData.country
        );
        if (!phoneValidation.isValid) throw new Error(phoneValidation.error);
        profileData.schoolContactNumber = phoneValidation.formatted;
      }

      if (profileData.curriculum && !Array.isArray(profileData.curriculum)) {
        profileData.curriculum = [profileData.curriculum];
      }

      if (profileData.ageGroup && !Array.isArray(profileData.ageGroup)) {
        profileData.ageGroup = [profileData.ageGroup];
      }

      // Assign only valid schema fields
      Object.keys(profileData).forEach((key) => {
        if (profile.schema.paths[key]) {
          profile[key] = profileData[key];
        }
      });

      await profile.save();
    }

    return profile;
  }

  // Delete user
  static async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete associated profiles
    if (user.role === "teacher") {
      await TeacherProfile.deleteMany({ userId });
    } else if (user.role === "school") {
      await SchoolProfile.deleteMany({ userId });
    }

    // Delete user
    await User.findByIdAndDelete(userId);
    return true;
  }

  // Change user status
  static async changeUserStatus(userId, status) {
    if (
      !["active", "inactive", "suspended", "pending_verification"].includes(
        status
      )
    ) {
      throw new Error("Invalid status value");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update the status field
    user.status = status;

    // Only school, recruiter, and supplier roles need admin verification
    const rolesRequiringVerification = ["school", "recruiter", "supplier"];

    if (rolesRequiringVerification.includes(user.role)) {
      if (status === "active") {
        // When admin activates these roles, mark them as verified
        user.isEmailVerified = true;
        // Keep existing profile completion status
      } else if (status === "inactive" || status === "suspended") {
        // When admin deactivates/suspends, mark as unverified
        user.isEmailVerified = false;
        user.isProfileComplete = false;
      } else if (status === "pending_verification") {
        // When set to pending verification, mark as unverified
        user.isEmailVerified = false;
        user.isProfileComplete = false;
      }
    } else {
      // For teacher and admin roles, status changes don't affect verification
      // They can be verified through normal email verification process
      if (status === "active") {
        // Keep existing verification status
      } else if (status === "inactive" || status === "suspended") {
        // When deactivated/suspended, mark as unverified
        user.isEmailVerified = false;
        user.isProfileComplete = false;
      }
    }

    await user.save();
    return user.toSafeObject();
  }

  // Get user profile details
  static async getUserProfile(userId) {
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      throw new Error("User not found");
    }

    let profile = null;

    if (user.role === "teacher") {
      profile = await TeacherProfile.findOne({ userId });
    } else if (user.role === "school") {
      profile = await SchoolProfile.findOne({ userId });
    }

    return {
      user,
      profile,
    };
  }

  // Update user profile
  static async updateUserProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let profile = null;

    if (user.role === "teacher") {
      profile = await TeacherProfile.findOne({ userId });
      if (!profile) {
        throw new Error("Teacher profile not found");
      }

      // Update teacher profile fields
      Object.keys(profileData).forEach((key) => {
        if (profile.schema.paths[key]) {
          profile[key] = profileData[key];
        }
      });

      await profile.save();
    } else if (user.role === "school") {
      profile = await SchoolProfile.findOne({ userId });
      if (!profile) {
        throw new Error("School profile not found");
      }

      // Update school profile fields
      Object.keys(profileData).forEach((key) => {
        if (profile.schema.paths[key]) {
          profile[key] = profileData[key];
        }
      });

      await profile.save();
    }

    return profile;
  }

  // Update user's last active timestamp
  static async updateLastActive(userId) {
    try {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() });
      return true;
    } catch (error) {
      console.error("Error updating last active:", error);
      return false;
    }
  }

  // Get users sorted by last active (for admin dashboard)
  static async getUsersByLastActive(limit = 10) {
    try {
      const users = await User.find({ role: { $ne: "admin" } })
        .select("-passwordHash")
        .sort({ lastActive: -1 })
        .limit(limit)
        .lean();

      // Enhance users with profile information for location
      const enhancedUsers = await Promise.all(
        users.map(async (user) => {
          let location = "";
          if (user.role === "teacher") {
            const teacherProfile = await TeacherProfile.findOne({
              userId: user._id,
            }).lean();
            if (teacherProfile) {
              const city = teacherProfile.city || "";
              const country = teacherProfile.country || "";
              location = [city, country].filter(Boolean).join(", ");
            }
          } else if (user.role === "school") {
            const schoolProfile = await SchoolProfile.findOne({
              userId: user._id,
            }).lean();
            if (schoolProfile) {
              const city = schoolProfile.city || "";
              const country = schoolProfile.country || "";
              location = [city, country].filter(Boolean).join(", ");
            }
          }

          return {
            ...user,
            location,
            joinDate: user.createdAt,
          };
        })
      );

      return enhancedUsers;
    } catch (error) {
      console.error("Error getting users by last active:", error);
      throw error;
    }
  }

  // Export users to CSV/Excel
  static async exportUsers(exportParams) {
    const { format = "csv", role = "" } = exportParams;

    if (!["csv", "excel"].includes(format)) {
      throw new Error("Invalid format. Use 'csv' or 'excel'");
    }

    // Build query
    let query = { role: { $ne: "admin" } };
    if (role && role !== "all") {
      if (role === "admin") {
        // If admin role is specifically requested, return empty result
        return "";
      }
      query.role = role;
    }

    const users = await User.find(query).select("-passwordHash").lean();

    // Populate profile data for location information
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        if (user.role === "teacher") {
          const teacherProfile = await TeacherProfile.findOne({
            userId: user._id,
          }).lean();
          user.teacherProfile = teacherProfile;
        } else if (user.role === "school") {
          const schoolProfile = await SchoolProfile.findOne({
            userId: user._id,
          }).lean();
          user.schoolProfile = schoolProfile;
        }
        return user;
      })
    );

    if (format === "csv") {
      return this.generateCSV(usersWithProfiles);
    } else {
      throw new Error("Excel export not implemented yet");
    }
  }

  // Helper function to generate CSV
  static generateCSV(users) {
    const headers = [
      "ID",
      "First Name",
      "Last Name",
      "Email",
      "Role",
      "Status",
      "Email Verified",
      "Profile Complete",
      "Join Date",
      "Last Active",
      "Location",
      "Phone",
      "Country",
      "City",
      "Subject/Qualification",
    ];

    const rows = users.map((user) => {
      let phone = "";
      let country = "";
      let city = "";
      let subjectQualification = "";
      let location = "";

      if (user.role === "teacher" && user.teacherProfile) {
        phone = user.teacherProfile.phoneNumber || "";
        country = user.teacherProfile.country || "";
        city = user.teacherProfile.city || "";
        location = [city, country].filter(Boolean).join(", ");
        subjectQualification = `${user.teacherProfile.subject || ""} - ${
          user.teacherProfile.qualification || ""
        }`;
      } else if (user.role === "school" && user.schoolProfile) {
        phone = user.schoolProfile.schoolContactNumber || "";
        country = user.schoolProfile.country || "";
        city = user.schoolProfile.city || "";
        location = [city, country].filter(Boolean).join(", ");
        subjectQualification = user.schoolProfile.schoolName || "";
      }

      return [
        user._id,
        user.firstName,
        user.lastName,
        user.email,
        user.role,
        user.status || "pending_verification",
        user.isEmailVerified ? "Yes" : "No",
        user.isProfileComplete ? "Yes" : "No",
        user.createdAt ? user.createdAt.toISOString() : "",
        user.lastActive ? user.lastActive.toISOString() : "",
        location,
        phone,
        country,
        city,
        subjectQualification,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  // Get user statistics
  static async getUserStatistics() {
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
    const verifiedUsers = await User.countDocuments({
      role: { $ne: "admin" },
      isEmailVerified: true,
    });
    const unverifiedUsers = await User.countDocuments({
      role: { $ne: "admin" },
      isEmailVerified: false,
    });
    const completeProfiles = await User.countDocuments({
      role: { $ne: "admin" },
      isProfileComplete: true,
    });
    const incompleteProfiles = await User.countDocuments({
      role: { $ne: "admin" },
      isProfileComplete: false,
    });

    const roleStats = await User.aggregate([
      {
        $match: { role: { $ne: "admin" } },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyStats = await User.aggregate([
      {
        $match: { role: { $ne: "admin" } },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 },
      },
      {
        $limit: 12,
      },
    ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      completeProfiles,
      incompleteProfiles,
      roleStats,
      monthlyStats,
    };
  }

  // Bulk operations
  static async bulkUpdateUserStatus(userIds, status) {
    if (!["active", "inactive", "suspended"].includes(status)) {
      throw new Error("Invalid status value");
    }

    const updateData = {};
    if (status === "active") {
      updateData.isEmailVerified = true;
    } else {
      updateData.isEmailVerified = false;
      updateData.isProfileComplete = false;
    }

    // Exclude admin users from bulk operations
    const result = await User.updateMany(
      {
        _id: { $in: userIds },
        role: { $ne: "admin" }, // Ensure no admin users are affected
      },
      updateData
    );

    return result;
  }

  // Search users with advanced filters
  static async searchUsers(searchParams) {
    const {
      query = "",
      role = "",
      status = "",
      country = "",
      city = "",
      dateFrom = "",
      dateTo = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = 50,
    } = searchParams;

    let searchQuery = { role: { $ne: "admin" } };

    // Text search
    if (query) {
      searchQuery.$or = [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    // Role filter (but still exclude admin)
    if (role) {
      if (role === "admin") {
        // If admin role is specifically requested, return empty result
        return [];
      }
      searchQuery.role = role;
    }

    // Status filter
    if (status) {
      if (status === "verified") {
        searchQuery.isEmailVerified = true;
      } else if (status === "unverified") {
        searchQuery.isEmailVerified = false;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) {
        searchQuery.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        searchQuery.createdAt.$lte = new Date(dateTo);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute search
    const users = await User.find(searchQuery)
      .select("-passwordHash")
      .sort(sort)
      .limit(parseInt(limit));

    // If country or city filter is applied, we need to filter by profile data
    if (country || city) {
      let filteredUsers = [];

      for (const user of users) {
        let includeUser = true;

        if (user.role === "teacher") {
          const profile = await TeacherProfile.findOne({ userId: user._id });
          if (profile) {
            if (country && profile.country !== country) includeUser = false;
            if (city && profile.city !== city) includeUser = false;
          }
        } else if (user.role === "school") {
          const profile = await SchoolProfile.findOne({ userId: user._id });
          if (profile) {
            if (country && profile.country !== country) includeUser = false;
            if (city && profile.city !== city) includeUser = false;
          }
        }

        if (includeUser) {
          filteredUsers.push(user);
        }
      }

      return filteredUsers;
    }

    return users;
  }
}

module.exports = AdminUserManagementService;
