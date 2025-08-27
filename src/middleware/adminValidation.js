const { validationErrorResponse } = require("../utils/response");

// Validation for admin user creation
const validateAdminUserCreation = (req, res, next) => {
  const errors = {};
  const { role, firstName, lastName, email } = req.body;

  // Required fields
  if (!role || !["teacher", "school", "recruiter", "supplier"].includes(role)) {
    errors.role =
      "Valid role is required (teacher, school, recruiter, or supplier)";
  }

  if (!firstName || firstName.trim().length < 2) {
    errors.firstName = "First name must be at least 2 characters";
  }

  if (!lastName || lastName.trim().length < 2) {
    errors.lastName = "Last name must be at least 2 characters";
  }

  if (!email || !isValidEmail(email)) {
    errors.email = "Valid email is required";
  }

  // Role-specific validations
  if (role === "teacher") {
    const {
      phoneNumber,
      country,
      city,
      stateProvince,
      postalCode,
      streetAddress,
      qualification,
      subject,
      pgce,
      yearsOfTeachingExperience,
      professionalBio,
      keyAchievements,
      certifications,
      additionalQualifications,
      professionalTitle,
      linkedin,
      languages,
    } = req.body;

    if (!streetAddress || streetAddress.trim().length < 3) {
      errors.streetAddress = "Street address is required and must be valid";
    }

    if (!stateProvince || stateProvince.trim().length < 2) {
      errors.stateProvince = "State/Province is required";
    }

    if (!postalCode || postalCode.trim().length < 3) {
      errors.postalCode = "Postal code is required";
    }

    if (!city) {
      errors.city = "City is required";
    }

    if (!country) {
      errors.country = "Country is required";
    }

    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      errors.phoneNumber =
        "Phone number must include country code (e.g., +1234567890)";
    }

    if (
      qualification &&
      ![
        "Bachelor",
        "Master",
        "PhD",
        "Diploma",
        "Certificate",
        "Other",
      ].includes(qualification)
    ) {
      errors.qualification = "Invalid qualification";
    }

    if (
      yearsOfTeachingExperience !== undefined &&
      (yearsOfTeachingExperience < 0 || yearsOfTeachingExperience > 50)
    ) {
      errors.yearsOfTeachingExperience =
        "Years of experience must be between 0 and 50";
    }

    if (professionalBio && professionalBio.length > 1000) {
      errors.professionalBio =
        "Professional bio must be less than 1000 characters";
    }

    if (linkedin && !isValidUrl(linkedin)) {
      errors.linkedin = "LinkedIn must be a valid URL";
    }

    if (languages && !Array.isArray(languages)) {
      errors.languages = "Languages must be an array of objects";
    } else if (Array.isArray(languages)) {
      languages.forEach((lang, i) => {
        if (!lang.language) {
          errors[`languages[${i}].language`] = "Language name is required";
        }
        if (
          lang.proficiency &&
          ![
            "Native",
            "Fluent",
            "Advanced",
            "Intermediate",
            "Beginner",
          ].includes(lang.proficiency)
        ) {
          errors[`languages[${i}].proficiency`] = "Invalid proficiency level";
        }
      });
    }

    if (keyAchievements && !Array.isArray(keyAchievements)) {
      errors.keyAchievements = "Key achievements must be an array";
    }
    if (certifications && !Array.isArray(certifications)) {
      errors.certifications = "Certifications must be an array";
    }
    if (additionalQualifications && !Array.isArray(additionalQualifications)) {
      errors.additionalQualifications =
        "Additional qualifications must be an array";
    }
  } else if (role === "school") {
    const {
      schoolName,
      schoolEmail,
      schoolContactNumber,
      country,
      city,
      stateProvince,
      postalCode,
      streetAddress,
      curriculum,
      schoolSize,
      schoolType,
      genderType,
      ageGroup,
      aboutSchool,
    } = req.body;

    if (!streetAddress || streetAddress.trim().length < 3) {
      errors.streetAddress = "Street address is required and must be valid";
    }

    if (!stateProvince || stateProvince.trim().length < 2) {
      errors.stateProvince = "State/Province is required";
    }

    if (!postalCode || postalCode.trim().length < 3) {
      errors.postalCode = "Postal code is required";
    }

    if (schoolName && schoolName.trim().length < 2) {
      errors.schoolName = "School name must be at least 2 characters";
    }

    if (schoolEmail && !isValidEmail(schoolEmail)) {
      errors.schoolEmail = "Valid school email is required";
    }

    if (schoolContactNumber && !isValidPhoneNumber(schoolContactNumber)) {
      errors.schoolContactNumber =
        "School contact number must include country code (e.g., +1234567890)";
    }

    if (curriculum && !Array.isArray(curriculum)) {
      errors.curriculum = "Curriculum must be an array";
    }

    if (
      schoolSize &&
      ![
        "Small (1-500 students)",
        "Medium (501-1000 students)",
        "Large (1001+ students)",
      ].includes(schoolSize)
    ) {
      errors.schoolSize = "Invalid school size";
    }

    if (
      schoolType &&
      ![
        "Public",
        "Private",
        "International",
        "Charter",
        "Religious",
        "Other",
      ].includes(schoolType)
    ) {
      errors.schoolType = "Invalid school type";
    }

    if (
      genderType &&
      !["Boys Only", "Girls Only", "Mixed"].includes(genderType)
    ) {
      errors.genderType = "Invalid gender type";
    }

    if (ageGroup && !Array.isArray(ageGroup)) {
      errors.ageGroup = "Age group must be an array";
    }

    if (aboutSchool && aboutSchool.length > 2000) {
      errors.aboutSchool = "About school must be less than 2000 characters";
    }
  }

  if (Object.keys(errors).length > 0) {
    return validationErrorResponse(res, errors);
  }

  next();
};

// Validation for admin user update
const validateAdminUserUpdate = (req, res, next) => {
  const errors = {};

  const { firstName, lastName, email, role, phoneNumber, alternatePhone } = req.body;

  if (firstName !== undefined && firstName.trim().length < 2) {
    errors.firstName = "First name must be at least 2 characters";
  }

  if (lastName !== undefined && lastName.trim().length < 2) {
    errors.lastName = "Last name must be at least 2 characters";
  }

  if (email !== undefined && !isValidEmail(email)) {
    errors.email = "Valid email is required";
  }

  if (
    role !== undefined &&
    !["teacher", "school", "recruiter", "supplier"].includes(role)
  ) {
    errors.role = "Invalid role. Must be teacher, school, recruiter, or supplier";
  }

  if (phoneNumber !== undefined && !isValidPhoneNumber(phoneNumber)) {
    errors.phoneNumber =
      "Phone number must include country code (e.g., +1234567890)";
  }

  if (alternatePhone !== undefined && !isValidPhoneNumber(alternatePhone)) {
    errors.alternatePhone =
      "Alternate phone must include country code (e.g., +1234567890)";
  }

  // --- Teacher-specific updates ---
  if (role === "teacher") {
    const { qualification, yearsOfTeachingExperience, professionalBio, languages } = req.body;

    if (
      qualification !== undefined &&
      !["Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other"].includes(qualification)
    ) {
      errors.qualification = "Invalid qualification";
    }

    if (
      yearsOfTeachingExperience !== undefined &&
      (yearsOfTeachingExperience < 0 || yearsOfTeachingExperience > 50)
    ) {
      errors.yearsOfTeachingExperience = "Years of experience must be between 0 and 50";
    }

    if (professionalBio !== undefined && professionalBio.length > 1000) {
      errors.professionalBio = "Professional bio must be less than 1000 characters";
    }

    if (languages !== undefined) {
      if (!Array.isArray(languages)) {
        errors.languages = "Languages must be an array of objects";
      } else {
        languages.forEach((lang, i) => {
          if (lang.language !== undefined && !lang.language.trim()) {
            errors[`languages[${i}].language`] = "Language name is required";
          }
          if (
            lang.proficiency !== undefined &&
            !["Native", "Fluent", "Advanced", "Intermediate", "Beginner"].includes(lang.proficiency)
          ) {
            errors[`languages[${i}].proficiency`] = "Invalid proficiency level";
          }
        });
      }
    }
  }

  // --- School-specific updates ---
  if (role === "school") {
    const { schoolSize, schoolType, genderType, curriculum, ageGroup, aboutSchool } = req.body;

    if (
      schoolSize !== undefined &&
      !["Small (1-500 students)", "Medium (501-1000 students)", "Large (1001+ students)"].includes(
        schoolSize
      )
    ) {
      errors.schoolSize = "Invalid school size";
    }

    if (
      schoolType !== undefined &&
      !["Public", "Private", "International", "Charter", "Religious", "Other"].includes(schoolType)
    ) {
      errors.schoolType = "Invalid school type";
    }

    if (genderType !== undefined && !["Boys Only", "Girls Only", "Mixed"].includes(genderType)) {
      errors.genderType = "Invalid gender type";
    }

    if (curriculum !== undefined && !Array.isArray(curriculum)) {
      errors.curriculum = "Curriculum must be an array";
    }

    if (ageGroup !== undefined && !Array.isArray(ageGroup)) {
      errors.ageGroup = "Age group must be an array";
    }

    if (aboutSchool !== undefined && aboutSchool.length > 2000) {
      errors.aboutSchool = "About school must be less than 2000 characters";
    }
  }

  if (Object.keys(errors).length > 0) {
    return validationErrorResponse(res, errors);
  }

  next();
};

// Validation for user status change
const validateUserStatusChange = (req, res, next) => {
  const { status } = req.body;
  const errors = {};

  if (
    !status ||
    !["active", "inactive", "suspended", "pending_verification"].includes(
      status
    )
  ) {
    errors.status =
      "Status must be active, inactive, suspended, or pending_verification";
  }

  if (Object.keys(errors).length > 0) {
    return validationErrorResponse(res, errors);
  }

  next();
};

// Helper function to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate phone number
const isValidPhoneNumber = (phone) => {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

module.exports = {
  validateAdminUserCreation,
  validateAdminUserUpdate,
  validateUserStatusChange,
};
