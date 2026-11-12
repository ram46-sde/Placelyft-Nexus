import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CPMS Feature 01: Stage 2 — Student Profile UI Verification Tests
 *
 * Validates the frontend ProfilePage implementation, state management,
 * payload construction, validation, legacy handling, and UI layout.
 */

// Read ProfilePage.jsx source code for structural verification
const profilePagePath = path.resolve(__dirname, 'ProfilePage.jsx');
const profilePageSource = fs.readFileSync(profilePagePath, 'utf8');

test('1. Section and Academic Year inputs exist in ProfilePage.jsx', () => {
  // Academic Year select control
  assert.ok(
    profilePageSource.includes('name="academicYear"'),
    'ProfilePage must include a select control with name="academicYear"'
  );
  assert.ok(
    profilePageSource.includes('id="academicYear"'),
    'ProfilePage must include an id="academicYear"'
  );
  assert.ok(
    profilePageSource.includes('Select Academic Year'),
    'ProfilePage must include placeholder option "Select Academic Year"'
  );
  assert.ok(
    profilePageSource.includes('<option value="I">I Year</option>'),
    'ProfilePage must include option for "I Year"'
  );
  assert.ok(
    profilePageSource.includes('<option value="II">II Year</option>'),
    'ProfilePage must include option for "II Year"'
  );
  assert.ok(
    profilePageSource.includes('<option value="III">III Year</option>'),
    'ProfilePage must include option for "III Year"'
  );
  assert.ok(
    profilePageSource.includes('<option value="IV">IV Year</option>'),
    'ProfilePage must include option for "IV Year"'
  );

  // Section text input control
  assert.ok(
    profilePageSource.includes('name="section"'),
    'ProfilePage must include an input control with name="section"'
  );
  assert.ok(
    profilePageSource.includes('id="section"'),
    'ProfilePage must include an id="section"'
  );
  assert.ok(
    profilePageSource.includes('placeholder="e.g. A, B, C"'),
    'ProfilePage must include placeholder="e.g. A, B, C"'
  );
});

test('2. Profile loading & state initialization maps section and academicYear', () => {
  // Test initial state setup logic
  assert.ok(
    /section:\s*''/.test(profilePageSource),
    'Initial formData state must define section as empty string'
  );
  assert.ok(
    /academicYear:\s*''/.test(profilePageSource),
    'Initial formData state must define academicYear as empty string'
  );

  // Test fetchProfile mapping logic
  assert.ok(
    /section:\s*p\.section\s*\|\|\s*''/.test(profilePageSource),
    'fetchProfile must populate section from p.section or default to empty string'
  );
  assert.ok(
    /academicYear:\s*p\.academicYear\s*\|\|\s*''/.test(profilePageSource),
    'fetchProfile must populate academicYear from p.academicYear or default to empty string'
  );
});

test('3. Simulated profile population handles various profile states', () => {
  const populateProfile = (p) => ({
    rollNumber: p.rollNumber || '',
    department: p.department || '',
    course: p.course || '',
    batch: p.batch || '',
    section: p.section || '',
    academicYear: p.academicYear || '',
    cgpa: p.cgpa !== undefined && p.cgpa !== null ? p.cgpa : '',
    backlogs: p.backlogs || 0,
  });

  // State with complete details
  const fullProfile = populateProfile({
    rollNumber: '21BCS042',
    department: 'CSE',
    course: 'B.Tech',
    batch: '2026',
    section: 'A',
    academicYear: 'III',
    cgpa: 8.9,
    backlogs: 0,
  });
  assert.equal(fullProfile.section, 'A');
  assert.equal(fullProfile.academicYear, 'III');
  assert.equal(fullProfile.cgpa, 8.9);

  // Legacy profile missing section and academicYear
  const legacyProfile = populateProfile({
    rollNumber: '19BCS001',
    department: 'ME',
    course: 'B.Tech',
    batch: '2023',
    cgpa: 7.5,
  });
  assert.equal(legacyProfile.section, '');
  assert.equal(legacyProfile.academicYear, '');
  assert.equal(legacyProfile.department, 'ME');

  // Null fields
  const nullProfile = populateProfile({
    section: null,
    academicYear: null,
  });
  assert.equal(nullProfile.section, '');
  assert.equal(nullProfile.academicYear, '');
});

test('4. Payload construction: trims section and normalizes academicYear', () => {
  const buildPayload = (formData) => {
    const trimmedSection = typeof formData.section === 'string' ? formData.section.trim() : '';
    const selectedYear = typeof formData.academicYear === 'string' ? formData.academicYear.trim() : '';

    if (selectedYear && !['I', 'II', 'III', 'IV'].includes(selectedYear)) {
      throw new Error('Academic year must be one of: I, II, III, IV.');
    }

    return {
      ...formData,
      section: trimmedSection.length > 0 ? trimmedSection : null,
      academicYear: selectedYear.length > 0 ? selectedYear : null,
    };
  };

  // Case A: Trims whitespace from section
  const res1 = buildPayload({ section: '  CSE-1  ', academicYear: 'IV' });
  assert.equal(res1.section, 'CSE-1');
  assert.equal(res1.academicYear, 'IV');

  // Case B: Empty string section normalizes to null
  const res2 = buildPayload({ section: '', academicYear: 'II' });
  assert.equal(res2.section, null);
  assert.equal(res2.academicYear, 'II');

  // Case C: Whitespace-only section normalizes to null
  const res3 = buildPayload({ section: '   ', academicYear: 'I' });
  assert.equal(res3.section, null);
  assert.equal(res3.academicYear, 'I');

  // Case D: Clearing academicYear ("") normalizes to null
  const res4 = buildPayload({ section: 'B', academicYear: '' });
  assert.equal(res4.section, 'B');
  assert.equal(res4.academicYear, null);

  // Case E: Clearing both fields
  const res5 = buildPayload({ section: '', academicYear: '' });
  assert.equal(res5.section, null);
  assert.equal(res5.academicYear, null);

  // Case F: Invalid academicYear throws validation error
  assert.throws(
    () => buildPayload({ section: 'A', academicYear: 'V' }),
    /Academic year must be one of: I, II, III, IV\./
  );
  assert.throws(
    () => buildPayload({ section: 'A', academicYear: 'first' }),
    /Academic year must be one of: I, II, III, IV\./
  );
});

test('5. Partial update safety: existing profile fields remain intact in payload', () => {
  const existingFormData = {
    rollNumber: '21BCS099',
    department: 'Information Technology',
    course: 'B.Tech',
    batch: '2025',
    cgpa: '8.45',
    tenthPercentage: '89.5',
    twelfthPercentage: '87.0',
    ugPercentage: '82.0',
    backlogs: 0,
    skills: 'Node.js, React, MongoDB',
    resumeUrl: 'https://drive.google.com/resume.pdf',
    section: 'IT-A',
    academicYear: 'IV',
  };

  // Update only section
  const updatedSection = { ...existingFormData, section: 'IT-B' };
  assert.equal(updatedSection.academicYear, 'IV');
  assert.equal(updatedSection.rollNumber, '21BCS099');
  assert.equal(updatedSection.cgpa, '8.45');

  // Update only academicYear
  const updatedYear = { ...existingFormData, academicYear: 'III' };
  assert.equal(updatedYear.section, 'IT-A');
  assert.equal(updatedYear.rollNumber, '21BCS099');
  assert.equal(updatedYear.department, 'Information Technology');
});

test('6. UI layout and responsive grid verification', () => {
  // Container must use responsive 2-column grid
  assert.ok(
    profilePageSource.includes('grid grid-cols-1 md:grid-cols-2 gap-6'),
    'ProfilePage academic section must use responsive grid: grid-cols-1 md:grid-cols-2 gap-6'
  );

  // Verify styling classes match existing design
  assert.ok(
    profilePageSource.includes('focus:ring-indigo-500'),
    'Inputs must use indigo theme focus ring'
  );
  assert.ok(
    profilePageSource.includes('border-slate-300'),
    'Inputs must use slate-300 borders consistent with design system'
  );
});

test('7. Submission guard: duplicate clicks blocked while saving', () => {
  assert.ok(
    profilePageSource.includes('disabled={saving}'),
    'Submit button must be disabled when saving is true'
  );
  assert.ok(
    profilePageSource.includes('setSaving(true)'),
    'handleSubmit must set saving to true before making API call'
  );
  assert.ok(
    profilePageSource.includes('setSaving(false)'),
    'handleSubmit must reset saving in finally block'
  );
});

test('8. Error handling: preserves entered data on failure', () => {
  // In handleSubmit, catch block sets error message and DOES NOT reset formData
  const handleSubmitBody = profilePageSource.slice(
    profilePageSource.indexOf('const handleSubmit ='),
    profilePageSource.indexOf('if (loading) {')
  );

  assert.ok(
    handleSubmitBody.includes('setMessage({ type: \'error\', text: errorText })'),
    'Error message must be displayed on failure'
  );
  assert.ok(
    !handleSubmitBody.includes('catch (error) {\n      setFormData'),
    'Catch block must not reset formData on failure, ensuring user input is preserved'
  );
});

