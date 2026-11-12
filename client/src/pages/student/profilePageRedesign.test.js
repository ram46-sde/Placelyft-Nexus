import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const profilePagePath = path.join(__dirname, 'ProfilePage.jsx');
const content = fs.readFileSync(profilePagePath, 'utf8');

test('1. ProfilePage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(profilePagePath), 'ProfilePage.jsx must exist');
  assert.ok(
    content.includes('export default ProfilePage;'),
    'Must export ProfilePage as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in ProfilePage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in ProfilePage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Profile Header: Renders Avatar, Name, Department, Academic Year & Roll Number', () => {
  // Circular avatar & initials fallback
  assert.ok(
    content.includes('activePhotoSrc'),
    'Header must support active photo source preview'
  );
  assert.ok(
    content.includes('user?.name?.charAt(0).toUpperCase()'),
    'Header must provide initials fallback for avatar'
  );

  // Student identity details
  assert.ok(content.includes('{user?.name}'), 'Must display student name');
  assert.ok(content.includes('{user?.email}'), 'Must display student email');
  assert.ok(
    content.includes('departmentLabel'),
    'Must resolve department label using institutional utility'
  );
  assert.ok(
    content.includes('formData.academicYear'),
    'Must display academic year in header badge'
  );
  assert.ok(
    content.includes('formData.rollNumber'),
    'Must display roll number in header when present'
  );

  // Photo upload controls
  assert.ok(content.includes('handlePhotoSelect'), 'Must handle file selection');
  assert.ok(content.includes('handleUploadPhoto'), 'Must handle photo upload submission');
  assert.ok(content.includes('handleCancelPhotoSelection'), 'Must allow canceling photo selection');
});

test('5. Personal Information Section: Institutional Identity Display', () => {
  assert.ok(
    content.includes('Personal Information'),
    'Must include Personal Information heading'
  );
  assert.ok(
    content.includes('Full Name'),
    'Must display Full Name field'
  );
  assert.ok(
    content.includes('Email Address'),
    'Must display Email Address field'
  );
  assert.ok(
    content.includes('Account Role'),
    'Must display Account Role field'
  );
});

test('6. Academic Information Section: Field Mapping and Required Controls', () => {
  // Required form input elements
  assert.ok(content.includes('name="rollNumber"'), 'Must have rollNumber input');
  assert.ok(content.includes('name="department"'), 'Must have department input');
  assert.ok(content.includes('name="course"'), 'Must have course input');
  assert.ok(content.includes('name="batch"'), 'Must have batch input');
  assert.ok(content.includes('name="academicYear"'), 'Must have academicYear select');
  assert.ok(content.includes('name="section"'), 'Must have section input');
  assert.ok(content.includes('name="tenthPercentage"'), 'Must have tenthPercentage input');
  assert.ok(content.includes('name="twelfthPercentage"'), 'Must have twelfthPercentage input');
  assert.ok(content.includes('name="cgpa"'), 'Must have cgpa input');
  assert.ok(content.includes('name="ugPercentage"'), 'Must have ugPercentage input');
  assert.ok(content.includes('name="backlogs"'), 'Must have backlogs input');

  // Academic Year options
  assert.ok(content.includes('<option value="I">I Year</option>'));
  assert.ok(content.includes('<option value="II">II Year</option>'));
  assert.ok(content.includes('<option value="III">III Year</option>'));
  assert.ok(content.includes('<option value="IV">IV Year</option>'));
});

test('7. Technical Skills Section: Live Badge Cloud & Input Parsing', () => {
  assert.ok(
    content.includes('parsedSkills'),
    'Must derive parsedSkills array from comma-separated input'
  );
  assert.ok(
    content.includes('parsedSkills.map('),
    'Must map over parsed skills to display badge pills'
  );
  assert.ok(
    content.includes('name="skills"'),
    'Must include comma-separated skills input'
  );
  assert.ok(
    content.includes('placeholder="e.g. React, Node.js, Python, MongoDB, Docker, Git"'),
    'Must provide informative skills placeholder'
  );
});

test('8. Resume Management Section: Status Badge, View Action & Empty State', () => {
  assert.ok(
    content.includes('formData.resumeUrl'),
    'Must check if resumeUrl is attached'
  );
  assert.ok(
    content.includes('View Resume'),
    'Must provide a direct View Resume action'
  );
  assert.ok(
    content.includes('target="_blank"'),
    'View resume must open in a secure new tab'
  );
  assert.ok(
    content.includes('rel="noopener noreferrer"'),
    'View resume link must use rel="noopener noreferrer"'
  );
  assert.ok(
    content.includes('name="resumeUrl"'),
    'Must include resumeUrl input field'
  );
});

test('9. Portfolio Sections: Projects, Certifications & Achievements Handlers', () => {
  // Projects
  assert.ok(content.includes('addProject'), 'Must provide addProject handler');
  assert.ok(content.includes('removeProject'), 'Must provide removeProject handler');
  assert.ok(content.includes('handleProjectChange'), 'Must provide handleProjectChange');

  // Certifications
  assert.ok(content.includes('addCertification'), 'Must provide addCertification handler');
  assert.ok(content.includes('removeCertification'), 'Must provide removeCertification handler');
  assert.ok(content.includes('handleCertificationChange'), 'Must provide handleCertificationChange');

  // Achievements
  assert.ok(content.includes('addAchievement'), 'Must provide addAchievement handler');
  assert.ok(content.includes('removeAchievement'), 'Must provide removeAchievement handler');
  assert.ok(content.includes('handleAchievementChange'), 'Must provide handleAchievementChange');
});

test('10. Form Submission & Error Handling', () => {
  assert.ok(content.includes('disabled={saving}'), 'Submit button must disable when saving');
  assert.ok(content.includes('Saving Profile...'), 'Must show loading label during submit');
  assert.ok(content.includes('profileService.updateProfile('), 'Must call profileService.updateProfile');
  assert.ok(content.includes('setMessage({ type: \'error\', text: errorText })'), 'Must preserve error message');
});

test('11. Design System & Touch Target Standards', () => {
  // Mobile touch targets
  assert.ok(content.includes('min-h-[44px]'), 'Must support min 44px touch targets on primary actions');
  // Visual cards
  assert.ok(content.includes('<Card'), 'Must use Card primitive for layout sections');
  assert.ok(content.includes('<Badge'), 'Must use Badge primitive for status chips');
  assert.ok(content.includes('<EmptyState'), 'Must use EmptyState primitive for zero-data states');
});

test('12. Authorization & Non-Student Role Guard (Issue 1)', () => {
  // Ensures non-student roles are prevented from querying student-only endpoints
  assert.ok(
    content.includes("user.role !== 'student'"),
    'Must explicitly guard against non-student role querying student endpoints'
  );
  assert.ok(
    content.includes('Officer Portal Account Active'),
    'Must display informative notice when an officer session visits student profile'
  );
  assert.ok(
    content.includes('to="/officer/dashboard"'),
    'Must provide a direct link guiding officers back to their dashboard'
  );
});

test('13. Photo Upload Boundary, Persistence & State Management (Issue 2)', () => {
  // Duplicate submission guard
  assert.ok(
    content.includes('if (!photoFile || uploadingPhoto) return;'),
    'Must prevent duplicate upload submissions while an upload is in progress'
  );
  assert.ok(
    content.includes('disabled={uploadingPhoto}'),
    'Upload and cancel actions must be disabled during active upload'
  );

  // Verifies api.js interceptor removes Content-Type for FormData
  const apiPath = path.resolve(__dirname, '../../services/api.js');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  assert.ok(
    apiContent.includes("delete config.headers['Content-Type']"),
    'api.js interceptor must remove manual Content-Type on FormData to allow browser boundary calculation'
  );

  // Verifies profileService photo upload does not hardcode Content-Type
  const servicePath = path.resolve(__dirname, '../../services/profileService.js');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert.ok(
    !serviceContent.includes("'Content-Type': 'multipart/form-data'"),
    'profileService.uploadProfilePhoto must not override boundary with hardcoded Content-Type'
  );
});

test('14. Profile Header Separation & Geometry (Issue 3)', () => {
  // Banner height
  assert.ok(
    content.includes('h-32 sm:h-36'),
    'Header banner must have adequate height to frame avatar overlap'
  );

  // Intentional avatar overlap
  assert.ok(
    content.includes('-mt-14 sm:-mt-16'),
    'Avatar must use intentional negative margin to bridge banner and card surface'
  );

  // Identity container is isolated from top row negative margin
  assert.ok(
    content.includes('Dedicated Student Identity Section'),
    'Must keep student name and identity in dedicated section below banner boundary'
  );
  assert.ok(
    content.includes('text-xl sm:text-2xl font-bold text-slate-900 tracking-tight'),
    'Student name heading must use clear typography on card surface'
  );
});

