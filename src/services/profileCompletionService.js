const TeacherEmployment = require("../models/TeacherEmployment");
const TeacherEducation = require("../models/TeacherEducation");
const TeacherQualification = require("../models/TeacherQualification");
const TeacherReferee = require("../models/TeacherReferee");
const TeacherCertification = require("../models/TeacherCertification");
const TeacherDevelopment = require("../models/TeacherDevelopment");
const TeacherMembership = require("../models/TeacherMembership");
// const TeacherAdditional = require("../models/TeacherAdditional");

/**
 * Compute profile completion as:
 * - Core profile fields: capped at 70%
 * - Presence of each section adds fixed points.
 *   employment(6), education(6), qualifications(6), certifications(6),
 *   development(6), memberships(3), referees(3), additional(4) = 40 total
 */
async function computeProfileCompletion(teacherProfileDoc) {
  const corePct = Math.min(
    70,
    Math.round(((await teacherProfileDoc.checkProfileCompletion()) / 100) * 70)
  );

  const [
    employmentCount,
    educationCount,
    qualificationCount,
    certificationCount,
    developmentCount,
    membershipCount,
    refereeCount,
    // additionalDoc,
  ] = await Promise.all([
    TeacherEmployment.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherEducation.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherQualification.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherCertification.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherDevelopment.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherMembership.countDocuments({ teacherId: teacherProfileDoc._id }),
    TeacherReferee.countDocuments({ teacherId: teacherProfileDoc._id }),
    // TeacherAdditional.findOne({ teacherId: teacherProfileDoc._id }).lean(),
  ]);

  const extra =
    (employmentCount > 0 ? 6 : 0) +
    (educationCount > 0 ? 6 : 0) +
    (qualificationCount > 0 ? 6 : 0) +
    (certificationCount > 0 ? 6 : 0) +
    (developmentCount > 0 ? 6 : 0) +
    (membershipCount > 0 ? 3 : 0) +
    (refereeCount > 0 ? 3 : 0);
  // (additionalDoc ? 4 : 0);

  return Math.min(100, corePct + extra);
}

module.exports = { computeProfileCompletion };
