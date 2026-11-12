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

test('15. Change Photo Button Spacing & Interactive Area Refinement', () => {
  // Horizontal padding approximately 20–24px (px-5 sm:px-6)
  assert.ok(
    content.includes('px-5 sm:px-6'),
    'Change Photo button must have 20–24px horizontal padding (px-5 sm:px-6)'
  );

  // Vertical padding approximately 10–12px (py-2.5 sm:py-3)
  assert.ok(
    content.includes('py-2.5 sm:py-3'),
    'Change Photo button must have 10–12px vertical padding (py-2.5 sm:py-3)'
  );

  // Balanced icon and text spacing
  assert.ok(
    content.includes('gap-2.5'),
    'Change Photo button must provide balanced spacing (gap-2.5) between camera icon and label'
  );

  // Consistent min-height of 44px
  assert.ok(
    content.includes('min-h-[44px]'),
    'Change Photo button must adhere to min-h-[44px] comfortable touch target'
  );

  // Hover, focus and active states
  assert.ok(
    content.includes('hover:bg-slate-50'),
    'Change Photo button must provide clear hover feedback'
  );
  assert.ok(
    content.includes('focus:ring-2 focus:ring-indigo-500/20'),
    'Change Photo button must support accessible focus ring'
  );
  assert.ok(
    content.includes('active:bg-slate-100'),
    'Change Photo button must provide active feedback on click'
  );

  // Spaced helper text underneath
  assert.ok(
    content.includes('Supported: JPEG, PNG, WebP (Max 5 MB)'),
    'Supported file types and size limit must be displayed beneath button'
  );
});

test('16. Campus-Tech Premium Theme Palette & Visual Elements', () => {
  // Deep Indigo (#312E81) & Primary Violet (#7C3AED) banner gradient
  assert.ok(
    content.includes('from-[#312E81] via-indigo-900 to-[#7C3AED]'),
    'Banner must utilize the Campus-Tech deep indigo to primary violet gradient'
  );

  // Teal Accent (#0D9488) in positive states (Verified Student badge, resume badge)
  assert.ok(
    content.includes('variant="teal"'),
    'Must apply teal accent to positive status badges'
  );

  // Soft Background (#F1F5F9) & subtle slate borders
  assert.ok(
    content.includes('#F1F5F9'),
    'Must incorporate soft background (#F1F5F9) for secondary surfaces and sub-cards'
  );

  // Generous section spacing
  assert.ok(
    content.includes('space-y-8'),
    'Sections must use generous space-y-8 layout breathing room'
  );
});

test('17. Profile Photo UI Correction: Change Photo Button Positioned Completely Below Gradient Banner (Issue 1)', () => {
  // Top row wrapper container must not have negative top margins that push controls into the banner
  assert.ok(
    content.includes('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5'),
    'Top row container must use clean alignment without negative margin pulling entire row into banner'
  );

  // Negative top margin is strictly scoped to the circular avatar
  assert.ok(
    content.includes('-mt-14 sm:-mt-16 relative z-10 group shrink-0'),
    'Negative margin must be strictly scoped to circular avatar to overlap banner'
  );

  // Photo controls container has positive padding and sits fully on card surface
  assert.ok(
    content.includes('pt-3 sm:pt-4 relative z-10 w-full sm:w-auto flex flex-col sm:items-end gap-2'),
    'Photo controls container must use positive padding on white card surface below banner'
  );

  // Both idle state and preview states are housed with min 44px height and comfortable padding
  assert.ok(
    content.includes('min-h-[44px]'),
    'All photo actions must maintain minimum 44px interactive height'
  );
  assert.ok(
    content.includes('px-5 sm:px-6 py-2.5 sm:py-3'),
    'Change Photo and Confirm Upload buttons must have 20–24px horizontal and 10–12px vertical padding'
  );
  assert.ok(
    content.includes('Supported: JPEG, PNG, WebP (Max 5 MB)'),
    'Supported file types helper text must be clearly spaced below button'
  );

  // handleUploadPhoto updates AuthContext studentProfile so navbar immediately reflects new photo
  assert.ok(
    content.includes('setStudentProfile((prev) => ({'),
    'handleUploadPhoto must update studentProfile in AuthContext immediately upon upload'
  );
  assert.ok(
    content.includes('profilePhotoUrl: newPhotoUrl'),
    'handleUploadPhoto must attach newPhotoUrl to studentProfile'
  );
});

test('18. Profile Photo UI Correction: StudentLayout Top-Right Avatar Upgraded to 48px Profile Photo with Fallback (Issue 2)', () => {
  const studentLayoutPath = path.resolve(__dirname, '../../layouts/StudentLayout.jsx');
  assert.ok(fs.existsSync(studentLayoutPath), 'StudentLayout.jsx must exist');
  const studentLayoutContent = fs.readFileSync(studentLayoutPath, 'utf8');

  // Guard test: Absolute prohibition of banned wording in StudentLayout
  const lines = studentLayoutContent.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;
  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in StudentLayout.jsx:${idx + 1}: ${line.trim()}`
    );
  });

  // Guard test: No hand-built LPA or Cr strings in StudentLayout
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;
  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in StudentLayout.jsx:${idx + 1}: ${line.trim()}`
    );
  });

  // Derives avatar from authenticated student profile or user data
  assert.ok(
    studentLayoutContent.includes('avatarPhotoUrl = studentProfile?.profilePhotoUrl || user?.profilePhotoUrl || null'),
    'Must source avatar photo URL from authenticated studentProfile or user'
  );

  // Resets image load error state when avatarPhotoUrl changes (e.g. after fresh upload)
  assert.ok(
    studentLayoutContent.includes('setAvatarImgError(false)'),
    'Must reset avatar image error state on avatarPhotoUrl change'
  );

  // Upgraded avatar size: 48–52px (w-12 h-12 = 48px) with circular crop and object-cover
  assert.ok(
    studentLayoutContent.includes('w-12 h-12 rounded-full object-cover'),
    'Avatar must use 48px (w-12 h-12) dimensions with object-cover and circular styling'
  );

  // Error fallback handler on image
  assert.ok(
    studentLayoutContent.includes('onError={() => setAvatarImgError(true)}'),
    'Avatar img element must include onError handler to trigger fallback'
  );

  // Initials fallback when no photo exists or image fails to load
  assert.ok(
    studentLayoutContent.includes("user?.name?.charAt(0).toUpperCase() || 'S'"),
    'Must provide circular initials fallback when photo is absent or errors'
  );

  // Preserves student name, department subtitle, and dropdown toggle
  assert.ok(
    studentLayoutContent.includes("{user?.name || 'Student'}"),
    'Must preserve student name in header profile menu'
  );
  assert.ok(
    studentLayoutContent.includes('{departmentLabel}'),
    'Must preserve department subtitle in header profile menu'
  );
  assert.ok(
    studentLayoutContent.includes('ChevronDown'),
    'Must preserve ChevronDown dropdown toggle'
  );

  // No dummy or hardcoded photo URLs
  assert.ok(
    !studentLayoutContent.includes('placeholder.com') &&
    !studentLayoutContent.includes('unsplash.com') &&
    !studentLayoutContent.includes('via.placeholder'),
    'Must not use any dummy or hardcoded photo URLs'
  );
});

test('19. Critical Fix Priority 1: Authorization Protection & Stricter Student Role Guarding', () => {
  // Guard must check !user and user.role !== 'student' before allowing fetchProfile to execute
  assert.ok(
    content.includes('if (!user)'),
    'fetchProfile effect must guard against unhydrated/null user before querying'
  );
  assert.ok(
    content.includes("user.role !== 'student'"),
    'fetchProfile effect must strictly guard against non-student roles'
  );

  // handleUploadPhoto must guard against non-student role
  assert.ok(
    content.includes("if (!user || user.role !== 'student') return;"),
    'handleUploadPhoto must guard against execution without verified student session'
  );

  // Officer fallback notice includes direct Sign Out action to clear cross-role session
  assert.ok(
    content.includes('Sign Out') && content.includes('onClick={logout}'),
    'Officer notice card must provide a Sign Out action to clear session'
  );
});

test('20. Critical Fix Priority 2: Canonical Photo URL Unification Across Large Avatar and StudentLayout', () => {
  // ProfilePage derives canonicalPhotoUrl from preview, formData, studentProfile, or user
  assert.ok(
    content.includes('canonicalPhotoUrl'),
    'ProfilePage must define canonicalPhotoUrl uniting local and context sources'
  );
  assert.ok(
    content.includes('studentProfile?.profilePhotoUrl'),
    'ProfilePage must check studentProfile?.profilePhotoUrl from AuthContext'
  );

  // ProfilePage synchronizes studentProfile?.profilePhotoUrl into formData
  assert.ok(
    content.includes('studentProfile?.profilePhotoUrl && !formData.profilePhotoUrl'),
    'ProfilePage must sync studentProfile photo into formData when available'
  );

  // Large avatar uses canonicalPhotoUrl and handles image load errors
  assert.ok(
    content.includes('canonicalPhotoUrl && !avatarImgError'),
    'Large avatar must display canonicalPhotoUrl when present and free of error'
  );
  assert.ok(
    content.includes('onError={() => setAvatarImgError(true)}'),
    'Large avatar must set error state when image fails to load'
  );

  // Large avatar falls back to initials
  assert.ok(
    content.includes("user?.name?.charAt(0).toUpperCase() || 'S'"),
    'Large avatar must fall back to initials if photo is absent or fails'
  );

  // Button text dynamically responds to canonicalPhotoUrl
  assert.ok(
    content.includes("canonicalPhotoUrl ? 'Change Photo' : 'Upload Photo'"),
    'Change Photo button label must inspect canonical photo existence'
  );
});

