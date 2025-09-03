const Job = require("../models/Job");
const TeacherProfile = require("../models/TeacherProfile");

/**
 * Get recommended jobs for a teacher based on their profile
 * @param {string} teacherId - The teacher's user ID
 * @param {number} limit - Number of jobs to return (default: 5)
 * @returns {Array} Array of recommended jobs
 */
const getRecommendedJobsForTeacher = async (teacherId, limit = 5) => {
  try {
    // Validate inputs
    if (!teacherId || !limit || limit < 1 || limit > 50) {
      throw new Error("Invalid parameters provided");
    }

    // Get teacher profile
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });
    if (!teacherProfile) {
      throw new Error("Teacher profile not found");
    }

    // Build query for job recommendations
    const query = {
      status: "published",
      applicationDeadline: { $gt: new Date() }, // Only active jobs
    };

    // Create an array to store different matching criteria
    const matchingCriteria = [];

    // 1. Subject match (highest priority)
    if (teacherProfile.subject && teacherProfile.subject.trim()) {
      matchingCriteria.push({
        subjects: { $in: [teacherProfile.subject.trim()] },
      });
    }

    // 2. Location match (country and city)
    if (teacherProfile.country && teacherProfile.country.trim()) {
      matchingCriteria.push({
        country: teacherProfile.country.trim(),
      });
    }

    if (teacherProfile.city && teacherProfile.city.trim()) {
      matchingCriteria.push({
        city: teacherProfile.city.trim(),
      });
    }

    // 3. Qualification match
    if (teacherProfile.qualification && teacherProfile.qualification.trim()) {
      matchingCriteria.push({
        qualification: teacherProfile.qualification.trim(),
      });
    }

    // 4. Experience level match
    if (
      teacherProfile.yearsOfTeachingExperience &&
      teacherProfile.yearsOfTeachingExperience >= 0
    ) {
      const experience = teacherProfile.yearsOfTeachingExperience;
      matchingCriteria.push({
        $or: [
          { minExperience: { $lte: experience } },
          { minExperience: { $exists: false } },
        ],
      });
    }

    // If we have matching criteria, use them in the query
    if (matchingCriteria.length > 0) {
      query.$or = matchingCriteria;
    }

    // Get recommended jobs with scoring
    const recommendedJobs = await Job.aggregate([
      { $match: query },
      {
        $addFields: {
          matchScore: {
            $sum: [
              // Subject match (highest weight: 10)
              {
                $cond: {
                  if: { $in: [teacherProfile.subject?.trim(), "$subjects"] },
                  then: 10,
                  else: 0,
                },
              },
              // Country match (weight: 5)
              {
                $cond: {
                  if: { $eq: [teacherProfile.country?.trim(), "$country"] },
                  then: 5,
                  else: 0,
                },
              },
              // City match (weight: 3)
              {
                $cond: {
                  if: { $eq: [teacherProfile.city?.trim(), "$city"] },
                  then: 3,
                  else: 0,
                },
              },
              // Qualification match (weight: 4)
              {
                $cond: {
                  if: {
                    $eq: [
                      teacherProfile.qualification?.trim(),
                      "$qualification",
                    ],
                  },
                  then: 4,
                  else: 0,
                },
              },
              // Experience match (weight: 2)
              {
                $cond: {
                  if: {
                    $or: [
                      {
                        $lte: [
                          "$minExperience",
                          teacherProfile.yearsOfTeachingExperience,
                        ],
                      },
                      { $eq: ["$minExperience", null] },
                    ],
                  },
                  then: 2,
                  else: 0,
                },
              },
              // Featured/Urgent bonus (weight: 1 each)
              {
                $cond: {
                  if: "$isFeatured",
                  then: 1,
                  else: 0,
                },
              },
              {
                $cond: {
                  if: "$isUrgent",
                  then: 1,
                  else: 0,
                },
              },
            ],
          },
        },
      },
      // Sort by match score (descending) and then by recency
      { $sort: { matchScore: -1, publishedAt: -1 } },
      // Limit results
      { $limit: limit },
      // Populate school information
      {
        $lookup: {
          from: "schoolprofiles",
          localField: "schoolId",
          foreignField: "_id",
          as: "school",
        },
      },
      {
        $unwind: {
          path: "$school",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Project only necessary fields
      {
        $project: {
          _id: 1,
          title: 1,
          organization: 1,
          description: 1,
          requirements: 1,
          benefits: 1,
          subjects: 1,
          educationLevel: 1,
          positionCategory: 1,
          positionSubcategory: 1,
          country: 1,
          city: 1,
          salaryMin: 1,
          salaryMax: 1,
          currency: 1,
          salaryDisclose: 1,
          minExperience: 1,
          qualification: 1,
          jobType: 1,
          visaSponsorship: 1,
          quickApply: 1,
          applicationDeadline: 1,
          screeningQuestions: 1,
          tags: 1,
          isUrgent: 1,
          isFeatured: 1,
          publishedAt: 1,
          matchScore: 1,
          "school.name": 1,
          "school.logo": 1,
          "school.website": 1,
        },
      },
    ]);

    return recommendedJobs;
  } catch (error) {
    console.error("Error in getRecommendedJobsForTeacher:", error);
    throw error;
  }
};

/**
 * Get fallback jobs when no specific matches are found
 * @param {number} limit - Number of jobs to return
 * @returns {Array} Array of fallback jobs
 */
const getFallbackJobs = async (limit = 5) => {
  try {
    const fallbackJobs = await Job.aggregate([
      {
        $match: {
          status: "published",
          applicationDeadline: { $gt: new Date() },
        },
      },
      {
        $lookup: {
          from: "schoolprofiles",
          localField: "schoolId",
          foreignField: "_id",
          as: "school",
        },
      },
      {
        $unwind: {
          path: "$school",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { publishedAt: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          title: 1,
          organization: 1,
          description: 1,
          requirements: 1,
          benefits: 1,
          subjects: 1,
          educationLevel: 1,
          positionCategory: 1,
          positionSubcategory: 1,
          country: 1,
          city: 1,
          salaryMin: 1,
          salaryMax: 1,
          currency: 1,
          salaryDisclose: 1,
          minExperience: 1,
          qualification: 1,
          jobType: 1,
          visaSponsorship: 1,
          quickApply: 1,
          applicationDeadline: 1,
          screeningQuestions: 1,
          tags: 1,
          isUrgent: 1,
          isFeatured: 1,
          publishedAt: 1,
          matchScore: { $literal: 0 }, 
          "school.name": 1,
          "school.logo": 1,
          "school.website": 1,
        },
      },
    ]);

    return fallbackJobs;
  } catch (error) {
    console.error("Error in getFallbackJobs:", error);
    throw error;
  }
};

module.exports = {
  getRecommendedJobsForTeacher,
  getFallbackJobs,
};
