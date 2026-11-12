import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractStudentIdentifier,
  calculateApplicantMetrics,
  formatSerialNumber,
} from '../../utils/applicantMetrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const drivesPagePath = path.resolve(__dirname, 'OfficerDrivesPage.jsx');
const dashboardPath = path.resolve(__dirname, 'OfficerDashboardPage.jsx');
const layoutPath = path.resolve(__dirname, '../../layouts/OfficerLayout.jsx');
const appPath = path.resolve(__dirname, '../../App.jsx');
const modalPath = path.resolve(__dirname, '../../components/officer/DriveApplicantsModal.jsx');

const drivesSource = fs.readFileSync(drivesPagePath, 'utf8');
const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
const layoutSource = fs.readFileSync(layoutPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
const modalSource = fs.readFileSync(modalPath, 'utf8');

test('1. OfficerDrivesPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(drivesPagePath), 'OfficerDrivesPage.jsx must exist');
  assert.ok(
    drivesSource.includes('export default OfficerDrivesPage;'),
    'Must export OfficerDrivesPage as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const lines = drivesSource.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in OfficerDrivesPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const lines = drivesSource.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in OfficerDrivesPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Route Integration in App.jsx', () => {
  assert.ok(
    appSource.includes("import OfficerDrivesPage from './pages/officer/OfficerDrivesPage';"),
    'App.jsx must import OfficerDrivesPage'
  );
  assert.ok(
    appSource.includes('<Route path="drives" element={<OfficerDrivesPage />} />'),
    'App.jsx must register path="drives" under OfficerLayout'
  );
  assert.ok(
    appSource.includes("allowedRoles={['placement_officer']}"),
    'Route must be guarded by allowedRoles={["placement_officer"]}'
  );
});

test('5. Navigation Integration in OfficerLayout.jsx', () => {
  // Placement Drives nav entry must be enabled (isImplemented: true)
  const drivesNavItem = layoutSource.match(
    /id:\s*'drives'[\s\S]*?path:\s*'\/officer\/drives'[\s\S]*?isImplemented:\s*(true|false)/
  );
  assert.ok(drivesNavItem, 'Must find drives nav item in OfficerLayout.jsx');
  assert.equal(drivesNavItem[1], 'true', 'Placement Drives nav entry must have isImplemented: true');
  assert.ok(
    !drivesNavItem[0].includes("badge: 'Soon'"),
    'Placement Drives nav entry must not have Soon badge'
  );
});

test('6. Dynamic Breadcrumb & Header Info in OfficerLayout.jsx', () => {
  assert.ok(
    layoutSource.includes("pathname.startsWith('/officer/drives')"),
    'OfficerLayout must detect /officer/drives route'
  );
  assert.ok(
    layoutSource.includes("title: 'Placement Drives'"),
    'Header info must return Placement Drives page title'
  );
  assert.ok(
    layoutSource.includes("{ label: 'Placement Drives', path: null }"),
    'Breadcrumb must end with Placement Drives'
  );
});

test('7. Page Introduction Section: Heading, Subtitle & Actions', () => {
  assert.ok(
    drivesSource.includes('Placement Drives'),
    'Must render Placement Drives heading'
  );
  assert.ok(
    drivesSource.includes('onClick={fetchDrives}'),
    'Must include refresh action calling fetchDrives'
  );
  assert.ok(
    drivesSource.includes('setIsCreateModalOpen(true)'),
    'Must include Create Placement Drive button'
  );
  assert.ok(
    drivesSource.includes('<span>Create Placement Drive</span>'),
    'Must preserve Create Placement Drive button text'
  );
});

test('8. Drive Overview Metrics (5 Cards): Reuses Server-Derived Counts', () => {
  assert.ok(
    drivesSource.includes('summaryMetrics.totalDrives'),
    'Must render Total Drives metric'
  );
  assert.ok(
    drivesSource.includes('summaryMetrics.activeDrives'),
    'Must render Active Drives metric'
  );
  assert.ok(
    drivesSource.includes('summaryMetrics.closedDrives'),
    'Must render Closed Drives metric'
  );
  assert.ok(
    drivesSource.includes('summaryMetrics.archivedDrives'),
    'Must render Archived Drives metric'
  );
  assert.ok(
    drivesSource.includes('summaryMetrics.totalApplicants'),
    'Must render Total Applicants metric'
  );
});

test('9. Search and Filtering Capabilities', () => {
  assert.ok(
    drivesSource.includes('searchTerm'),
    'Must manage searchTerm state'
  );
  assert.ok(
    drivesSource.includes("setStatusFilter('ALL')"),
    'Must support ALL filter'
  );
  assert.ok(
    drivesSource.includes("setStatusFilter('ACTIVE')"),
    'Must support ACTIVE filter'
  );
  assert.ok(
    drivesSource.includes("setStatusFilter('CLOSED')"),
    'Must support CLOSED filter'
  );
  assert.ok(
    drivesSource.includes("setStatusFilter('ARCHIVED')"),
    'Must support ARCHIVED filter'
  );
  assert.ok(
    drivesSource.includes('Reset Filters'),
    'Must provide filter reset in empty state'
  );
});

test('10. Drive Actions Preservation', () => {
  // Edit
  assert.ok(
    drivesSource.includes('handleOpenEditModal(drive)'),
    'Must preserve Edit action opener'
  );
  assert.ok(
    drivesSource.includes('<span>Edit</span>'),
    'Must preserve Edit button label'
  );

  // Archive
  assert.ok(
    drivesSource.includes('handleArchive(drive)'),
    'Must preserve handleArchive'
  );

  // Restore
  assert.ok(
    drivesSource.includes('handleRestore(drive)'),
    'Must preserve handleRestore'
  );

  // Delete
  assert.ok(
    drivesSource.includes('handleDelete(drive)'),
    'Must preserve handleDelete'
  );

  // View Applicants
  assert.ok(
    drivesSource.includes('setSelectedDriveForApplicants(drive)'),
    'Must preserve View Applicants action'
  );
  assert.ok(
    drivesSource.includes('<span>View Applicants</span>'),
    'Must preserve View Applicants label'
  );

  // Attendance
  assert.ok(
    drivesSource.includes('/attendance'),
    'Must preserve Attendance navigation'
  );
  assert.ok(
    drivesSource.includes('<span>Attendance</span>'),
    'Must preserve Attendance label'
  );
});

test('11. Modals Integration & Prop Contracts', () => {
  assert.ok(
    drivesSource.includes('<CreateDriveModal'),
    'Must render CreateDriveModal'
  );
  assert.ok(
    drivesSource.includes('<EditDriveModal'),
    'Must render EditDriveModal'
  );
  assert.ok(
    drivesSource.includes('<DriveApplicantsModal'),
    'Must render DriveApplicantsModal'
  );
  assert.ok(
    drivesSource.includes('isOpen={isEditModalOpen}'),
    'Edit modal must receive isOpen'
  );
  assert.ok(
    drivesSource.includes('drive={selectedDriveForEdit}'),
    'Edit modal must receive drive'
  );
});

test('12. Dashboard Integration Bridge', () => {
  assert.ok(
    dashboardSource.includes('/officer/drives'),
    'OfficerDashboardPage must provide a link/navigation to /officer/drives'
  );
  assert.ok(
    dashboardSource.includes('Dedicated Placement Drives'),
    'Dashboard must display dedicated drives banner'
  );
});

test('13. Emerald-Green Theme Adherence: Zero Violet/Indigo Contamination', () => {
  assert.ok(
    drivesSource.includes('emerald-600') || drivesSource.includes('emerald-700'),
    'Must use emerald green accents for primary actions and badges'
  );
  assert.ok(
    !/indigo|violet|purple/i.test(drivesSource),
    'OfficerDrivesPage must not contain any violet/indigo theme classes'
  );
});

// ─── Step 2.1 Enhancements & Guardrails ──────────────────────────────────────

test('14. Step 2.1: Placement Drive Card Visual Hierarchy & Responsive Alignment', () => {
  // 1. Company Header
  assert.ok(
    drivesSource.includes('Building2'),
    'Card must include fallback Building2 icon when logo is missing'
  );
  assert.ok(
    drivesSource.includes('shrink-0 whitespace-nowrap self-start'),
    'Status badge must align right with shrink-0 and self-start to avoid collision'
  );

  // 2. Job Information & Compensation
  assert.ok(
    drivesSource.includes('line-clamp-2 min-h-[2.25rem]'),
    'Description must enforce consistent line clamping and baseline card height'
  );

  // 3. Drive Schedule Equal-Width Columns
  assert.ok(
    drivesSource.includes('grid grid-cols-2 gap-2'),
    'Schedule must be displayed in equal-width two-column grid'
  );

  // 4. Eligibility Tag Wrapping
  assert.ok(
    drivesSource.includes('flex flex-wrap items-center gap-1.5'),
    'Eligibility tags must wrap cleanly without overflow'
  );

  // 5. Card Footer Grouping & Interactive Heights
  assert.ok(
    drivesSource.includes('shadow-2xs'),
    'Applicant stats must be styled as a clean grouped chip'
  );
  assert.ok(
    drivesSource.includes('min-h-[36px]'),
    'Action buttons must maintain consistent interactive height (min-h-[36px])'
  );
  assert.ok(
    drivesSource.includes('disabled:opacity-50 disabled:cursor-not-allowed'),
    'Disabled buttons must have visible disabled styling'
  );
});

test('15. Step 2.1: Applicant Serial Number Rendering in DriveApplicantsModal', () => {
  // Format check
  assert.equal(formatSerialNumber(0), '01');
  assert.equal(formatSerialNumber(1), '02');
  assert.equal(formatSerialNumber(9), '10');

  // Modal integration check
  assert.ok(
    modalSource.includes('formatSerialNumber'),
    'DriveApplicantsModal must import and call formatSerialNumber'
  );
  assert.ok(
    modalSource.includes('serialNo'),
    'DriveApplicantsModal must compute serialNo for each row'
  );
  assert.ok(
    modalSource.includes('Applicant #${index + 1}'),
    'Serial number must provide accessibility title attribute'
  );
  assert.ok(
    modalSource.includes('profile.rollNumber'),
    'Serial number must NOT replace rollNumber'
  );
});

test('16. Step 2.1: Unique Applicants vs Total Applications Semantics (Aarav Sharma 6-Company Example)', () => {
  const aaravUserId = 'user-aarav-sharma-nexus-101';
  assert.equal(extractStudentIdentifier({ student: { _id: aaravUserId } }), aaravUserId);

  const sixDriveStats = {
    driveA: { count: 1, offersCount: 0, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' } }] },
    driveB: { count: 1, offersCount: 0, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' } }] },
    driveC: { count: 1, offersCount: 0, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' } }] },
    driveD: { count: 1, offersCount: 0, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' } }] },
    driveE: { count: 1, offersCount: 1, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' }, status: 'Selected' }] },
    driveF: { count: 1, offersCount: 0, applications: [{ student: { _id: aaravUserId, name: 'Aarav Sharma' } }] },
  };

  const metrics = calculateApplicantMetrics(sixDriveStats);
  assert.equal(metrics.uniqueApplicants, 1, 'Distinct students must be exactly 1');
  assert.equal(metrics.totalApplicants, 1, 'Total Applicants SSoT must be 1');
  assert.equal(metrics.totalApplications, 6, 'Total Applications must be 6');
  assert.equal(metrics.totalOffers, 1, 'Total Offers must be 1');

  // Verify OfficerDrivesPage uses calculateApplicantMetrics
  assert.ok(
    drivesSource.includes('calculateApplicantMetrics(driveStats)'),
    'OfficerDrivesPage must calculate metrics via calculateApplicantMetrics'
  );
  assert.ok(
    drivesSource.includes('summaryMetrics.totalApplications'),
    'OfficerDrivesPage must expose and render totalApplications metric'
  );
});

test('17. Step 2.1: Distinct Students Sharing the Same Name Count Separately Using Stable IDs', () => {
  const duplicateNameStats = {
    drive1: {
      count: 2,
      offersCount: 0,
      applications: [
        { student: { _id: 'student-id-001', name: 'Rahul Sharma' } },
        { student: { _id: 'student-id-002', name: 'Rahul Sharma' } },
      ],
    },
  };

  const metrics = calculateApplicantMetrics(duplicateNameStats);
  assert.equal(metrics.uniqueApplicants, 2, 'Two distinct users with same name must count as 2');
  assert.equal(metrics.totalApplications, 2, 'Total applications must count as 2');
});

test('18. Step 2.1: Dashboard Metric Consistency with Placement Drives Page', () => {
  assert.ok(
    dashboardSource.includes('calculateApplicantMetrics(driveStats)'),
    'OfficerDashboardPage must compute metrics using calculateApplicantMetrics'
  );
  assert.ok(
    dashboardSource.includes('summaryMetrics.totalApplications'),
    'OfficerDashboardPage must expose totalApplications'
  );
  assert.ok(
    dashboardSource.includes('Distinct students applied'),
    'Dashboard must display "Distinct students applied" subtitle on Card 3'
  );
});

test('19. Step 2.1: Tenant Authorization & Route Protection Integrity', () => {
  assert.ok(
    appSource.includes("allowedRoles={['placement_officer']}"),
    'Officer routes must remain guarded strictly by allowedRoles={["placement_officer"]}'
  );
  assert.ok(
    !appSource.includes('<Route path="drives" element={<OfficerDrivesPage />} />\n  <Route path="drives"'),
    'No duplicated route definitions'
  );
});

