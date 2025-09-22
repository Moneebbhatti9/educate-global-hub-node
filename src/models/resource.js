const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },

    type: {
      type: String,
      enum: [
        "Assembly",
        "Assessment and revision",
        "Game/puzzle/quiz",
        "Audio, music & video",
        "Lesson (complete)",
        "Other",
        "Unit of work",
        "Visual aid/Display",
        "Worksheet/Activity",
      ],
      required: true,
    },

    ageRange: {
      type: String,
      enum: [
        "3-5",
        "5-7",
        "7-11",
        "11-14",
        "14-16",
        "16+",
        "Age not applicable",
      ],
      required: true,
    },

    curriculum: {
      type: String,
      enum: [
        "No curriculum",
        "American",
        "Australian",
        "Canadian",
        "English",
        "International",
        "Irish",
        "New Zealand",
        "Northern Irish",
        "Scottish",
        "Welsh",
        "Zambian",
      ],
      required: true,
    },

    curriculumType: {
      type: String,
      enum: [
        "No curriculum type",
        "Cambridge",
        "Foundation Stage",
        "IB PYP",
        "IPC",
        "IPC/IEYC",
        "Montessori",
        "Northern Ireland Curriculum",
        "School's own",
        "Waldorf/Steiner",
      ],
      required: true,
    },

    subject: {
      type: String,
      enum: [
        "Aboriginal and Islander languages",
        "Aboriginal studies",
        "Afrikaans",
        "Albanian",
        "Amharic",
        "Anthropology",
        "Arabic",
        "Art and design",
        "Belarussian",
        "Bengali",
        "Biology",
        "Bosnian",
        "Bulgarian",
        "Business and finance",
        "Cantonese",
        "Catalan",
        "Chemistry",
        "Citizenship",
        "Classics",
        "Computing",
        "Core IB",
        "Croatian",
        "Cross-curricular topics",
        "Czech",
        "Danish",
        "Design, engineering and technology",
        "Drama",
        "Dutch",
        "Economics",
        "English",
        "English language learning",
        "Estonian",
        "Expressive arts and design",
        "Finnish",
        "French",
        "Geography",
        "German",
        "Government and politics",
        "Greek",
        "Gujarati",
        "Hebrew",
        "Hindi",
        "History",
        "Hungarian",
        "Icelandic",
        "Indonesian",
        "Irish Gaelic",
        "Italian",
        "Japanese",
        "Korean",
        "Latvian",
        "Law and legal studies",
        "Literacy for early years",
        "Lithuanian",
        "Macedonian",
        "Malay",
        "Mandarin",
        "Mathematics",
        "Maths for early years",
        "Media studies",
        "Music",
        "Nepali",
        "New teachers",
        "Norwegian",
        "Pedagogy and professional development",
        "Persian",
        "Personal, social and health education",
        "Philosophy and ethics",
        "Physical development",
        "Physical education",
        "Physics",
        "Pilipino",
        "Polish",
        "Portuguese",
        "Primary science",
        "Psychology",
        "Punjabi",
        "Religious education",
        "Romanian",
        "Russian",
        "Scottish Gaelic",
        "Serbian",
        "Sesotho",
        "Sinhalese",
        "Siswati",
        "Slovak",
        "Sociology",
        "Spanish",
        "Special educational needs",
        "Student careers advice",
        "Swahili",
        "Swedish",
        "Tamil",
        "Thai",
        "Turkish",
        "Ukrainian",
        "Understanding the world",
        "Urdu",
        "Vietnamese",
        "Vocational studies",
        "Welsh",
        "Whole school",
      ],
      required: true,
    },

    isFree: { type: Boolean, default: false }, // Conditional validation for currency and price
    currency: {
      type: String,
      enum: ["USD", "EUR", "GBP", "PKR"],
      validate: {
        validator: function (v) {
          return this.isFree || (v !== undefined && v !== null);
        },
        message: "Currency is required for non-free resources.",
      },
    },
    price: {
      type: Number,
      validate: {
        validator: function (v) {
          return this.isFree || (v !== undefined && v !== null);
        },
        message: "Price is required for non-free resources.",
      },
    },

    publishing: {
      type: String,
      enum: ["public", "private", "school only", "unlisted"],
      default: "private",
    },

    createdBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        enum: ["teacher", "school", "admin"],
        required: true,
      },
    },

    // File references
    coverPhoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResourceFile",
      required: true,
    },
    previewImages: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ResourceFile" },
    ],
    mainFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResourceFile",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

resourceSchema.index({ "createdBy.userId": 1 });
resourceSchema.index({ status: 1 });
resourceSchema.index({ type: 1 });

module.exports = mongoose.model("Resource", resourceSchema);
