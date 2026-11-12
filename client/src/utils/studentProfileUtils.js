/**
 * Pure utility function to resolve the student's department label for UI presentation.
 *
 * Rules:
 * - Returns trimmed plain-text department string.
 * - Prefers resolved department name (if departmentId is a populated object with a name) over free text.
 * - Falls back to department string if present and non-empty.
 * - Falls back to legacyDepartment if present and non-empty.
 * - Falls back to "Student" if department is missing, null, undefined, non-string, or whitespace-only.
 * - Never invents data or returns undefined/null.
 *
 * @param {Object|null|undefined} profile The student profile document
 * @returns {string} Trimmed plain-text department or "Student"
 */
export function getDepartmentLabel(profile) {
  if (!profile || typeof profile !== 'object') {
    return 'Student';
  }

  // 1. Prefer resolved department name if API populated departmentId
  if (
    profile.departmentId &&
    typeof profile.departmentId === 'object' &&
    typeof profile.departmentId.name === 'string' &&
    profile.departmentId.name.trim().length > 0
  ) {
    return profile.departmentId.name.trim();
  }

  // 2. Free text department field
  if (typeof profile.department === 'string' && profile.department.trim().length > 0) {
    return profile.department.trim();
  }

  // 3. Legacy department fallback
  if (typeof profile.legacyDepartment === 'string' && profile.legacyDepartment.trim().length > 0) {
    return profile.legacyDepartment.trim();
  }

  return 'Student';
}

