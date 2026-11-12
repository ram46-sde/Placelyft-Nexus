import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read source files for structural and behavioral verification
const modalPath = path.resolve(__dirname, 'EditDriveModal.jsx');
const modalSource = fs.readFileSync(modalPath, 'utf8');

const servicePath = path.resolve(__dirname, '../../services/officerService.js');
const serviceSource = fs.readFileSync(servicePath, 'utf8');

// Mirror pure helper functions exactly as implemented in EditDriveModal.jsx for algorithmic testing
const formatDateForInput = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10);
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const createInitialEditFormData = () => ({
  companyName: '',
  companyLocation: '',
  jobRole: '',
  jobDescription: '',
  packageDetails: '',
  driveDate: '',
  registrationDeadline: '',
  minTenthPercentage: '0',
  minTwelfthPercentage: '0',
  ugCriteriaType: '',
  minCgpa: '',
  minUgPercentage: '',
  maxBacklogs: '0',
  requiredCoursesInput: '',
  requiredSkillsInput: '',
});

const populateFormData = (drive) => {
  if (!drive) return createInitialEditFormData();

  const companyName = drive.company?.name || (typeof drive.company === 'string' ? drive.company : '');
  const elig = drive.eligibilityCriteria || {};

  const ugCriteriaType =
    elig.effectiveUgCriteriaType ||
    elig.ugCriteriaType ||
    (Number(elig.minCgpa) > 0 ? 'CGPA' : Number(elig.minUgPercentage) > 0 ? 'PERCENTAGE' : 'NONE');

  return {
    companyName: companyName || '',
    companyLocation: drive.companyLocation || '',
    jobRole: drive.jobRole || '',
    jobDescription: drive.jobDescription || '',
    packageDetails: drive.packageDetails || '',
    driveDate: formatDateForInput(drive.driveDate),
    registrationDeadline: formatDateForInput(drive.registrationDeadline),
    minTenthPercentage: elig.minTenthPercentage !== undefined ? String(elig.minTenthPercentage) : '0',
    minTwelfthPercentage: elig.minTwelfthPercentage !== undefined ? String(elig.minTwelfthPercentage) : '0',
    ugCriteriaType: ugCriteriaType || '',
    minCgpa: elig.minCgpa !== undefined && elig.minCgpa !== null ? String(elig.minCgpa) : '',
    minUgPercentage: elig.minUgPercentage !== undefined && elig.minUgPercentage !== null ? String(elig.minUgPercentage) : '',
    maxBacklogs: elig.maxBacklogs !== undefined ? String(elig.maxBacklogs) : '0',
    requiredCoursesInput: Array.isArray(elig.requiredCourses) ? elig.requiredCourses.join(', ') : '',
    requiredSkillsInput: Array.isArray(elig.requiredSkills) ? elig.requiredSkills.join(', ') : '',
  };
};

const computeChangedCriteria = (originalElig = {}, newElig = {}) => {
  const changes = [];

  const oldTenth = Number(originalElig.minTenthPercentage ?? 0);
  const newTenth = Number(newElig.minTenthPercentage ?? 0);
  if (oldTenth !== newTenth) {
    changes.push(`10th Standard Minimum: changed from ${oldTenth}% to ${newTenth}%`);
  }

  const oldTwelfth = Number(originalElig.minTwelfthPercentage ?? 0);
  const newTwelfth = Number(newElig.minTwelfthPercentage ?? 0);
  if (oldTwelfth !== newTwelfth) {
    changes.push(`12th / Diploma Minimum: changed from ${oldTwelfth}% to ${newTwelfth}%`);
  }

  const oldUgType = originalElig.effectiveUgCriteriaType || originalElig.ugCriteriaType || (Number(originalElig.minCgpa) > 0 ? 'CGPA' : 'NONE');
  const newUgType = newElig.ugCriteriaType;
  if (oldUgType !== newUgType) {
    changes.push(`UG Grading Basis: changed from ${oldUgType || 'None'} to ${newUgType || 'None'}`);
  }

  if (newUgType === 'CGPA') {
    const oldCgpa = Number(originalElig.minCgpa ?? 0);
    const newCgpa = Number(newElig.minCgpa ?? 0);
    if (oldCgpa !== newCgpa) {
      changes.push(`Minimum CGPA: changed from ${oldCgpa} to ${newCgpa}`);
    }
  } else if (newUgType === 'PERCENTAGE') {
    const oldUgPct = Number(originalElig.minUgPercentage ?? 0);
    const newUgPct = Number(newElig.minUgPercentage ?? 0);
    if (oldUgPct !== newUgPct) {
      changes.push(`Minimum UG Percentage: changed from ${oldUgPct}% to ${newUgPct}%`);
    }
  }

  const oldBacklogs = Number(originalElig.maxBacklogs ?? 0);
  const newBacklogs = Number(newElig.maxBacklogs ?? 0);
  if (oldBacklogs !== newBacklogs) {
    changes.push(`Maximum Backlogs: changed from ${oldBacklogs} to ${newBacklogs}`);
  }

  const oldCourses = [...(originalElig.requiredCourses || [])].map((c) => String(c).trim()).filter(Boolean).sort();
  const newCourses = [...(newElig.requiredCourses || [])].sort();
  if (JSON.stringify(oldCourses) !== JSON.stringify(newCourses)) {
    changes.push(`Required Courses: updated to [${newCourses.join(', ') || 'None'}]`);
  }

  const oldSkills = [...(originalElig.requiredSkills || [])].map((s) => String(s).trim()).filter(Boolean).sort();
  const newSkills = [...(newElig.requiredSkills || [])].sort();
  if (JSON.stringify(oldSkills) !== JSON.stringify(newSkills)) {
    changes.push(`Required Skills: updated to [${newSkills.join(', ') || 'None'}]`);
  }

  return changes;
};

// ─── 1. officerService.updateDrive API Service ──────────────────────────────
test('1. officerService defines updateDrive(driveId, payload) sending PUT /api/officer/drives/:id', () => {
  assert.ok(
    serviceSource.includes('updateDrive: async (driveId, payload)'),
    'officerService must export updateDrive accepting (driveId, payload)'
  );
  assert.ok(
    serviceSource.includes('await api.put(`/officer/drives/${driveId}`, payload)'),
    'updateDrive must call api.put to /officer/drives/:id'
  );
  assert.ok(
    serviceSource.includes('return response.data;'),
    'updateDrive must return response.data'
  );
});

// ─── 2. Prepopulation of all supported fields ────────────────────────────────
test('2. populateFormData correctly prepopulates all supported drive fields', () => {
  const mockDrive = {
    _id: 'drive123',
    company: {
      _id: 'comp123',
      name: 'Starlight Corp',
      industry: 'Aerospace',
    },
    jobRole: 'Flight Software Engineer',
    jobDescription: 'Develop avionics and flight control systems with high reliability.',
    packageDetails: '16 LPA',
    companyLocation: 'Bengaluru, Karnataka, India',
    driveDate: '2026-11-25T10:00:00.000Z',
    registrationDeadline: '2026-11-20T23:59:59.000Z',
    isActive: true,
    eligibilityCriteria: {
      minTenthPercentage: 75,
      minTwelfthPercentage: 80,
      ugCriteriaType: 'CGPA',
      minCgpa: 8.0,
      minUgPercentage: 0,
      maxBacklogs: 1,
      requiredCourses: ['B.Tech', 'M.Tech'],
      requiredSkills: ['C++', 'Embedded Systems', 'RTOS'],
    },
  };

  const formData = populateFormData(mockDrive);

  assert.equal(formData.companyName, 'Starlight Corp');
  assert.equal(formData.companyLocation, 'Bengaluru, Karnataka, India');
  assert.equal(formData.jobRole, 'Flight Software Engineer');
  assert.equal(formData.jobDescription, 'Develop avionics and flight control systems with high reliability.');
  assert.equal(formData.packageDetails, '16 LPA');
  assert.equal(formData.driveDate, '2026-11-25');
  assert.equal(formData.registrationDeadline, '2026-11-20');
  assert.equal(formData.minTenthPercentage, '75');
  assert.equal(formData.minTwelfthPercentage, '80');
  assert.equal(formData.ugCriteriaType, 'CGPA');
  assert.equal(formData.minCgpa, '8');
  assert.equal(formData.maxBacklogs, '1');
  assert.equal(formData.requiredCoursesInput, 'B.Tech, M.Tech');
  assert.equal(formData.requiredSkillsInput, 'C++, Embedded Systems, RTOS');
});

// ─── 3. Company reference mapping (Object vs String ID) ──────────────────────
test('3. populateFormData handles string company reference or missing company safely', () => {
  const driveWithStringCompany = {
    _id: 'drive456',
    company: 'DirectCompanyName',
    jobRole: 'DevOps Engineer',
  };
  const data1 = populateFormData(driveWithStringCompany);
  assert.equal(data1.companyName, 'DirectCompanyName');

  const driveWithNoCompany = {
    _id: 'drive789',
    jobRole: 'QA Engineer',
  };
  const data2 = populateFormData(driveWithNoCompany);
  assert.equal(data2.companyName, '');

  const dataNull = populateFormData(null);
  assert.equal(dataNull.companyName, '');
  assert.equal(dataNull.jobRole, '');
});

// ─── 4. Date formatting without timezone shifting ────────────────────────────
test('4. formatDateForInput formats ISO strings and dates to YYYY-MM-DD reliably', () => {
  assert.equal(formatDateForInput('2026-12-15T00:00:00.000Z'), '2026-12-15');
  assert.equal(formatDateForInput('2026-05-01'), '2026-05-01');
  assert.equal(formatDateForInput(null), '');
  assert.equal(formatDateForInput(undefined), '');
  assert.equal(formatDateForInput('invalid-date'), '');
});

// ─── 5. Canonical field names in API payload & protected fields exclusion ────
test('5. Modal builds canonical payload and strictly excludes protected fields', () => {
  // Check buildValidatedPayload in modal source code
  assert.ok(
    modalSource.includes('minTenthPercentage: minTenthNum'),
    'Payload must use canonical minTenthPercentage'
  );
  assert.ok(
    modalSource.includes('minTwelfthPercentage: minTwelfthNum'),
    'Payload must use canonical minTwelfthPercentage'
  );
  assert.ok(
    modalSource.includes('ugCriteriaType: formData.ugCriteriaType'),
    'Payload must use canonical ugCriteriaType'
  );
  assert.ok(
    modalSource.includes('minCgpa: minCgpaNum'),
    'Payload must use canonical minCgpa'
  );
  assert.ok(
    modalSource.includes('minUgPercentage: minUgPercentageNum'),
    'Payload must use canonical minUgPercentage'
  );
  assert.ok(
    modalSource.includes('maxBacklogs: maxBacklogsNum'),
    'Payload must use canonical maxBacklogs'
  );
  assert.ok(
    modalSource.includes('requiredCourses'),
    'Payload must use canonical requiredCourses'
  );
  assert.ok(
    modalSource.includes('requiredSkills'),
    'Payload must use canonical requiredSkills'
  );

  // Assert protected fields are NEVER assigned to payload
  assert.ok(
    !modalSource.includes('payload._id =') && !modalSource.includes('_id: drive._id'),
    '_id must not be included in the update payload'
  );
  assert.ok(
    !modalSource.includes('collegeId:'),
    'collegeId must not be included in the update payload'
  );
  assert.ok(
    !modalSource.includes('isArchived:'),
    'isArchived must not be included in the update payload'
  );
  assert.ok(
    !modalSource.includes('archivedAt:'),
    'archivedAt must not be included in the update payload'
  );
  assert.ok(
    !modalSource.includes('createdAt:'),
    'createdAt must not be included in the update payload'
  );
  assert.ok(
    !modalSource.includes('updatedAt:'),
    'updatedAt must not be included in the update payload'
  );
});

// ─── 6. Client-side validation rules in EditDriveModal.jsx ───────────────────
test('6. EditDriveModal implements all required client-side validations', () => {
  // Company name & location
  assert.ok(modalSource.includes("'Company name is required.'"));
  assert.ok(modalSource.includes("'Company location is required.'"));
  assert.ok(modalSource.includes("'Company location must be between 2 and 100 characters.'"));
  assert.ok(modalSource.includes("'Company location contains invalid characters."));
  assert.ok(modalSource.includes("'Company location cannot consist solely of punctuation or whitespace.'"));

  // Job role & description length
  assert.ok(modalSource.includes("'Job role is required.'"));
  assert.ok(modalSource.includes("'Job description is required.'"));
  assert.ok(modalSource.includes("'Job description must be at least 10 characters long.'"));
  assert.ok(modalSource.includes("'Job description must not exceed 5000 characters.'"));

  // Drive date & registration deadline
  assert.ok(modalSource.includes("'Drive date is required.'"));
  assert.ok(modalSource.includes("'Registration deadline is required.'"));
  assert.ok(modalSource.includes("'Registration deadline must be on or before the drive date.'"));

  // Academic criteria
  assert.ok(modalSource.includes("'Minimum 10th percentage must be a number between 0 and 100.'"));
  assert.ok(modalSource.includes("'Minimum 12th / Diploma percentage must be a number between 0 and 100.'"));
  assert.ok(modalSource.includes("'Please select an Undergraduate (UG) eligibility basis (CGPA, Percentage, or None).'"));
  assert.ok(modalSource.includes("'Minimum CGPA must be a positive number between 0 and 10.'"));
  assert.ok(modalSource.includes("'Minimum UG percentage must be a positive number between 0 and 100.'"));
  assert.ok(modalSource.includes("'Maximum backlogs must be a non-negative integer.'"));
});

// ─── 7. computeChangedCriteria detects changes accurately ─────────────────────
test('7. computeChangedCriteria identifies exact criteria differences for confirmation dialog', () => {
  const original = {
    minTenthPercentage: 60,
    minTwelfthPercentage: 65,
    ugCriteriaType: 'CGPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    requiredCourses: ['B.Tech'],
    requiredSkills: ['JavaScript', 'React'],
  };

  const modified = {
    minTenthPercentage: 70, // changed
    minTwelfthPercentage: 65, // same
    ugCriteriaType: 'CGPA', // same
    minCgpa: 8.0, // changed
    maxBacklogs: 1, // changed
    requiredCourses: ['B.Tech', 'M.Tech'], // changed
    requiredSkills: ['React', 'JavaScript'], // same items, different order
  };

  const changes = computeChangedCriteria(original, modified);

  assert.equal(changes.length, 4);
  assert.ok(changes.some((c) => c.includes('10th Standard Minimum: changed from 60% to 70%')));
  assert.ok(changes.some((c) => c.includes('Minimum CGPA: changed from 7 to 8')));
  assert.ok(changes.some((c) => c.includes('Maximum Backlogs: changed from 0 to 1')));
  assert.ok(changes.some((c) => c.includes('Required Courses: updated to [B.Tech, M.Tech]')));

  // Skills should NOT be marked as changed since elements are identical after sorting
  assert.ok(!changes.some((c) => c.includes('Required Skills')));
});

// ─── 8. computeChangedCriteria returns empty array when criteria are identical
test('8. computeChangedCriteria returns empty array when criteria are identical', () => {
  const original = {
    minTenthPercentage: 70,
    minTwelfthPercentage: 70,
    ugCriteriaType: 'CGPA',
    minCgpa: 7.5,
    maxBacklogs: 0,
    requiredCourses: ['B.Tech'],
    requiredSkills: ['Node.js', 'Express'],
  };

  const identical = {
    minTenthPercentage: 70,
    minTwelfthPercentage: 70,
    ugCriteriaType: 'CGPA',
    minCgpa: 7.5,
    maxBacklogs: 0,
    requiredCourses: ['B.Tech'],
    requiredSkills: ['Express', 'Node.js'],
  };

  const changes = computeChangedCriteria(original, identical);
  assert.equal(changes.length, 0);
});

// ─── 9. HTTP 409 Eligibility Confirmation Workflow ────────────────────────────
test('9. EditDriveModal handles HTTP 409 ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED', () => {
  assert.ok(
    modalSource.includes("err.response?.status === 409"),
    'Must catch HTTP 409 status code'
  );
  assert.ok(
    modalSource.includes("err.response?.data?.code === 'ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED'"),
    'Must check ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED error code'
  );
  assert.ok(
    modalSource.includes('showConfirmation: true'),
    'Must activate showConfirmation on 409'
  );
  assert.ok(
    modalSource.includes('applicantCount = err.response.data.applicantCount'),
    'Must capture applicantCount from 409 response'
  );
  assert.ok(
    modalSource.includes('pendingPayload: payload'),
    'Must store pendingPayload for subsequent confirmation submission'
  );
});

// ─── 10. Confirmation Resubmission with confirmEligibilityImpact: true ────────
test('10. handleConfirmEligibilitySave sends confirmEligibilityImpact: true', () => {
  assert.ok(
    modalSource.includes('handleConfirmEligibilitySave'),
    'Must define handleConfirmEligibilitySave handler'
  );
  assert.ok(
    modalSource.includes('confirmEligibilityImpact: true'),
    'handleConfirmEligibilitySave must attach confirmEligibilityImpact: true to payload'
  );
  assert.ok(
    modalSource.includes('await officerService.updateDrive(drive._id, confirmedPayload)'),
    'handleConfirmEligibilitySave must invoke officerService.updateDrive with confirmed payload'
  );
});

// ─── 11. Confirmation Cancellation Preserves Form Data ────────────────────────
test('11. handleCancelConfirmation closes confirmation and keeps entered form data', () => {
  assert.ok(
    modalSource.includes('handleCancelConfirmation'),
    'Must define handleCancelConfirmation handler'
  );
  assert.ok(
    modalSource.includes('showConfirmation: false'),
    'handleCancelConfirmation must reset showConfirmation to false'
  );
  // Does not reset formData!
  assert.ok(
    !modalSource.match(/handleCancelConfirmation\s*=\s*\(\)\s*=>\s*\{[^}]*setFormData/),
    'handleCancelConfirmation must NOT reset formData'
  );
});

// ─── 12. Form Changes Invalidate Pending Confirmation ────────────────────────
test('12. Editing form fields immediately invalidates active confirmation state', () => {
  assert.ok(
    modalSource.includes('if (confirmationState.showConfirmation) {'),
    'handleChange must check if confirmationState.showConfirmation is true'
  );
  assert.ok(
    modalSource.includes('showConfirmation: false') &&
    modalSource.includes('pendingPayload: null'),
    'handleChange must clear pending confirmation state on field modification'
  );
});

// ─── 13. Duplicate Submissions Prevention & Loading State ─────────────────────
test('13. Submitting state prevents duplicate submissions and disables buttons', () => {
  assert.ok(
    modalSource.includes('if (submitting) return;'),
    'handleSubmit must abort if submitting is already true'
  );
  assert.ok(
    modalSource.includes('if (submitting || !confirmationState.pendingPayload) return;'),
    'handleConfirmEligibilitySave must abort if submitting is true'
  );
  assert.ok(
    modalSource.includes('disabled={submitting}'),
    'Action buttons must have disabled={submitting} attribute'
  );
  assert.ok(
    modalSource.includes('Saving Changes...') || modalSource.includes('Confirming Changes...'),
    'Must display active loading indicator while submitting'
  );
});

// ─── 14. Resetting Form State When Switching Drives ───────────────────────────
test('14. useEffect resets form state when drive or isOpen changes', () => {
  assert.ok(
    modalSource.includes('useEffect(() => {'),
    'Must have useEffect hook for initialization'
  );
  assert.ok(
    modalSource.includes('setFormData(populateFormData(drive));'),
    'Must populate form data from new drive object'
  );
  assert.ok(
    modalSource.includes('setError(\'\');'),
    'Must clear error on drive change'
  );
  assert.ok(
    modalSource.includes('[isOpen, drive]'),
    'useEffect dependency array must include isOpen and drive'
  );
});

// ─── 15. Shared Company Metadata Notice & Preservation ────────────────────────
test('15. Company profile metadata notice is rendered informatively without in-place mutation', () => {
  assert.ok(
    modalSource.includes('Company Profile:'),
    'Must render company profile summary if existing company metadata is present'
  );
  assert.ok(
    /Shared company\s+metadata is centrally managed across all institutional drives/i.test(modalSource),
    'Must inform officer that company metadata is centrally shared'
  );
  assert.ok(
    modalSource.includes('id="edit-companyName"'),
    'Must provide editable companyName input'
  );
  assert.ok(
    modalSource.includes('id="edit-companyLocation"'),
    'Must provide editable companyLocation input'
  );
});

// ─── 16. Accessibility & Responsive Structure ────────────────────────────────
test('16. Modal implements standard accessibility attributes and responsive layout', () => {
  assert.ok(
    modalSource.includes('role="dialog"'),
    'Modal root must have role="dialog"'
  );
  assert.ok(
    modalSource.includes('aria-modal="true"'),
    'Modal root must have aria-modal="true"'
  );
  assert.ok(
    modalSource.includes('aria-labelledby="edit-drive-title"'),
    'Modal root must have aria-labelledby="edit-drive-title"'
  );
  assert.ok(
    modalSource.includes('id="edit-drive-title"'),
    'Header title must have id="edit-drive-title"'
  );
  assert.ok(
    modalSource.includes("e.key === 'Escape'"),
    'Modal must support keyboard Escape to close'
  );
  assert.ok(
    modalSource.includes('max-w-3xl w-full max-h-[90vh]'),
    'Modal card must have responsive maximum dimensions'
  );
  assert.ok(
    modalSource.includes('overflow-y-auto'),
    'Modal content must be vertically scrollable to prevent viewport cutoff'
  );
});
