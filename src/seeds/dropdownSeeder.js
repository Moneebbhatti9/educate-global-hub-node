/**
 * Dropdown Options Seeder
 * Populates the database with initial dropdown options from static data
 *
 * Run with: node src/seeds/dropdownSeeder.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/database");
const DropdownOption = require("../models/DropdownOption");

// ============================================
// DROPDOWN DATA DEFINITIONS
// ============================================

const dropdownData = {
  // ============================================
  // JOB POSTING DROPDOWNS
  // ============================================

  educationLevel: [
    { value: "early_years", label: "Early Years (Ages 3-5)" },
    { value: "primary", label: "Primary (Grades 1-6)" },
    { value: "secondary", label: "Secondary (Grades 7-9)" },
    { value: "high_school", label: "High School (Grades 10-12)" },
    { value: "foundation", label: "Foundation Program" },
    { value: "higher_education", label: "Higher Education" },
  ],

  jobType: [
    { value: "full_time", label: "Full-time" },
    { value: "part_time", label: "Part-time" },
    { value: "contract", label: "Contract" },
    { value: "substitute", label: "Substitute" },
  ],

  positionCategory: [
    { value: "Teaching", label: "Teaching" },
    { value: "Administration", label: "Administration" },
    { value: "Support Staff", label: "Support Staff" },
    { value: "Leadership", label: "Leadership" },
    { value: "Specialist", label: "Specialist" },
  ],

  // Position subcategories with parent relationships
  positionSubcategory: [
    // Teaching subcategories
    { value: "Subject Teacher", label: "Subject Teacher", parentCategory: "positionCategory", parentValue: "Teaching" },
    { value: "Class Teacher", label: "Class Teacher", parentCategory: "positionCategory", parentValue: "Teaching" },
    { value: "Special Education", label: "Special Education", parentCategory: "positionCategory", parentValue: "Teaching" },
    { value: "ESL/EAL", label: "ESL/EAL", parentCategory: "positionCategory", parentValue: "Teaching" },
    { value: "Gifted Education", label: "Gifted Education", parentCategory: "positionCategory", parentValue: "Teaching" },
    { value: "Remedial Education", label: "Remedial Education", parentCategory: "positionCategory", parentValue: "Teaching" },

    // Administration subcategories
    { value: "Principal", label: "Principal", parentCategory: "positionCategory", parentValue: "Administration" },
    { value: "Vice Principal", label: "Vice Principal", parentCategory: "positionCategory", parentValue: "Administration" },
    { value: "Head of Department", label: "Head of Department", parentCategory: "positionCategory", parentValue: "Administration" },
    { value: "Coordinator", label: "Coordinator", parentCategory: "positionCategory", parentValue: "Administration" },
    { value: "Registrar", label: "Registrar", parentCategory: "positionCategory", parentValue: "Administration" },
    { value: "Business Manager", label: "Business Manager", parentCategory: "positionCategory", parentValue: "Administration" },

    // Support Staff subcategories
    { value: "Librarian", label: "Librarian", parentCategory: "positionCategory", parentValue: "Support Staff" },
    { value: "IT Support", label: "IT Support", parentCategory: "positionCategory", parentValue: "Support Staff" },
    { value: "Maintenance", label: "Maintenance", parentCategory: "positionCategory", parentValue: "Support Staff" },
    { value: "Security", label: "Security", parentCategory: "positionCategory", parentValue: "Support Staff" },
    { value: "Transportation", label: "Transportation", parentCategory: "positionCategory", parentValue: "Support Staff" },
    { value: "Cafeteria", label: "Cafeteria", parentCategory: "positionCategory", parentValue: "Support Staff" },

    // Leadership subcategories
    { value: "Director", label: "Director", parentCategory: "positionCategory", parentValue: "Leadership" },
    { value: "Dean", label: "Dean", parentCategory: "positionCategory", parentValue: "Leadership" },
    { value: "Department Head", label: "Department Head", parentCategory: "positionCategory", parentValue: "Leadership" },
    { value: "Curriculum Leader", label: "Curriculum Leader", parentCategory: "positionCategory", parentValue: "Leadership" },

    // Specialist subcategories
    { value: "Counselor", label: "Counselor", parentCategory: "positionCategory", parentValue: "Specialist" },
    { value: "Psychologist", label: "Psychologist", parentCategory: "positionCategory", parentValue: "Specialist" },
    { value: "Speech Therapist", label: "Speech Therapist", parentCategory: "positionCategory", parentValue: "Specialist" },
    { value: "Occupational Therapist", label: "Occupational Therapist", parentCategory: "positionCategory", parentValue: "Specialist" },
    { value: "Nurse", label: "Nurse", parentCategory: "positionCategory", parentValue: "Specialist" },
  ],

  benefits: [
    { value: "health_insurance", label: "Health Insurance" },
    { value: "dental_insurance", label: "Dental Insurance" },
    { value: "vision_insurance", label: "Vision Insurance" },
    { value: "life_insurance", label: "Life Insurance" },
    { value: "disability_insurance", label: "Disability Insurance" },
    { value: "retirement_plan", label: "Retirement Plan" },
    { value: "professional_development", label: "Professional Development" },
    { value: "tuition_reimbursement", label: "Tuition Reimbursement" },
    { value: "housing_allowance", label: "Housing Allowance" },
    { value: "transportation_allowance", label: "Transportation Allowance" },
    { value: "annual_flight", label: "Annual Flight" },
    { value: "relocation_assistance", label: "Relocation Assistance" },
    { value: "visa_sponsorship", label: "Visa Sponsorship" },
    { value: "paid_time_off", label: "Paid Time Off" },
    { value: "sick_leave", label: "Sick Leave" },
    { value: "maternity_paternity_leave", label: "Maternity/Paternity Leave" },
    { value: "wellness_programs", label: "Wellness Programs" },
    { value: "gym_membership", label: "Gym Membership" },
    { value: "meal_allowance", label: "Meal Allowance" },
    { value: "childcare_support", label: "Childcare Support" },
  ],

  // ============================================
  // RESOURCE UPLOADING DROPDOWNS
  // ============================================

  resourceType: [
    { value: "assembly", label: "Assembly" },
    { value: "assessment_revision", label: "Assessment and revision" },
    { value: "game_puzzle_quiz", label: "Game/puzzle/quiz" },
    { value: "audio_music_video", label: "Audio, music & video" },
    { value: "lesson_complete", label: "Lesson (complete)" },
    { value: "other", label: "Other" },
    { value: "unit_of_work", label: "Unit of work" },
    { value: "visual_aid_display", label: "Visual aid/Display" },
    { value: "worksheet_activity", label: "Worksheet/Activity" },
  ],

  subject: [
    { value: "aboriginal_islander_languages", label: "Aboriginal and Islander languages" },
    { value: "aboriginal_studies", label: "Aboriginal studies" },
    { value: "afrikaans", label: "Afrikaans" },
    { value: "albanian", label: "Albanian" },
    { value: "amharic", label: "Amharic" },
    { value: "anthropology", label: "Anthropology" },
    { value: "arabic", label: "Arabic" },
    { value: "art_design", label: "Art and design" },
    { value: "belarussian", label: "Belarussian" },
    { value: "bengali", label: "Bengali" },
    { value: "biology", label: "Biology" },
    { value: "bosnian", label: "Bosnian" },
    { value: "bulgarian", label: "Bulgarian" },
    { value: "business_finance", label: "Business and finance" },
    { value: "cantonese", label: "Cantonese" },
    { value: "catalan", label: "Catalan" },
    { value: "chemistry", label: "Chemistry" },
    { value: "citizenship", label: "Citizenship" },
    { value: "classics", label: "Classics" },
    { value: "computing", label: "Computing" },
    { value: "core_ib", label: "Core IB" },
    { value: "croatian", label: "Croatian" },
    { value: "cross_curricular", label: "Cross-curricular topics" },
    { value: "czech", label: "Czech" },
    { value: "danish", label: "Danish" },
    { value: "design_engineering_technology", label: "Design, engineering and technology" },
    { value: "drama", label: "Drama" },
    { value: "dutch", label: "Dutch" },
    { value: "economics", label: "Economics" },
    { value: "english", label: "English" },
    { value: "english_language_learning", label: "English language learning" },
    { value: "estonian", label: "Estonian" },
    { value: "expressive_arts_design", label: "Expressive arts and design" },
    { value: "finnish", label: "Finnish" },
    { value: "french", label: "French" },
    { value: "geography", label: "Geography" },
    { value: "german", label: "German" },
    { value: "government_politics", label: "Government and politics" },
    { value: "greek", label: "Greek" },
    { value: "gujarati", label: "Gujarati" },
    { value: "hebrew", label: "Hebrew" },
    { value: "hindi", label: "Hindi" },
    { value: "history", label: "History" },
    { value: "hungarian", label: "Hungarian" },
    { value: "icelandic", label: "Icelandic" },
    { value: "indonesian", label: "Indonesian" },
    { value: "irish_gaelic", label: "Irish Gaelic" },
    { value: "italian", label: "Italian" },
    { value: "japanese", label: "Japanese" },
    { value: "korean", label: "Korean" },
    { value: "latvian", label: "Latvian" },
    { value: "law_legal_studies", label: "Law and legal studies" },
    { value: "literacy_early_years", label: "Literacy for early years" },
    { value: "lithuanian", label: "Lithuanian" },
    { value: "macedonian", label: "Macedonian" },
    { value: "malay", label: "Malay" },
    { value: "mandarin", label: "Mandarin" },
    { value: "mathematics", label: "Mathematics" },
    { value: "maths_early_years", label: "Maths for early years" },
    { value: "media_studies", label: "Media studies" },
    { value: "music", label: "Music" },
    { value: "nepali", label: "Nepali" },
    { value: "new_teachers", label: "New teachers" },
    { value: "norwegian", label: "Norwegian" },
    { value: "pedagogy_professional_development", label: "Pedagogy and professional development" },
    { value: "persian", label: "Persian" },
    { value: "personal_social_health_education", label: "Personal, social and health education" },
    { value: "philosophy_ethics", label: "Philosophy and ethics" },
    { value: "physical_development", label: "Physical development" },
    { value: "physical_education", label: "Physical education" },
    { value: "physics", label: "Physics" },
    { value: "pilipino", label: "Pilipino" },
    { value: "polish", label: "Polish" },
    { value: "portuguese", label: "Portuguese" },
    { value: "primary_science", label: "Primary science" },
    { value: "psychology", label: "Psychology" },
    { value: "punjabi", label: "Punjabi" },
    { value: "religious_education", label: "Religious education" },
    { value: "romanian", label: "Romanian" },
    { value: "russian", label: "Russian" },
    { value: "scottish_gaelic", label: "Scottish Gaelic" },
    { value: "serbian", label: "Serbian" },
    { value: "sesotho", label: "Sesotho" },
    { value: "sinhalese", label: "Sinhalese" },
    { value: "siswati", label: "Siswati" },
    { value: "slovak", label: "Slovak" },
    { value: "sociology", label: "Sociology" },
    { value: "spanish", label: "Spanish" },
    { value: "special_educational_needs", label: "Special educational needs" },
    { value: "student_careers_advice", label: "Student careers advice" },
    { value: "swahili", label: "Swahili" },
    { value: "swedish", label: "Swedish" },
    { value: "tamil", label: "Tamil" },
    { value: "thai", label: "Thai" },
    { value: "turkish", label: "Turkish" },
    { value: "ukrainian", label: "Ukrainian" },
    { value: "understanding_the_world", label: "Understanding the world" },
    { value: "urdu", label: "Urdu" },
    { value: "vietnamese", label: "Vietnamese" },
    { value: "vocational_studies", label: "Vocational studies" },
    { value: "welsh", label: "Welsh" },
    { value: "whole_school", label: "Whole school" },
  ],

  ageRange: [
    { value: "3-5", label: "3-5" },
    { value: "5-7", label: "5-7" },
    { value: "7-11", label: "7-11" },
    { value: "11-14", label: "11-14" },
    { value: "14-16", label: "14-16" },
    { value: "16+", label: "16+" },
    { value: "age_not_applicable", label: "Age not applicable" },
  ],

  curriculum: [
    { value: "no_curriculum", label: "No curriculum" },
    { value: "american", label: "American" },
    { value: "australian", label: "Australian" },
    { value: "canadian", label: "Canadian" },
    { value: "english", label: "English" },
    { value: "international", label: "International" },
    { value: "irish", label: "Irish" },
    { value: "new_zealand", label: "New Zealand" },
    { value: "northern_irish", label: "Northern Irish" },
    { value: "scottish", label: "Scottish" },
    { value: "welsh", label: "Welsh" },
    { value: "zambian", label: "Zambian" },
  ],

  curriculumType: [
    { value: "no_curriculum_type", label: "No curriculum type" },
    { value: "cambridge", label: "Cambridge" },
    { value: "foundation_stage", label: "Foundation Stage" },
    { value: "ib_pyp", label: "IB PYP" },
    { value: "ipc", label: "IPC" },
    { value: "ipc_ieyc", label: "IPC/IEYC" },
    { value: "montessori", label: "Montessori" },
    { value: "northern_ireland_curriculum", label: "Northern Ireland Curriculum" },
    { value: "schools_own", label: "School's own" },
    { value: "waldorf_steiner", label: "Waldorf/Steiner" },
  ],

  resourceVisibility: [
    { value: "public", label: "Public", description: "Visible to everyone" },
    { value: "private", label: "Private", description: "Only visible to you" },
    { value: "school_only", label: "School Only", description: "Visible only to schools" },
    { value: "unlisted", label: "Unlisted", description: "Only accessible via direct link" },
  ],

  // ============================================
  // EDUCATION MODAL DROPDOWN
  // ============================================

  educationType: [
    { value: "university", label: "University" },
    { value: "school", label: "School" },
    { value: "professional", label: "Professional" },
  ],

  // ============================================
  // USER ROLES (for reference/filtering)
  // ============================================

  userRole: [
    { value: "teacher", label: "Teacher", description: "Find teaching opportunities worldwide" },
    { value: "school", label: "School", description: "Recruit qualified educators" },
    { value: "recruiter", label: "Recruiter", description: "Connect talent with opportunities", metadata: { comingSoon: true } },
    { value: "supplier", label: "Supplier", description: "Provide educational resources", metadata: { comingSoon: true } },
  ],

  // ============================================
  // RESOURCE CURRENCIES
  // ============================================

  resourceCurrency: [
    { value: "GBP", label: "British Pound (£)", metadata: { symbol: "£", code: "GBP" } },
    { value: "USD", label: "US Dollar ($)", metadata: { symbol: "$", code: "USD" } },
    { value: "EUR", label: "Euro (€)", metadata: { symbol: "€", code: "EUR" } },
    { value: "PKR", label: "Pakistani Rupee (₨)", metadata: { symbol: "₨", code: "PKR" } },
  ],

  // Currency category (alias for resourceCurrency - used in UploadResource forms)
  currency: [
    { value: "GBP", label: "£ British Pound", metadata: { symbol: "£", code: "GBP" } },
    { value: "USD", label: "$ US Dollar", metadata: { symbol: "$", code: "USD" } },
    { value: "EUR", label: "€ Euro", metadata: { symbol: "€", code: "EUR" } },
    { value: "PKR", label: "₨ Pakistani Rupee", metadata: { symbol: "₨", code: "PKR" } },
  ],

  // ============================================
  // JOB EXPERIENCE LEVELS
  // ============================================

  experienceLevel: [
    { value: "entry", label: "Entry Level (0-2 years)" },
    { value: "mid", label: "Mid Level (3-5 years)" },
    { value: "senior", label: "Senior (6-10 years)" },
    { value: "expert", label: "Expert (10+ years)" },
  ],

  // ============================================
  // SCHOOL TYPES
  // ============================================

  schoolType: [
    { value: "public", label: "Public School" },
    { value: "private", label: "Private School" },
    { value: "charter", label: "Charter School" },
    { value: "international", label: "International School" },
    { value: "boarding", label: "Boarding School" },
    { value: "religious", label: "Religious School" },
    { value: "montessori", label: "Montessori School" },
    { value: "waldorf", label: "Waldorf School" },
    { value: "online", label: "Online School" },
  ],

  // ============================================
  // GENDER TYPES (for schools)
  // ============================================

  genderType: [
    { value: "coed", label: "Co-educational" },
    { value: "boys", label: "Boys Only" },
    { value: "girls", label: "Girls Only" },
  ],

  // ============================================
  // LANGUAGE PROFICIENCY LEVELS
  // ============================================

  languageProficiency: [
    { value: "native", label: "Native" },
    { value: "fluent", label: "Fluent" },
    { value: "advanced", label: "Advanced" },
    { value: "intermediate", label: "Intermediate" },
    { value: "basic", label: "Basic" },
  ],

  // ============================================
  // QUALIFICATION LEVELS
  // ============================================

  qualificationLevel: [
    { value: "high_school", label: "High School Diploma" },
    { value: "associate", label: "Associate Degree" },
    { value: "bachelor", label: "Bachelor's Degree" },
    { value: "master", label: "Master's Degree" },
    { value: "doctorate", label: "Doctorate (PhD)" },
    { value: "postgraduate", label: "Postgraduate Certificate" },
    { value: "professional", label: "Professional Certification" },
  ],

  // ============================================
  // APPLICATION STATUS
  // ============================================

  applicationStatus: [
    { value: "pending", label: "Pending", color: "#FFA500" },
    { value: "reviewing", label: "Reviewing", color: "#3B82F6" },
    { value: "shortlisted", label: "Shortlisted", color: "#8B5CF6" },
    { value: "interviewed", label: "Interviewed", color: "#06B6D4" },
    { value: "accepted", label: "Accepted", color: "#22C55E" },
    { value: "rejected", label: "Rejected", color: "#EF4444" },
    { value: "withdrawn", label: "Withdrawn", color: "#6B7280" },
  ],

  // ============================================
  // JOB STATUS
  // ============================================

  jobStatus: [
    { value: "draft", label: "Draft", color: "#6B7280" },
    { value: "published", label: "Published", color: "#22C55E" },
    { value: "expired", label: "Expired", color: "#FFA500" },
    { value: "closed", label: "Closed", color: "#EF4444" },
    { value: "deleted", label: "Deleted", color: "#374151" },
  ],

  // ============================================
  // RESOURCE STATUS
  // ============================================

  resourceStatus: [
    { value: "draft", label: "Draft", color: "#6B7280" },
    { value: "pending", label: "Pending Review", color: "#FFA500" },
    { value: "approved", label: "Approved", color: "#22C55E" },
    { value: "rejected", label: "Rejected", color: "#EF4444" },
  ],

  // ============================================
  // FORUM CATEGORIES
  // ============================================

  forumCategory: [
    { value: "teaching-tips", label: "Teaching Tips & Strategies" },
    { value: "curriculum", label: "Curriculum & Resources" },
    { value: "career-advice", label: "Career Advice" },
    { value: "help-support", label: "Help & Support" },
    { value: "general-discussion", label: "General Discussion" },
    { value: "classroom-management", label: "Classroom Management" },
    { value: "technology", label: "Educational Technology" },
    { value: "professional-development", label: "Professional Development" },
  ],

  // ============================================
  // PAYOUT METHODS
  // ============================================

  payoutMethod: [
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "paypal", label: "PayPal" },
    { value: "stripe", label: "Stripe" },
    { value: "wise", label: "Wise (TransferWise)" },
  ],
};

// ============================================
// SEEDER FUNCTION
// ============================================

async function seedDropdowns() {
  try {
    console.log("🌱 Starting dropdown seeder...");

    // Connect to database
    await connectDB();
    console.log("✅ Connected to database");

    // Ask user if they want to clear existing data
    const args = process.argv.slice(2);
    const shouldClear = args.includes("--clear");

    if (shouldClear) {
      console.log("🗑️  Clearing existing dropdown options...");
      await DropdownOption.deleteMany({});
      console.log("✅ Cleared existing options");
    }

    // Seed each category
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const [category, options] of Object.entries(dropdownData)) {
      console.log(`\n📦 Processing category: ${category}`);

      for (let i = 0; i < options.length; i++) {
        const option = options[i];

        try {
          // Check if already exists
          const existing = await DropdownOption.findOne({
            category,
            value: option.value,
          });

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Create new option
          await DropdownOption.create({
            category,
            value: option.value,
            label: option.label,
            description: option.description || null,
            parentCategory: option.parentCategory || null,
            parentValue: option.parentValue || null,
            sortOrder: i,
            isActive: true,
            icon: option.icon || null,
            color: option.color || null,
            metadata: option.metadata || {},
          });

          totalInserted++;
        } catch (error) {
          if (error.code === 11000) {
            totalSkipped++;
          } else {
            console.error(`  ❌ Error inserting ${option.value}:`, error.message);
          }
        }
      }

      console.log(`  ✅ Processed ${options.length} options`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Seeding Summary:");
    console.log(`   Total categories: ${Object.keys(dropdownData).length}`);
    console.log(`   Total inserted: ${totalInserted}`);
    console.log(`   Total skipped (already exists): ${totalSkipped}`);
    console.log("=".repeat(50));

    // Show category counts
    const categories = await DropdownOption.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log("\n📋 Options per category:");
    categories.forEach(({ _id, count }) => {
      console.log(`   ${_id}: ${count}`);
    });

    console.log("\n✅ Dropdown seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run seeder
seedDropdowns();
