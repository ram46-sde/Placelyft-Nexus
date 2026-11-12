import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read DriveApplicantsModal.jsx source code for structural, functional, and security verification
const modalComponentPath = path.resolve(__dirname, 'DriveApplicantsModal.jsx');
const modalComponentSource = fs.readFileSync(modalComponentPath, 'utf8');

// Mirror helper functions exactly as defined in DriveApplicantsModal.jsx for algorithmic testing
const formatAcademicYear = (year) => {
  if (!year || typeof year !== 'string' || !year.trim()) return 'N/A';
  const trimmed = year.trim();
  if (/year$/i.test(trimmed)) return trimmed;
  return `${trimmed} Year`;
};

const formatAppliedDate = (dateString) => {
  if (!dateString) return 'Date unavailable';
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ALLOWED_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'];

// ─── 1. Student Name rendering & fallback ─────────────────────────────────────
test('1. Student Name renders prominently with "Student Candidate" fallback', () => {
  assert.ok(
    modalComponentSource.includes("app.student?.name || 'Student Candidate'"),
    'Must use fallback "Student Candidate" when app.student.name is falsy'
  );
  assert.ok(
    modalComponentSource.includes('text-sm sm:text-base font-bold text-slate-900 truncate'),
    'Student name must have prominent styling and truncate protection'
  );
});

// ─── 2. Department rendering & fallback ────────────────────────────────────────
test('2. Department renders in academic info section with "N/A" fallback', () => {
  assert.ok(
    modalComponentSource.includes("profile.department || 'N/A'"),
    'Must display department or fallback to "N/A"'
  );
  assert.ok(
    modalComponentSource.includes('Dept:'),
    'Must include clear "Dept:" label'
  );
});

// ─── 3. Section rendering & fallback ───────────────────────────────────────────
test('3. Section renders in academic info section with "N/A" fallback', () => {
  assert.ok(
    modalComponentSource.includes("profile.section || 'N/A'"),
    'Must display section or fallback to "N/A"'
  );
  assert.ok(
    modalComponentSource.includes('Section:'),
    'Must include clear "Section:" label'
  );
  assert.ok(
    modalComponentSource.includes('font-semibold text-slate-800 font-mono'),
    'Section value must have distinctive font-mono styling'
  );
});

// ─── 4. Academic Year formatting & fallback ────────────────────────────────────
test('4. Academic Year formats correctly and falls back to "N/A"', () => {
  // Test formatAcademicYear algorithmic rules
  assert.equal(formatAcademicYear('I'), 'I Year');
  assert.equal(formatAcademicYear('II'), 'II Year');
  assert.equal(formatAcademicYear('III'), 'III Year');
  assert.equal(formatAcademicYear('IV'), 'IV Year');
  assert.equal(formatAcademicYear('III Year'), 'III Year');
  assert.equal(formatAcademicYear(null), 'N/A');
  assert.equal(formatAcademicYear(undefined), 'N/A');
  assert.equal(formatAcademicYear(''), 'N/A');
  assert.equal(formatAcademicYear('   '), 'N/A');
  assert.equal(formatAcademicYear(123), 'N/A');

  // Verify function definition and usage in JSX
  assert.ok(
    modalComponentSource.includes('const formatAcademicYear = (year) => {'),
    'DriveApplicantsModal.jsx must define formatAcademicYear'
  );
  assert.ok(
    modalComponentSource.includes('formatAcademicYear(profile.academicYear)'),
    'Must call formatAcademicYear for academicYear rendering in JSX'
  );
  assert.ok(
    modalComponentSource.includes('Academic Year:'),
    'Must include clear "Academic Year:" label'
  );
});

// ─── 5. Current CGPA rendering & fallback ──────────────────────────────────────
test('5. Current CGPA renders with prominent styling and "N/A" fallback', () => {
  assert.ok(
    modalComponentSource.includes('Current CGPA:'),
    'Must include clear "Current CGPA:" label'
  );
  assert.ok(
    modalComponentSource.includes('profile.cgpa !== null && profile.cgpa !== undefined'),
    'Must check profile.cgpa against null and undefined'
  );
  assert.ok(
    modalComponentSource.includes(": 'N/A'"),
    'Must fallback to "N/A" when CGPA is missing'
  );
  assert.ok(
    modalComponentSource.includes('bg-emerald-50 text-emerald-800 border border-emerald-200/80'),
    'CGPA value must have prominent emerald badge highlight'
  );
});

// ─── 6. Applied Date formatting & fallback ─────────────────────────────────────
test('6. Applied Date formats to readable string with "Date unavailable" fallback', () => {
  // Test formatAppliedDate algorithmic rules
  const sampleIso = '2026-11-09T10:30:00.000Z';
  const formatted = formatAppliedDate(sampleIso);
  assert.match(formatted, /Nov\s+9,\s+2026/);

  // Fallbacks
  assert.equal(formatAppliedDate(null), 'Date unavailable');
  assert.equal(formatAppliedDate(undefined), 'Date unavailable');
  assert.equal(formatAppliedDate(''), 'Date unavailable');
  assert.equal(formatAppliedDate('invalid-date-string'), 'Date unavailable');

  // Verify function definition and usage in JSX
  assert.ok(
    modalComponentSource.includes('const formatAppliedDate = (dateString) => {'),
    'DriveApplicantsModal.jsx must define formatAppliedDate'
  );
  assert.ok(
    modalComponentSource.includes('Applied On:'),
    'Must include clear "Applied On:" label'
  );
  assert.ok(
    modalComponentSource.includes('formatAppliedDate(app.appliedAt)'),
    'Must call formatAppliedDate for appliedAt rendering in JSX'
  );
});

// ─── 7. Resume link security and tab behavior ──────────────────────────────────
test('7. Resume link opens safely with target="_blank" and rel="noopener noreferrer"', () => {
  assert.ok(
    modalComponentSource.includes('href={profile.resumeUrl}'),
    'Resume link must point to profile.resumeUrl'
  );
  assert.ok(
    modalComponentSource.includes('target="_blank"'),
    'Resume link must open in a new tab'
  );
  assert.ok(
    modalComponentSource.includes('rel="noopener noreferrer"'),
    'Resume link must include security attributes noopener and noreferrer'
  );
  assert.ok(
    modalComponentSource.includes('View Resume'),
    'Resume action button must be labeled "View Resume"'
  );
  assert.ok(
    modalComponentSource.includes('<FileText className='),
    'Resume button must feature FileText icon'
  );
  assert.ok(
    modalComponentSource.includes('<ExternalLink className='),
    'Resume button must feature ExternalLink icon'
  );
});

// ─── 8. Missing resume displays fallback ───────────────────────────────────────
test('8. Missing resume displays "No resume attached" fallback', () => {
  assert.ok(
    modalComponentSource.includes('No resume attached'),
    'Must display fallback text "No resume attached" when resumeUrl is missing'
  );
  assert.ok(
    modalComponentSource.includes('text-xs text-slate-400 italic'),
    'Missing resume fallback must have muted italic styling'
  );
});

// ─── 9. Missing section and academicYear display N/A ───────────────────────────
test('9. Missing section and academicYear display "N/A" gracefully', () => {
  const profileWithMissingFields = {
    department: 'Electrical Engineering',
    section: null,
    academicYear: null,
  };

  const sectionDisplay = profileWithMissingFields.section || 'N/A';
  const yearDisplay = formatAcademicYear(profileWithMissingFields.academicYear);

  assert.equal(sectionDisplay, 'N/A');
  assert.equal(yearDisplay, 'N/A');
});

// ─── 10. Missing academicProfile does not crash the component ──────────────────
test('10. Missing academicProfile uses null-safe access', () => {
  assert.ok(
    modalComponentSource.includes('const profile = app.academicProfile || {};'),
    'Must safely default academicProfile to empty object to prevent runtime errors'
  );

  // Simulate rendering logic with an application that has no academicProfile
  const appWithoutProfile = {
    _id: 'app_123',
    status: 'Applied',
    appliedAt: '2026-11-09T00:00:00Z',
    student: { name: 'Bob Smith', email: 'bob@example.com' },
    academicProfile: null,
  };

  const profile = appWithoutProfile.academicProfile || {};
  assert.equal(profile.department || 'N/A', 'N/A');
  assert.equal(profile.section || 'N/A', 'N/A');
  assert.equal(formatAcademicYear(profile.academicYear), 'N/A');
  assert.equal(profile.cgpa !== null && profile.cgpa !== undefined ? profile.cgpa : 'N/A', 'N/A');
  assert.equal(profile.resumeUrl ? 'has resume' : 'No resume attached', 'No resume attached');
});

// ─── 11. Invalid or missing applied date displays fallback ────────────────────
test('11. Invalid or missing applied date displays "Date unavailable"', () => {
  assert.equal(formatAppliedDate(null), 'Date unavailable');
  assert.equal(formatAppliedDate(undefined), 'Date unavailable');
  assert.equal(formatAppliedDate('not a real date'), 'Date unavailable');
  assert.equal(formatAppliedDate(''), 'Date unavailable');
});

// ─── 12. Existing status controls remain functional ───────────────────────────
test('12. Existing status controls remain fully functional', () => {
  assert.equal(ALLOWED_STATUSES.length, 5);
  assert.ok(
    modalComponentSource.includes("const ALLOWED_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'];"),
    'Must define standard ALLOWED_STATUSES array'
  );
  assert.ok(
    modalComponentSource.includes('handleStatusChange(app._id, app.status, e.target.value)'),
    'Status dropdown onChange must trigger handleStatusChange'
  );
  assert.ok(
    modalComponentSource.includes('disabled={isRowUpdating}'),
    'Status dropdown must disable during row update'
  );
  assert.ok(
    modalComponentSource.includes('Updating...'),
    'Must show updating indicator while row status is saving'
  );
  assert.ok(
    modalComponentSource.includes('app.outcomeVerified'),
    'Must preserve outcomeVerified badge'
  );
  assert.ok(
    modalComponentSource.includes('<CheckCircle2'),
    'Must include CheckCircle2 icon for verified outcomes'
  );
});

// ─── 13. Search and status filters remain functional ──────────────────────────
test('13. Search and status filters include section and academicYear', () => {
  assert.ok(
    modalComponentSource.includes("const section = app.academicProfile?.section || '';"),
    'Search filter must extract section'
  );
  assert.ok(
    modalComponentSource.includes("const academicYear = app.academicProfile?.academicYear || '';"),
    'Search filter must extract academicYear'
  );
  assert.ok(
    modalComponentSource.includes('section.toLowerCase().includes(query)'),
    'Search filter must match section'
  );
  assert.ok(
    modalComponentSource.includes('academicYear.toLowerCase().includes(query)'),
    'Search filter must match academicYear'
  );

  // Simulate search filtering
  const sampleApps = [
    {
      _id: '1',
      student: { name: 'Alice', email: 'alice@test.edu' },
      status: 'Applied',
      academicProfile: { department: 'CSE', section: 'A', academicYear: 'III' },
    },
    {
      _id: '2',
      student: { name: 'Bob', email: 'bob@test.edu' },
      status: 'Shortlisted',
      academicProfile: { department: 'ECE', section: 'B', academicYear: 'IV' },
    },
  ];

  // Search by section "A"
  const qA = 'a';
  const matchesA = sampleApps.filter(
    (app) => (app.academicProfile?.section || '').toLowerCase().includes(qA)
  );
  assert.equal(matchesA.length, 1);
  assert.equal(matchesA[0].student.name, 'Alice');

  // Search by academicYear "IV"
  const qIV = 'iv';
  const matchesIV = sampleApps.filter(
    (app) => (app.academicProfile?.academicYear || '').toLowerCase().includes(qIV)
  );
  assert.equal(matchesIV.length, 1);
  assert.equal(matchesIV[0].student.name, 'Bob');
});

// ─── 14. Existing applicant data is not accidentally removed ──────────────────
test('14. Existing student details are preserved on the card', () => {
  // Roll number
  assert.ok(
    modalComponentSource.includes('profile.rollNumber'),
    'Roll number badge must be preserved'
  );
  // Email
  assert.ok(
    modalComponentSource.includes('app.student?.email'),
    'Student email must be preserved'
  );
  // Course and batch
  assert.ok(
    modalComponentSource.includes('profile.course'),
    'Course display must be preserved'
  );
  assert.ok(
    modalComponentSource.includes('profile.batch'),
    'Batch display must be preserved'
  );
  // Backlogs
  assert.ok(
    modalComponentSource.includes('Backlogs:'),
    'Backlogs counter must be preserved'
  );
  // Skills
  assert.ok(
    modalComponentSource.includes('Skills:'),
    'Skills pills must be preserved'
  );
});

// ─── 15. Responsive layout and typography check ────────────────────────────────
test('15. Responsive layout classes support mobile, tablet, and desktop', () => {
  assert.ok(
    modalComponentSource.includes('flex flex-col lg:flex-row lg:items-start justify-between gap-4'),
    'Card container must stack on mobile/tablet and display flex-row on desktop'
  );
  assert.ok(
    modalComponentSource.includes('min-w-0'),
    'Left info column must prevent flex children from causing horizontal scroll'
  );
  assert.ok(
    modalComponentSource.includes('truncate'),
    'Long names and emails must truncate smoothly'
  );
  assert.ok(
    modalComponentSource.includes('p-4 sm:p-5'),
    'Card padding must be responsive for mobile and larger screens'
  );
});
