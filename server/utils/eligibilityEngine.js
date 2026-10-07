/**
 * Evaluates whether a student profile meets the placement drive eligibility criteria.
 * @param {Object} profile - The student's academic profile
 * @param {Object} criteria - The placement drive's eligibility criteria
 * @returns {Object} { isEligible: boolean, reasons: string[] }
 */
const checkEligibility = (profile, criteria) => {
  const reasons = [];
  let isEligible = true;

  if (!profile) {
    return {
      isEligible: false,
      reasons: ['Student profile is incomplete. Please complete your academic profile to check eligibility.'],
    };
  }

  // Check CGPA
  if (criteria.minCgpa > 0) {
    if (profile.cgpa === undefined || profile.cgpa === null) {
      isEligible = false;
      reasons.push(`CGPA is missing in profile. Required minimum is ${criteria.minCgpa}.`);
    } else if (profile.cgpa < criteria.minCgpa) {
      isEligible = false;
      reasons.push(`CGPA (${profile.cgpa}) is below the required minimum of ${criteria.minCgpa}.`);
    }
  }

  // Check Backlogs
  if (criteria.maxBacklogs >= 0) {
    const studentBacklogs = profile.backlogs || 0;
    if (studentBacklogs > criteria.maxBacklogs) {
      isEligible = false;
      reasons.push(`Active backlogs (${studentBacklogs}) exceed the maximum allowed (${criteria.maxBacklogs}).`);
    }
  }

  // Check Required Courses
  if (criteria.requiredCourses && criteria.requiredCourses.length > 0) {
    if (!profile.course) {
      isEligible = false;
      reasons.push('Course information is missing in your profile.');
    } else {
      const match = criteria.requiredCourses.some((c) => c.toLowerCase() === profile.course.toLowerCase());
      if (!match) {
        isEligible = false;
        reasons.push(`Your course (${profile.course}) is not eligible for this drive. Required: ${criteria.requiredCourses.join(', ')}.`);
      }
    }
  }

  // Check Required Skills
  if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
    const studentSkills = (profile.skills || []).map((s) => s.toLowerCase());
    const missingSkills = criteria.requiredSkills.filter(
      (skill) => !studentSkills.includes(skill.toLowerCase())
    );

    if (missingSkills.length > 0) {
      isEligible = false;
      reasons.push(`Missing required skills: ${missingSkills.join(', ')}.`);
    }
  }

  // If eligible, provide a positive reason
  if (isEligible) {
    reasons.push('You meet all eligibility criteria for this drive.');
  }

  return {
    isEligible,
    reasons,
  };
};

module.exports = {
  checkEligibility,
};
