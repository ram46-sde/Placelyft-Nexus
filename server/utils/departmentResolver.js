const Department = require('../models/Department');

const UNASSIGNED_LABEL = 'Unassigned / Other';

/**
 * Normalizes a department key (name, code, or alias) for robust matching:
 * 1. Trim leading and trailing whitespace
 * 2. Convert to lowercase
 * 3. Treat '&' as 'and' (e.g. "Electronics & Communication" -> "Electronics and Communication")
 * 4. Remove all dots (e.g. "C.S.E." -> "cse")
 * 5. Collapse repeated whitespace into a single space
 * 
 * @param {string} key Raw string to normalize
 * @returns {string} Normalized key
 */
function normalizeDepartmentKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates a single proposed department alias:
 * - 2-40 characters
 * - Letters, digits, space, and & . - / ( ) only
 * 
 * @param {string} alias Raw alias string
 * @returns {{ valid: boolean, error?: string, normalized?: string }}
 */
function validateAlias(alias) {
  if (typeof alias !== 'string') {
    return { valid: false, error: 'Alias must be a string.' };
  }
  const trimmed = alias.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { valid: false, error: 'Alias must be between 2 and 40 characters.' };
  }
  const allowedPattern = /^[a-zA-Z0-9\s&.\-\/()]+$/;
  if (!allowedPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Alias may only contain letters, numbers, spaces, and & . - / ( )',
    };
  }
  const normalized = normalizeDepartmentKey(trimmed);
  if (!normalized) {
    return { valid: false, error: 'Alias cannot be empty after normalization.' };
  }
  return { valid: true, normalized };
}

/**
 * Validates HOD contact fields:
 * - name: 2-100 characters (optional)
 * - email: valid format, max 254 chars, lowercase (optional)
 * - phone: digits with optional leading +, spaces, hyphens, parentheses; 7-15 digits (optional)
 * - officeLocation: max 100 characters (optional)
 * 
 * @param {Object} contact 
 * @returns {{ valid: boolean, errors?: Object, sanitized?: Object }}
 */
function validateHodContact(contact) {
  if (!contact || typeof contact !== 'object') {
    return { valid: true, sanitized: {} };
  }

  const errors = {};
  const sanitized = {};

  if (contact.name !== undefined) {
    if (contact.name === null || contact.name === '') {
      sanitized.name = null;
    } else if (typeof contact.name !== 'string') {
      errors.name = 'HOD name must be a string.';
    } else {
      const trimmed = contact.name.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        errors.name = 'HOD name must be between 2 and 100 characters.';
      } else {
        sanitized.name = trimmed;
      }
    }
  }

  if (contact.email !== undefined) {
    if (contact.email === null || contact.email === '') {
      sanitized.email = null;
    } else if (typeof contact.email !== 'string') {
      errors.email = 'HOD email must be a string.';
    } else {
      const trimmed = contact.email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (trimmed.length > 254 || !emailRegex.test(trimmed)) {
        errors.email = 'HOD email must be a valid email address (max 254 characters).';
      } else {
        sanitized.email = trimmed.toLowerCase();
      }
    }
  }

  if (contact.phone !== undefined) {
    if (contact.phone === null || contact.phone === '') {
      sanitized.phone = null;
    } else if (typeof contact.phone !== 'string') {
      errors.phone = 'HOD phone must be a string.';
    } else {
      const trimmed = contact.phone.trim();
      const phoneFormatRegex = /^\+?[\d\s\-()]+$/;
      const digitsCount = (trimmed.match(/\d/g) || []).length;
      if (!phoneFormatRegex.test(trimmed) || digitsCount < 7 || digitsCount > 15) {
        errors.phone = 'HOD phone must contain 7 to 15 digits with optional +, hyphens, spaces, or parentheses.';
      } else {
        sanitized.phone = trimmed;
      }
    }
  }

  if (contact.officeLocation !== undefined) {
    if (contact.officeLocation === null || contact.officeLocation === '') {
      sanitized.officeLocation = null;
    } else if (typeof contact.officeLocation !== 'string') {
      errors.officeLocation = 'Office location must be a string.';
    } else {
      const trimmed = contact.officeLocation.trim();
      if (trimmed.length > 100) {
        errors.officeLocation = 'Office location must not exceed 100 characters.';
      } else {
        sanitized.officeLocation = trimmed;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, sanitized };
}

/**
 * Pure function to resolve a student's department against a pre-loaded list of active departments.
 * Resolution hierarchy:
 * 1. departmentId matches an active department in the list.
 * 2. Free-text department equals department name (case/format normalized).
 * 3. Free-text department equals department code (case/format normalized).
 * 4. Free-text department equals an alias (case/format normalized).
 * 
 * Rules:
 * - If departmentId is missing, inactive, or from another college (not in departments),
 *   it falls through silently to free-text resolution.
 * - If any step yields >1 match, returns status: 'ambiguous'.
 * - Never modifies student profile or writes to database.
 * 
 * @param {Object} student Student profile or object with { departmentId, department }
 * @param {Array<Object>} departments Pre-loaded array of active departments for the college
 * @returns {{ departmentId: string|null, departmentName: string, departmentCode: string|null, status: string, originalText: string|null }}
 */
function resolveDepartment(student, departments = []) {
  const originalText = student && typeof student.department === 'string' ? student.department : null;

  // Step 1: Resolve by departmentId (must match an active department in this college's loaded list)
  if (student && student.departmentId) {
    const targetIdStr = student.departmentId.toString();
    const matchedById = departments.find(
      (dept) => dept && dept._id && dept._id.toString() === targetIdStr && dept.isActive !== false
    );

    if (matchedById) {
      return {
        departmentId: matchedById._id,
        departmentName: matchedById.name,
        departmentCode: matchedById.code,
        status: 'resolved_by_id',
        originalText,
      };
    }
    // If departmentId is not found (inactive or belongs to another college), silently fall through
  }

  // If no free-text department is available, unassigned
  if (!originalText || typeof originalText !== 'string') {
    return {
      departmentId: null,
      departmentName: UNASSIGNED_LABEL,
      departmentCode: null,
      status: 'unassigned',
      originalText: null,
    };
  }

  const normalizedInput = normalizeDepartmentKey(originalText);
  if (!normalizedInput) {
    return {
      departmentId: null,
      departmentName: UNASSIGNED_LABEL,
      departmentCode: null,
      status: 'unassigned',
      originalText,
    };
  }

  // Step 2: Compare against department name
  const nameMatches = departments.filter(
    (dept) => dept && normalizeDepartmentKey(dept.name) === normalizedInput
  );
  if (nameMatches.length === 1) {
    return {
      departmentId: nameMatches[0]._id,
      departmentName: nameMatches[0].name,
      departmentCode: nameMatches[0].code,
      status: 'resolved_by_name',
      originalText,
    };
  }
  if (nameMatches.length > 1) {
    return {
      departmentId: null,
      departmentName: UNASSIGNED_LABEL,
      departmentCode: null,
      status: 'ambiguous',
      originalText,
    };
  }

  // Step 3: Compare against department code
  const codeMatches = departments.filter(
    (dept) => dept && normalizeDepartmentKey(dept.code) === normalizedInput
  );
  if (codeMatches.length === 1) {
    return {
      departmentId: codeMatches[0]._id,
      departmentName: codeMatches[0].name,
      departmentCode: codeMatches[0].code,
      status: 'resolved_by_code',
      originalText,
    };
  }
  if (codeMatches.length > 1) {
    return {
      departmentId: null,
      departmentName: UNASSIGNED_LABEL,
      departmentCode: null,
      status: 'ambiguous',
      originalText,
    };
  }

  // Step 4: Compare against aliases
  const aliasMatches = departments.filter((dept) => {
    if (!dept || !Array.isArray(dept.aliases)) return false;
    return dept.aliases.some((alias) => normalizeDepartmentKey(alias) === normalizedInput);
  });
  if (aliasMatches.length === 1) {
    return {
      departmentId: aliasMatches[0]._id,
      departmentName: aliasMatches[0].name,
      departmentCode: aliasMatches[0].code,
      status: 'resolved_by_alias',
      originalText,
    };
  }
  if (aliasMatches.length > 1) {
    return {
      departmentId: null,
      departmentName: UNASSIGNED_LABEL,
      departmentCode: null,
      status: 'ambiguous',
      originalText,
    };
  }

  // No match
  return {
    departmentId: null,
    departmentName: UNASSIGNED_LABEL,
    departmentCode: null,
    status: 'unassigned',
    originalText,
  };
}

/**
 * Thin DB loader that fetches the active departments for a given collegeId.
 * 
 * @param {string|mongoose.Types.ObjectId} collegeId 
 * @returns {Promise<Array<Object>>}
 */
async function fetchCollegeDepartments(collegeId) {
  if (!collegeId) return [];
  return await Department.find({
    collegeId,
    isActive: true,
  }).sort({ name: 1 });
}

module.exports = {
  UNASSIGNED_LABEL,
  normalizeDepartmentKey,
  validateAlias,
  validateHodContact,
  resolveDepartment,
  fetchCollegeDepartments,
};
