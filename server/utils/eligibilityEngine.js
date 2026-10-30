/**
 * Resolves the effective undergraduate grading basis for a placement drive's eligibility criteria.
 * Follows strict priority:
 * 1. Explicit criteria.ugCriteriaType ('CGPA' | 'PERCENTAGE' | 'NONE')
 * 2. Legacy fallback: (criteria.minCgpa > 0 ? 'CGPA' : 'NONE')
 *
 * @param {Object} criteria - The drive's eligibility criteria object or subdocument
 * @returns {'CGPA' | 'PERCENTAGE' | 'NONE'} The resolved undergraduate evaluation basis
 */
const resolveUgBasis = (criteria) => {
  if (criteria && typeof criteria.ugCriteriaType === 'string') {
    const normalized = criteria.ugCriteriaType.trim().toUpperCase();
    if (['CGPA', 'PERCENTAGE', 'NONE'].includes(normalized)) {
      return normalized;
    }
  }

  // Legacy fallback: if criteria has minCgpa > 0, fallback to CGPA; otherwise NONE
  if (
    criteria &&
    typeof criteria.minCgpa === 'number' &&
    Number.isFinite(criteria.minCgpa) &&
    criteria.minCgpa > 0
  ) {
    return 'CGPA';
  }

  return 'NONE';
};

/**
 * Checks whether a value is a strict finite number (not NaN, not Infinity, not string, not null).
 * @param {*} val
 * @returns {boolean}
 */
const isStrictFiniteNumber = (val) => {
  return typeof val === 'number' && Number.isFinite(val);
};

/**
 * Evaluates whether a student profile meets the placement drive eligibility criteria.
 * Evaluates 10th %, 12th/Diploma %, UG basis (CGPA or Percentage), backlogs, courses, and skills.
 *
 * @param {Object} profile - The student's academic profile
 * @param {Object} criteria - The placement drive's eligibility criteria
 * @returns {{ isEligible: boolean, reasons: string[] }}
 */
const checkEligibility = (profile, criteria) => {
  const reasons = [];

  if (!profile) {
    return {
      isEligible: false,
      reasons: ['Student profile is incomplete. Please complete your academic profile to check eligibility.'],
    };
  }

  const safeCriteria = criteria || {};

  // 1. Check 10th Standard Percentage
  if (isStrictFiniteNumber(safeCriteria.minTenthPercentage) && safeCriteria.minTenthPercentage > 0) {
    if (!isStrictFiniteNumber(profile.tenthPercentage) || profile.tenthPercentage < 0 || profile.tenthPercentage > 100) {
      reasons.push(
        `10th Standard percentage is missing in your profile. Required minimum is ${safeCriteria.minTenthPercentage}%.`
      );
    } else if (profile.tenthPercentage < safeCriteria.minTenthPercentage) {
      reasons.push(
        `10th Standard percentage (${profile.tenthPercentage}%) is below the required minimum of ${safeCriteria.minTenthPercentage}%.`
      );
    }
  }

  // 2. Check 12th Standard / Diploma Percentage
  if (isStrictFiniteNumber(safeCriteria.minTwelfthPercentage) && safeCriteria.minTwelfthPercentage > 0) {
    if (!isStrictFiniteNumber(profile.twelfthPercentage) || profile.twelfthPercentage < 0 || profile.twelfthPercentage > 100) {
      reasons.push(
        `12th Standard / Diploma percentage is missing in your profile. Required minimum is ${safeCriteria.minTwelfthPercentage}%.`
      );
    } else if (profile.twelfthPercentage < safeCriteria.minTwelfthPercentage) {
      reasons.push(
        `12th Standard / Diploma percentage (${profile.twelfthPercentage}%) is below the required minimum of ${safeCriteria.minTwelfthPercentage}%.`
      );
    }
  }

  // 3. Check Undergraduate (UG) Requirement using the explicitly resolved basis
  const ugBasis = resolveUgBasis(safeCriteria);

  if (ugBasis === 'CGPA') {
    if (isStrictFiniteNumber(safeCriteria.minCgpa) && safeCriteria.minCgpa > 0) {
      if (!isStrictFiniteNumber(profile.cgpa) || profile.cgpa < 0 || profile.cgpa > 10) {
        reasons.push(
          `Undergraduate CGPA is missing in your profile. Required minimum is ${safeCriteria.minCgpa}.`
        );
      } else if (profile.cgpa < safeCriteria.minCgpa) {
        reasons.push(
          `Undergraduate CGPA (${profile.cgpa}) is below the required minimum of ${safeCriteria.minCgpa}.`
        );
      }
    }
  } else if (ugBasis === 'PERCENTAGE') {
    if (isStrictFiniteNumber(safeCriteria.minUgPercentage) && safeCriteria.minUgPercentage > 0) {
      if (!isStrictFiniteNumber(profile.ugPercentage) || profile.ugPercentage < 0 || profile.ugPercentage > 100) {
        reasons.push(
          `Undergraduate percentage is missing in your profile. Required minimum is ${safeCriteria.minUgPercentage}%.`
        );
      } else if (profile.ugPercentage < safeCriteria.minUgPercentage) {
        reasons.push(
          `Undergraduate percentage (${profile.ugPercentage}%) is below the required minimum of ${safeCriteria.minUgPercentage}%.`
        );
      }
    }
  }
  // When ugBasis === 'NONE', neither CGPA nor UG percentage is required or evaluated.

  // 4. Check Backlogs
  if (safeCriteria.maxBacklogs !== undefined && safeCriteria.maxBacklogs >= 0) {
    const studentBacklogs = isStrictFiniteNumber(profile.backlogs) ? profile.backlogs : 0;
    if (studentBacklogs > safeCriteria.maxBacklogs) {
      reasons.push(
        `Active backlogs (${studentBacklogs}) exceed the maximum allowed (${safeCriteria.maxBacklogs}).`
      );
    }
  }

  // 5. Check Required Courses
  if (safeCriteria.requiredCourses && safeCriteria.requiredCourses.length > 0) {
    if (!profile.course || typeof profile.course !== 'string' || !profile.course.trim()) {
      reasons.push('Course information is missing in your profile.');
    } else {
      const match = safeCriteria.requiredCourses.some(
        (c) => typeof c === 'string' && c.trim().toLowerCase() === profile.course.trim().toLowerCase()
      );
      if (!match) {
        reasons.push(
          `Your course (${profile.course}) is not eligible for this drive. Required: ${safeCriteria.requiredCourses.join(', ')}.`
        );
      }
    }
  }

  // 6. Check Required Skills
  if (safeCriteria.requiredSkills && safeCriteria.requiredSkills.length > 0) {
    const studentSkills = Array.isArray(profile.skills)
      ? profile.skills.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
      : [];
    const missingSkills = safeCriteria.requiredSkills.filter(
      (skill) => typeof skill === 'string' && !studentSkills.includes(skill.trim().toLowerCase())
    );

    if (missingSkills.length > 0) {
      reasons.push(`Missing required skills: ${missingSkills.join(', ')}.`);
    }
  }

  const isEligible = reasons.length === 0;

  if (isEligible) {
    reasons.push('You meet all eligibility criteria for this drive.');
  }

  return {
    isEligible,
    reasons,
  };
};

module.exports = {
  resolveUgBasis,
  checkEligibility,
};
