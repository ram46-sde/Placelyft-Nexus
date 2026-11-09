/**
 * CPMS Phase 4C/4D - Pure Utility Functions for Placement Metrics & Student Outcomes
 * Free of React dependencies; safe for pure Node/test execution.
 */

export const CRORE_THRESHOLD_HUNDREDTHS = 10000; // 100 LPA = 10,000 hundredths
export const UNIT_LPA = 'LPA';
export const UNIT_CR = 'Cr';
export const CURRENCY_PREFIX = '₹ ';
export const EM_DASH = '—';

/**
 * Formats a numeric CTC (in LPA) into Indian currency display format.
 * - Stored and transmitted in LPA.
 * - CTC below 100 LPA is shown in LPA (e.g. "₹ 12.5 LPA").
 * - CTC of 100 LPA or more is shown in crore (value / 100, e.g. "₹ 1.2 Cr").
 * - Trailing zeros are removed. Full precision is preserved (never rounded).
 * - Implemented using scaled integers (hundredths) without float division, toFixed, or Intl.
 * - Invalid input returns "—": null, undefined, NaN, Infinity, negatives,
 *   non-numbers (including numeric strings like "12.5"), and numbers with >2 decimal places.
 * - Zero is valid and shows "₹ 0 LPA".
 *
 * @param {*} ctc Numeric CTC in LPA
 * @returns {string} Formatted currency string or "—"
 */
export function formatCtc(ctc) {
  if (typeof ctc !== 'number' || !Number.isFinite(ctc) || ctc < 0) {
    return EM_DASH;
  }

  // Reject scientific notation
  const str = ctc.toString();
  if (str.includes('e') || str.includes('E')) {
    return EM_DASH;
  }

  // Ensure at most 2 decimal places in input
  const dotIdx = str.indexOf('.');
  if (dotIdx !== -1 && str.length - dotIdx - 1 > 2) {
    return EM_DASH;
  }

  // Exact hundredths check using scaled integer
  const hundredths = Math.round(ctc * 100);
  if (Math.abs(ctc - hundredths / 100) > 1e-9) {
    return EM_DASH;
  }

  // Threshold: 100 LPA = 10,000 hundredths
  if (hundredths >= CRORE_THRESHOLD_HUNDREDTHS) {
    const wholeCr = Math.floor(hundredths / 10000);
    const remCr = hundredths % 10000;
    if (remCr === 0) {
      return `${CURRENCY_PREFIX}${wholeCr} ${UNIT_CR}`;
    }
    const remStr = String(remCr).padStart(4, '0').replace(/0+$/, '');
    return `${CURRENCY_PREFIX}${wholeCr}.${remStr} ${UNIT_CR}`;
  }

  const wholeLpa = Math.floor(hundredths / 100);
  const remLpa = hundredths % 100;
  if (remLpa === 0) {
    return `${CURRENCY_PREFIX}${wholeLpa} ${UNIT_LPA}`;
  }
  const remStr = String(remLpa).padStart(2, '0').replace(/0+$/, '');
  return `${CURRENCY_PREFIX}${wholeLpa}.${remStr} ${UNIT_LPA}`;
}

/**
 * Normalizes the backend officer placement metrics response.
 * Tolerates null, undefined, missing, legacy, or unexpected shapes.
 * Guarantees no NaN or undefined values reach UI components.
 *
 * @param {Object|null|undefined} response
 * @returns {{
 *   verifiedSelections: number,
 *   verifiedOffers: number,
 *   highestPackage: { ctc: number, unit: string, formatted: string } | null,
 *   needsVerification: number
 * }}
 */
export function normalizePlacementMetrics(response) {
  const source = response && typeof response === 'object' ? (response.data || response) : {};

  const parseCount = (val) => {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  };

  const verifiedSelections = parseCount(source.verifiedSelections);
  const verifiedOffers = parseCount(source.verifiedOffers);
  const needsVerification = parseCount(source.needsVerification);

  let highestPackage = null;
  const rawHp = source.highestPackage;

  if (rawHp && typeof rawHp === 'object') {
    const ctcVal = Number(rawHp.ctc);
    if (Number.isFinite(ctcVal) && ctcVal >= 0) {
      highestPackage = {
        ctc: ctcVal,
        unit: typeof rawHp.unit === 'string' && rawHp.unit ? rawHp.unit : 'LPA',
        formatted: formatCtc(ctcVal),
      };
    }
  } else if (rawHp !== null && rawHp !== undefined) {
    const ctcVal = Number(rawHp);
    if (Number.isFinite(ctcVal) && ctcVal >= 0) {
      highestPackage = {
        ctc: ctcVal,
        unit: 'LPA',
        formatted: formatCtc(ctcVal),
      };
    }
  }

  return {
    verifiedSelections,
    verifiedOffers,
    highestPackage,
    needsVerification,
  };
}

/**
 * Normalizes the backend student outcomes response.
 * Tolerates null, undefined, missing, or legacy fields.
 * Guarantees valid arrays and safe primitive fields.
 *
 * @param {Object|null|undefined} response
 * @returns {{
 *   verifiedOutcomes: Array<{
 *     company: string,
 *     role: string,
 *     verifiedAt: string | null,
 *     ctc: number | null,
 *     formattedCtc: string
 *   }>,
 *   pendingSelections: Array<{
 *     applicationId: string,
 *     company: string,
 *     role: string
 *   }>,
 *   pendingSelectionsCount: number
 * }}
 */
export function normalizeStudentOutcomes(response) {
  const source = response && typeof response === 'object' ? (response.data || response) : {};

  const rawOutcomes = Array.isArray(source.verifiedOutcomes) ? source.verifiedOutcomes : [];
  const rawPending = Array.isArray(source.pendingSelections) ? source.pendingSelections : [];

  const verifiedOutcomes = rawOutcomes.map((item) => {
    if (!item || typeof item !== 'object') {
      return {
        company: 'Company',
        role: 'Role',
        verifiedAt: null,
        ctc: null,
        formattedCtc: '—',
      };
    }

    const company = typeof item.company === 'string' && item.company.trim() ? item.company.trim() : 'Company';
    const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Role';
    const verifiedAt = item.verifiedAt ? String(item.verifiedAt) : null;

    let ctc = null;
    if (typeof item.ctc === 'number' && Number.isFinite(item.ctc) && item.ctc >= 0) {
      ctc = item.ctc;
    } else if (typeof item.ctc === 'string' && item.ctc.trim()) {
      const parsed = Number(item.ctc);
      if (Number.isFinite(parsed) && parsed >= 0) {
        ctc = parsed;
      }
    }

    return {
      company,
      role,
      verifiedAt,
      ctc,
      formattedCtc: formatCtc(ctc),
    };
  });

  // Sort descending by verifiedAt (latest first)
  verifiedOutcomes.sort((a, b) => {
    if (!a.verifiedAt && !b.verifiedAt) return 0;
    if (!a.verifiedAt) return 1;
    if (!b.verifiedAt) return -1;
    const timeA = new Date(a.verifiedAt).getTime();
    const timeB = new Date(b.verifiedAt).getTime();
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
    return timeB - timeA;
  });

  const pendingSelections = rawPending.map((item) => {
    if (!item || typeof item !== 'object') {
      return {
        applicationId: '',
        company: 'Company',
        role: 'Role',
      };
    }

    const applicationId = String(item.applicationId || item._id || '');
    const company = typeof item.company === 'string' && item.company.trim() ? item.company.trim() : 'Company';
    const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Role';

    return {
      applicationId,
      company,
      role,
    };
  });

  return {
    verifiedOutcomes,
    pendingSelections,
    pendingSelectionsCount: pendingSelections.length,
  };
}

/**
 * Validates and strictly parses officer CTC input for verification dialog.
 * Rules:
 * - Must be non-negative (>= 0) and at most 200, up to 2 decimals.
 * - Unit is LPA.
 * - Reject empty-with-no-choice, negative, non-numeric, 1e2, commas (zero is valid: 0 LPA).
 * - If packageNotAvailable is true, returns { valid: true, ctc: null }.
 * 
 * @param {string} ctcInput Raw string input
 * @param {boolean} packageNotAvailable Checkbox state
 * @returns {{ valid: boolean, ctc?: number|null, error?: string }}
 */
export function validateAndParseCtcInput(ctcInput, packageNotAvailable = false) {
  if (packageNotAvailable) {
    return { valid: true, ctc: null };
  }

  if (ctcInput === null || ctcInput === undefined || String(ctcInput).trim() === '') {
    return { valid: false, error: 'Enter a valid CTC or select "Package not available".' };
  }

  const raw = String(ctcInput).trim();

  // Strict rejection of commas and scientific notation
  if (raw.includes(',')) {
    return { valid: false, error: 'Commas are not permitted in CTC. Use numbers only.' };
  }
  if (/e/i.test(raw)) {
    return { valid: false, error: 'Scientific notation is not permitted.' };
  }

  // Strict regex: positive integer or decimal with at most 2 decimal digits
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { valid: false, error: 'CTC must be a valid positive number.' };
  }

  const parts = raw.split('.');
  if (parts[1] && parts[1].length > 2) {
    return { valid: false, error: 'CTC can have at most 2 decimal places.' };
  }

  const num = Number(raw);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { valid: false, error: 'CTC must be a valid finite number.' };
  }

  if (num < 0) {
    return { valid: false, error: 'CTC cannot be negative.' };
  }

  if (num > 200) {
    return { valid: false, error: 'CTC must be at most 200 LPA.' };
  }

  return { valid: true, ctc: num };
}

/**
 * Pure function mapping backend outcome mutation results and HTTP status codes
 * to standard user-facing messages and alert kinds.
 * 
 * @param {number} status HTTP status code
 * @param {Object} body Backend response body or error body
 * @returns {{ kind: 'success' | 'info' | 'warning' | 'error', message: string }}
 */
export function mapOutcomeResult(status, body = {}) {
  const result = body && body.result;
  const code = body && body.code;
  const message = body && body.message;

  // 1. Success & Re-verification
  if (result === 'created') {
    if (body.notificationCreated === false) {
      return {
        kind: 'warning',
        message: 'Verified. The student notification could not be created.',
      };
    }
    return {
      kind: 'success',
      message: 'Placement outcome verified successfully.',
    };
  }

  if (result === 'reverified') {
    if (body.notificationCreated === false) {
      return {
        kind: 'warning',
        message: 'Verified. The student notification could not be created.',
      };
    }
    return {
      kind: 'success',
      message: 'Placement outcome re-verified successfully.',
    };
  }

  // 2. Already verified (idempotent)
  if (result === 'already_verified') {
    return {
      kind: 'info',
      message: 'This application is already verified with identical package details.',
    };
  }

  // 3. Revoked & Already Revoked
  if (result === 'revoked') {
    return {
      kind: 'success',
      message: 'Placement outcome revoked successfully.',
    };
  }

  if (result === 'already_revoked') {
    return {
      kind: 'info',
      message: 'This placement outcome is already revoked.',
    };
  }

  // 4. Package mismatch 409
  if (code === 'OUTCOME_PACKAGE_MISMATCH' || status === 409) {
    if (code === 'OUTCOME_PACKAGE_MISMATCH' || (message && message.includes('package'))) {
      return {
        kind: 'error',
        message:
          'The outcome package CTC does not match the existing verified package. To change package details, revoke the outcome first and then re-verify.',
      };
    }
  }

  // 5. Application not Selected
  if (code === 'APPLICATION_NOT_SELECTED') {
    return {
      kind: 'error',
      message: 'Only applications with status "Selected" can be verified.',
    };
  }

  // 6. Not found
  if (status === 404 || code === 'APPLICATION_NOT_FOUND' || code === 'OUTCOME_NOT_FOUND') {
    return {
      kind: 'error',
      message: message || 'Application or outcome record not found.',
    };
  }

  // 7. Validation 400s
  if (status === 400 || code === 'INVALID_CTC' || code === 'INVALID_REVOKE_REASON') {
    return {
      kind: 'error',
      message: message || 'Invalid input provided.',
    };
  }

  // Fallback
  return {
    kind: 'error',
    message: message || 'An unexpected error occurred while processing placement outcome.',
  };
}

/**
 * Validates officer revocation reason input.
 * Rules:
 * - Plain text string, trimmed, 10 to 500 characters.
 * 
 * @param {string} reason
 * @returns {{ valid: boolean, trimmedReason?: string, error?: string }}
 */
export function validateRevokeReasonInput(reason) {
  if (!reason || typeof reason !== 'string') {
    return { valid: false, error: 'Revocation reason must be at least 10 characters.' };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { valid: false, error: 'Revocation reason must be at least 10 characters.' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Revocation reason cannot exceed 500 characters.' };
  }

  return { valid: true, trimmedReason: trimmed };
}


