/**
 * Seed Jobs & Active Ads
 * Creates 5 published jobs and 5 ACTIVE ad requests for UI testing.
 *
 * Run with: node src/seeds/seedJobsAndAds.js
 * Clear & reseed: node src/seeds/seedJobsAndAds.js --clear
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/database");
const Job = require("../models/Job");
const AdTier = require("../models/AdTier");
const AdRequest = require("../models/AdRequest");
const User = require("../models/User");
const SchoolProfile = require("../models/SchoolProfile");

// Placeholder banner images (colorful gradients via placeholder services)
const BANNER_IMAGES = [
  "https://placehold.co/1200x400/1a56db/ffffff?text=International+School+of+London+-+Hiring+Now!",
  "https://placehold.co/1200x400/059669/ffffff?text=Dubai+Academy+-+Math+Teachers+Wanted",
  "https://placehold.co/1200x400/9333ea/ffffff?text=Singapore+International+-+Join+Our+Team",
  "https://placehold.co/1200x400/dc2626/ffffff?text=Tokyo+British+School+-+Apply+Today",
  "https://placehold.co/1200x400/d97706/ffffff?text=Berlin+International+School+-+Teaching+Abroad",
];

const JOBS_DATA = [
  {
    title: "Secondary Mathematics Teacher",
    organization: "International School of London",
    description:
      "We are looking for an enthusiastic and experienced Mathematics teacher to join our dynamic secondary school team. The ideal candidate will have a passion for teaching and the ability to inspire students to achieve their full potential in mathematics. You will be responsible for planning and delivering engaging lessons, assessing student progress, and contributing to the wider school community.",
    requirements: [
      "Bachelor's degree in Mathematics or related field",
      "QTS or equivalent teaching qualification",
      "Minimum 2 years teaching experience",
      "Experience with IB or IGCSE curriculum",
    ],
    benefits: [
      "Competitive salary package",
      "Housing allowance",
      "Annual flights home",
      "Health insurance",
    ],
    subjects: ["Mathematics", "Further Mathematics"],
    educationLevel: "secondary",
    positionCategory: "Teaching",
    positionSubcategory: "Mathematics",
    country: "United Kingdom",
    city: "London",
    salaryMin: 45000,
    salaryMax: 65000,
    currency: "GBP",
    salaryDisclose: true,
    minExperience: 2,
    qualification: "Bachelor's Degree",
    jobType: "full_time",
    applicantEmail: "jobs@islondon.edu",
  },
  {
    title: "Primary Classroom Teacher",
    organization: "Dubai International Academy",
    description:
      "Dubai International Academy is seeking a creative and dedicated Primary Classroom Teacher to join our thriving school community. You will be responsible for delivering the British curriculum to students aged 5-11, creating a stimulating and inclusive classroom environment. This is a fantastic opportunity to work in a world-class educational setting with excellent facilities and professional development opportunities.",
    requirements: [
      "Bachelor's degree in Education or relevant subject",
      "PGCE or equivalent qualification",
      "At least 2 years of primary teaching experience",
      "Familiarity with UK National Curriculum",
    ],
    benefits: [
      "Tax-free salary",
      "Furnished accommodation",
      "Annual return flights",
      "Tuition fee discount for children",
    ],
    subjects: ["General Primary", "English"],
    educationLevel: "primary",
    positionCategory: "Teaching",
    positionSubcategory: "Primary Education",
    country: "United Arab Emirates",
    city: "Dubai",
    salaryMin: 35000,
    salaryMax: 50000,
    currency: "USD",
    salaryDisclose: true,
    minExperience: 2,
    qualification: "Bachelor's Degree",
    jobType: "full_time",
    applicantEmail: "careers@dubaiintacademy.ae",
  },
  {
    title: "IB Physics Teacher",
    organization: "Singapore International School",
    description:
      "Singapore International School invites applications for the position of IB Physics Teacher. The successful candidate will teach Physics across the IB Diploma Programme and MYP. We seek a highly qualified professional who can deliver innovative and engaging science education, mentor students in their Extended Essays and Internal Assessments, and contribute to our vibrant STEM programme. Our school offers state-of-the-art laboratories and technology resources.",
    requirements: [
      "Master's or Bachelor's degree in Physics",
      "IB teaching certification or willingness to obtain",
      "Minimum 3 years IB teaching experience",
      "Strong practical lab skills",
    ],
    benefits: [
      "Relocation package",
      "CPD funding",
      "Modern science facilities",
      "International community",
    ],
    subjects: ["Physics", "Science"],
    educationLevel: "high_school",
    positionCategory: "Teaching",
    positionSubcategory: "Sciences",
    country: "Singapore",
    city: "Singapore",
    salaryMin: 55000,
    salaryMax: 80000,
    currency: "USD",
    salaryDisclose: true,
    minExperience: 3,
    qualification: "Master's Degree",
    jobType: "full_time",
    applicantEmail: "recruit@singintschool.edu.sg",
  },
  {
    title: "Early Years Foundation Stage Teacher",
    organization: "Tokyo British School",
    description:
      "Tokyo British School is looking for a warm, creative, and energetic EYFS Teacher to lead our Reception class. The ideal candidate will have a thorough understanding of the Early Years Foundation Stage framework and be passionate about play-based learning. You will plan and deliver a rich curriculum that supports the holistic development of children aged 4-5, working closely with teaching assistants and parents to ensure every child thrives.",
    requirements: [
      "Bachelor's degree in Early Childhood Education",
      "QTS or equivalent",
      "EYFS curriculum experience required",
      "First Aid certified",
    ],
    benefits: [
      "Competitive salary in JPY",
      "Visa sponsorship provided",
      "Japanese language lessons",
      "End of contract bonus",
    ],
    subjects: ["Early Years", "Phonics"],
    educationLevel: "early_years",
    positionCategory: "Teaching",
    positionSubcategory: "Early Years",
    country: "Japan",
    city: "Tokyo",
    salaryMin: 30000,
    salaryMax: 42000,
    currency: "USD",
    salaryDisclose: true,
    minExperience: 1,
    qualification: "Bachelor's Degree",
    jobType: "full_time",
    visaSponsorship: true,
    applicantEmail: "hr@tokyobritishschool.jp",
  },
  {
    title: "Head of Modern Languages Department",
    organization: "Berlin International School",
    description:
      "Berlin International School is recruiting an experienced Head of Modern Languages to lead our thriving languages department. This senior leadership role involves overseeing the teaching of French, Spanish, and German across all year groups, managing a team of six language teachers, and driving curriculum development. The ideal candidate will be a passionate linguist and proven leader who can inspire both students and staff while maintaining the highest academic standards.",
    requirements: [
      "Master's degree in Languages or Education",
      "At least 5 years teaching experience with leadership",
      "Fluent in at least two European languages",
      "Experience in curriculum development",
    ],
    benefits: [
      "Leadership salary scale",
      "Relocation support",
      "Professional development budget",
      "Pension contributions",
    ],
    subjects: ["French", "Spanish", "German"],
    educationLevel: "secondary",
    positionCategory: "Leadership",
    positionSubcategory: "Languages",
    country: "Germany",
    city: "Berlin",
    salaryMin: 60000,
    salaryMax: 85000,
    currency: "EUR",
    salaryDisclose: true,
    minExperience: 5,
    qualification: "Master's Degree",
    jobType: "full_time",
    applicantEmail: "recruitment@berlinintschool.de",
  },
];

const AD_HEADLINES = [
  "Join London's Leading International School",
  "Teach in Sunny Dubai - Tax Free!",
  "World-Class IB Education in Singapore",
  "Experience Teaching in Japan",
  "Lead Languages in the Heart of Europe",
];

async function seedJobsAndAds() {
  try {
    console.log("Starting Jobs & Ads seeder...");
    await connectDB();
    console.log("Connected to database");

    const args = process.argv.slice(2);
    const shouldClear = args.includes("--clear");

    if (shouldClear) {
      console.log("Clearing existing seeded jobs and ad requests...");
      await Job.deleteMany({ applicantEmail: { $regex: /^(jobs@|careers@|recruit@|hr@|recruitment@)/ } });
      await AdRequest.deleteMany({ headline: { $in: AD_HEADLINES } });
      console.log("Cleared seeded data");
    }

    // Find or validate we have a school user
    let schoolUser = await User.findOne({ role: "school" });
    if (!schoolUser) {
      console.log("No school user found. Creating a test school user...");
      schoolUser = await User.create({
        name: "Test School Account",
        email: "testschool@educatelink.com",
        password: "TestSchool123!",
        role: "school",
        isVerified: true,
        profileCompleted: true,
      });
      console.log(`Created test school user: ${schoolUser._id}`);
    } else {
      console.log(`Found school user: ${schoolUser.name} (${schoolUser._id})`);
    }

    // Find or create school profile for this user
    let schoolProfile = await SchoolProfile.findOne({ userId: schoolUser._id });
    if (!schoolProfile) {
      console.log("No school profile found. Creating one...");
      schoolProfile = await SchoolProfile.create({
        userId: schoolUser._id,
        schoolName: schoolUser.name || "Test International School",
        schoolEmail: schoolUser.email,
        schoolContactNumber: "+441234567890",
        country: "United Kingdom",
        city: "London",
        address: "123 Education Lane",
        schoolType: "international",
        curriculumType: ["British"],
        description: "A leading international school for testing purposes.",
      });
      console.log(`Created school profile: ${schoolProfile._id}`);
    } else {
      console.log(`Found school profile: ${schoolProfile.schoolName} (${schoolProfile._id})`);
    }

    // Ensure ad tiers exist
    await AdTier.initializeDefaults();
    const tiers = await AdTier.find({ isActive: true }).sort({ sortOrder: 1 });
    if (tiers.length === 0) {
      console.error("No ad tiers found! Run adTierSeeder first.");
      process.exit(1);
    }
    console.log(`Found ${tiers.length} ad tiers`);

    // Create 5 jobs (bypass applicationDeadline validator by using direct insert)
    console.log("\nCreating 5 published jobs...");
    const createdJobs = [];

    for (let i = 0; i < JOBS_DATA.length; i++) {
      const jobData = JOBS_DATA[i];
      // Set deadline 60 days from now to pass validation
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 60 + i * 10);

      const job = await Job.create({
        ...jobData,
        schoolId: schoolProfile._id,
        applicationDeadline: deadline,
        status: "published",
        publishedAt: new Date(),
        isFeatured: i < 2, // first 2 are featured
        isUrgent: i === 0, // first is urgent
      });

      createdJobs.push(job);
      console.log(`  Created: ${job.title} (${job._id})`);
    }

    // Create 5 active ad requests (one per job)
    console.log("\nCreating 5 active ad requests...");

    for (let i = 0; i < createdJobs.length; i++) {
      const job = createdJobs[i];
      const tier = tiers[i % tiers.length]; // alternate between tiers
      const now = new Date();
      const activatedAt = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000); // stagger activation
      const expiresAt = new Date(activatedAt.getTime() + tier.durationDays * 24 * 60 * 60 * 1000);
      // For tiers with 0 durationDays (per-listing), set 90 days
      if (tier.durationDays === 0) {
        expiresAt.setTime(activatedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
      }

      const paidAmount = tier.launchPrice
        ? parseFloat(tier.launchPrice.toString())
        : parseFloat(tier.normalPrice.toString());

      const adRequest = await AdRequest.create({
        jobId: job._id,
        schoolId: schoolUser._id,
        tierId: tier._id,
        bannerImageUrl: BANNER_IMAGES[i],
        headline: AD_HEADLINES[i],
        description: `Explore exciting teaching opportunities at ${JOBS_DATA[i].organization}.`,
        status: "ACTIVE",
        paidAmount: mongoose.Types.Decimal128.fromString(paidAmount.toString()),
        paidCurrency: "GBP",
        paidAt: activatedAt,
        activatedAt: activatedAt,
        expiresAt: expiresAt,
        reviewedAt: new Date(activatedAt.getTime() - 24 * 60 * 60 * 1000),
      });

      console.log(`  Created ad: "${adRequest.headline}" for ${job.title} (${adRequest._id})`);
    }

    // Summary
    const totalJobs = await Job.countDocuments({ status: "published" });
    const totalAds = await AdRequest.countDocuments({ status: "ACTIVE" });

    console.log("\n--- Seeding Summary ---");
    console.log(`  Published jobs in DB: ${totalJobs}`);
    console.log(`  Active ads in DB: ${totalAds}`);
    console.log("Seeding completed!");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedJobsAndAds();
