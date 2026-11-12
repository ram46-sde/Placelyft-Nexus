import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const attendancePagePath = path.resolve(__dirname, 'DriveAttendancePage.jsx');
const attendancePageSource = fs.readFileSync(attendancePagePath, 'utf8');

// ─── 1. Component Export and Existence ──────────────────────────────────────
test('1. DriveAttendancePage file exists and exports default component', () => {
  assert.ok(fs.existsSync(attendancePagePath), 'DriveAttendancePage.jsx must exist');
  assert.ok(
    attendancePageSource.includes('export default DriveAttendancePage;'),
    'DriveAttendancePage.jsx must export DriveAttendancePage as default'
  );
  assert.ok(
    attendancePageSource.includes('const DriveAttendancePage = () => {'),
    'DriveAttendancePage must be defined as a functional component'
  );
});

// ─── 2. Duplicate Header Elimination ────────────────────────────────────────
test('2. Duplicate Header Elimination: exactly ONE global header via OfficerLayout', () => {
  // DriveAttendancePage must NOT render its own <header> element because OfficerLayout owns the header
  const headerMatch = attendancePageSource.match(/<header\b[^>]*>/gi);
  assert.equal(
    headerMatch,
    null,
    'DriveAttendancePage must not render a <header> element (OfficerLayout owns the global header)'
  );

  // Must not have a duplicate sign-out button
  assert.ok(
    !attendancePageSource.includes('title="Sign Out"'),
    'Duplicate Sign Out button must be removed from DriveAttendancePage'
  );
  assert.ok(
    !attendancePageSource.includes('handleLogout'),
    'handleLogout function must be removed from DriveAttendancePage'
  );
});

// ─── 3. Top Navigation & Breadcrumb ─────────────────────────────────────────
test('3. Top Navigation: Back to Placement Drives button links to /officer/drives', () => {
  assert.ok(
    attendancePageSource.includes("navigate('/officer/drives')"),
    'Back button must navigate to /officer/drives'
  );
  assert.ok(
    attendancePageSource.includes('Back to Placement Drives'),
    'Back button must have label "Back to Placement Drives"'
  );
  assert.ok(
    attendancePageSource.includes('ArrowLeft'),
    'Back button must render ArrowLeft icon'
  );
});

// ─── 4. Guard Test: Absolute Prohibition of Banned Wording ──────────────────
test('4. Guard Test: Absolute prohibition of banned wording', () => {
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/gi;
  const matches = attendancePageSource.match(bannedRegex);
  assert.equal(
    matches,
    null,
    `DriveAttendancePage.jsx must NOT contain banned words. Found: ${matches ? matches.join(', ') : 'none'}`
  );
});

// ─── 5. Guard Test: No Hand-Built LPA or Cr Strings ─────────────────────────
test('5. Guard Test: No hand-built LPA or Cr unit strings in DriveAttendancePage', () => {
  const handBuiltRegex = /[`'"][^`'"]*\b(?:LPA|Cr|lpa|ctc)\b[^`'"]*[`'"]/g;
  const matches = (attendancePageSource.match(handBuiltRegex) || []).filter(
    (str) => !str.includes('import') && !str.includes('//')
  );
  assert.deepEqual(
    matches,
    [],
    `DriveAttendancePage.jsx must NOT construct hand-built CTC strings. Found: ${matches.join(', ')}`
  );
});

// ─── 6. Page Introduction & Drive Header ────────────────────────────────────
test('6. Page Introduction: Company identity, job role, status badge, date, and CompanyLocation', () => {
  assert.ok(
    attendancePageSource.includes('driveInfo?.company'),
    'Must display company name from driveInfo'
  );
  assert.ok(
    attendancePageSource.includes('driveInfo?.jobRole'),
    'Must display job role from driveInfo'
  );
  assert.ok(
    attendancePageSource.includes('lifecycleBadge'),
    'Must render lifecycle status badge'
  );
  assert.ok(
    attendancePageSource.includes('CompanyLocation'),
    'Must use shared CompanyLocation component for location'
  );
  assert.ok(
    attendancePageSource.includes('formatDate(driveDate)'),
    'Must format driveDate with standard date formatter'
  );
  assert.ok(
    attendancePageSource.includes('registered students'),
    'Must display registered students count'
  );
});

// ─── 7. Attendance Summary KPI Cards ────────────────────────────────────────
test('7. Attendance Summary KPI Grid: 4 distinct summary cards (Total, Present, Absent, Pending)', () => {
  assert.ok(
    attendancePageSource.includes('summary.totalApplicants'),
    'Must display totalApplicants metric'
  );
  assert.ok(
    attendancePageSource.includes('summary.present'),
    'Must display present metric'
  );
  assert.ok(
    attendancePageSource.includes('summary.absent'),
    'Must display absent metric'
  );
  assert.ok(
    attendancePageSource.includes('summary.pending'),
    'Must display pending metric'
  );
  assert.ok(
    attendancePageSource.includes('Total Students'),
    'Must have "Total Students" KPI card label'
  );
  assert.ok(
    attendancePageSource.includes('Present'),
    'Must have "Present" KPI card label'
  );
  assert.ok(
    attendancePageSource.includes('Absent'),
    'Must have "Absent" KPI card label'
  );
  assert.ok(
    attendancePageSource.includes('Pending'),
    'Must have "Pending" KPI card label'
  );
});

// ─── 8. Roster Table & Serial Numbers ───────────────────────────────────────
test('8. Roster Table: Applicant serial number rendering using formatSerialNumber', () => {
  assert.ok(
    attendancePageSource.includes('formatSerialNumber'),
    'Must import and use formatSerialNumber from applicantMetrics'
  );
  assert.ok(
    attendancePageSource.includes('formatSerialNumber(applicantIndex)'),
    'Must pass serial number calculated from applicantIndex'
  );
  assert.ok(
    attendancePageSource.includes('serialNo'),
    'renderApplicantCell must receive and display serialNo'
  );
  assert.ok(
    attendancePageSource.includes('case \'studentName\':'),
    'studentName column must handle serial number alongside name'
  );
  assert.ok(
    attendancePageSource.includes('applicant.studentName'),
    'applicant studentName must be displayed'
  );
});

// ─── 9. Single Entry Point: Department Settings ─────────────────────────────
test('9. Department Settings: Single entry point with setIsDeptPanelOpen and DepartmentManagementSection', () => {
  assert.ok(
    attendancePageSource.includes('Department Settings'),
    'Must render "Department Settings" button'
  );
  assert.ok(
    attendancePageSource.includes('setIsDeptPanelOpen'),
    'Must toggle isDeptPanelOpen state'
  );
  assert.ok(
    attendancePageSource.includes('<DepartmentManagementSection'),
    'Must conditionally render DepartmentManagementSection'
  );
});

// ─── 10. Roster Search, Filter & Bulk Marking ───────────────────────────────
test('10. Roster Controls: Search, status filter, and bulk marking actions', () => {
  assert.ok(
    attendancePageSource.includes('searchTerm'),
    'Must have searchTerm state for roster search'
  );
  assert.ok(
    attendancePageSource.includes('statusFilter'),
    'Must have statusFilter state for roster filtering'
  );
  assert.ok(
    attendancePageSource.includes('handleBulkMark'),
    'Must support bulk marking action'
  );
  assert.ok(
    attendancePageSource.includes('MAX_BATCH_ENTRIES'),
    'Must respect MAX_BATCH_ENTRIES batch size cap'
  );
});

// ─── 11. Export & Print Integrations ────────────────────────────────────────
test('11. Action Bar: Share with HOD, Export menu, Print, and Refresh actions', () => {
  assert.ok(
    attendancePageSource.includes('Share with HOD'),
    'Must render "Share with HOD" button'
  );
  assert.ok(
    attendancePageSource.includes('HodShareModal'),
    'Must include HodShareModal component'
  );
  assert.ok(
    attendancePageSource.includes('AttendancePrintModal'),
    'Must include AttendancePrintModal component'
  );
  assert.ok(
    attendancePageSource.includes('downloadAttendanceCsv'),
    'Must support CSV download'
  );
  assert.ok(
    attendancePageSource.includes('copyAttendanceAsTsv'),
    'Must support copying table data'
  );
  assert.ok(
    attendancePageSource.includes('fetchAttendance'),
    'Must support refreshing attendance data'
  );
});

// ─── 12. Emerald-Green Visual Identity Adherence ────────────────────────────
test('12. Emerald-Green Theme Adherence: Zero violet or indigo theme bleed', () => {
  const violetRegex = /\b(violet|indigo)-[0-9]+/gi;
  const matches = attendancePageSource.match(violetRegex);
  assert.equal(
    matches,
    null,
    `DriveAttendancePage.jsx must not contain student violet/indigo theme classes. Found: ${matches ? matches.join(', ') : 'none'}`
  );
  assert.ok(
    attendancePageSource.includes('text-emerald-'),
    'Must use emerald text classes'
  );
  assert.ok(
    attendancePageSource.includes('bg-emerald-'),
    'Must use emerald background classes'
  );
});

