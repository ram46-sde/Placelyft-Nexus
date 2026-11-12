import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardPath = path.resolve(__dirname, 'OfficerDashboardPage.jsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

test('1. OfficerDashboardPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(dashboardPath), 'OfficerDashboardPage.jsx must exist');
  assert.ok(
    dashboardContent.includes('export default OfficerDashboardPage;'),
    'Must export OfficerDashboardPage as default'
  );
});

test('2. Duplicate Header Elimination: Exactly ONE Global Header Remains via OfficerLayout', () => {
  // Must NOT render any internal <header> tag
  assert.ok(
    !dashboardContent.includes('<header'),
    'OfficerDashboardPage must not contain an internal <header> tag'
  );
  // Must NOT repeat legacy header branding "CPMS" or "Placement Officer Portal"
  assert.ok(
    !dashboardContent.includes('CPMS'),
    'OfficerDashboardPage must not contain legacy CPMS brand wordmark'
  );
  // Must NOT contain nested <main> element (layout already provides <main id="main-content">)
  assert.ok(
    !dashboardContent.includes('<main'),
    'OfficerDashboardPage must not contain nested <main> tag'
  );
  // Must NOT contain full-page min-h-screen container
  assert.ok(
    !dashboardContent.includes('min-h-screen'),
    'OfficerDashboardPage must not wrap content in min-h-screen'
  );
});

test('3. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const lines = dashboardContent.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in OfficerDashboardPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const lines = dashboardContent.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in OfficerDashboardPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('5. Dashboard Introduction Section: Title, Subtitle & Primary Actions', () => {
  assert.ok(
    dashboardContent.includes('Placement Operations'),
    'Must contain clean page heading'
  );
  assert.ok(
    dashboardContent.includes('onClick={fetchDrives}') ||
      dashboardContent.includes('fetchDrives();'),
    'Must include refresh action calling fetchDrives'
  );
  assert.ok(
    dashboardContent.includes('setIsCreateModalOpen(true)'),
    'Must include Create Placement Drive button opening modal'
  );
  assert.ok(
    dashboardContent.includes('<span>Create Placement Drive</span>'),
    'Must preserve Create Placement Drive button label'
  );
});

test('6. KPI Metrics: All 7 Metrics Preserved Without Calculation Changes', () => {
  // 1. Total Drives
  assert.ok(
    dashboardContent.includes('summaryMetrics.totalDrives'),
    'Must render Total Drives metric'
  );
  assert.ok(
    dashboardContent.includes('Total Drives'),
    'Must render Total Drives label'
  );

  // 2. Active Drives
  assert.ok(
    dashboardContent.includes('summaryMetrics.activeDrives'),
    'Must render Active Drives metric'
  );
  assert.ok(
    dashboardContent.includes('Active Drives'),
    'Must render Active Drives label'
  );

  // 3. Total Applicants
  assert.ok(
    dashboardContent.includes('summaryMetrics.totalApplicants'),
    'Must render Total Applicants metric'
  );
  assert.ok(
    dashboardContent.includes('Total Applicants'),
    'Must render Total Applicants label'
  );

  // 4. Verified Selections
  assert.ok(
    dashboardContent.includes('placementMetrics.verifiedSelections'),
    'Must render Verified Selections metric'
  );
  assert.ok(
    dashboardContent.includes('METRIC_LABELS.VERIFIED_SELECTIONS'),
    'Must use METRIC_LABELS.VERIFIED_SELECTIONS'
  );

  // 5. Verified Offers
  assert.ok(
    dashboardContent.includes('placementMetrics.verifiedOffers'),
    'Must render Verified Offers metric'
  );
  assert.ok(
    dashboardContent.includes('METRIC_LABELS.VERIFIED_OFFERS'),
    'Must use METRIC_LABELS.VERIFIED_OFFERS'
  );

  // 6. Highest Package
  assert.ok(
    dashboardContent.includes('placementMetrics.highestPackage'),
    'Must render Highest Package metric'
  );
  assert.ok(
    dashboardContent.includes('METRIC_LABELS.HIGHEST_PACKAGE'),
    'Must use METRIC_LABELS.HIGHEST_PACKAGE'
  );

  // 7. Needs Verification
  assert.ok(
    dashboardContent.includes('placementMetrics.needsVerification'),
    'Must render Needs Verification metric'
  );
  assert.ok(
    dashboardContent.includes('METRIC_LABELS.NEEDS_VERIFICATION'),
    'Must use METRIC_LABELS.NEEDS_VERIFICATION'
  );
  assert.ok(
    dashboardContent.includes("setOutcomesSubView('queue')"),
    'Needs Verification card must allow direct navigation to outcomes queue'
  );
});

test('7. Navigation Tabs: Placement Drives & Placement Outcomes', () => {
  assert.ok(
    dashboardContent.includes("setActiveTab('drives')"),
    'Must provide Placement Drives tab switch'
  );
  assert.ok(
    dashboardContent.includes("setActiveTab('outcomes')"),
    'Must provide Placement Outcomes tab switch'
  );
  assert.ok(
    dashboardContent.includes('<PlacementOutcomesSection'),
    'Must render PlacementOutcomesSection when on outcomes tab'
  );
});

test('8. Placement Drives Actions & Contract Invariants', () => {
  // Search and filter toolbar
  assert.ok(dashboardContent.includes('searchTerm'), 'Must support searchTerm filtering');
  assert.ok(dashboardContent.includes('statusFilter'), 'Must support statusFilter');

  // Edit drive modal
  assert.ok(dashboardContent.includes('handleOpenEditModal(drive)'), 'Must preserve handleOpenEditModal');
  assert.ok(dashboardContent.includes('<EditDriveModal'), 'Must render EditDriveModal');

  // View applicants modal
  assert.ok(dashboardContent.includes('setSelectedDriveForApplicants(drive)'), 'Must preserve view applicants');
  assert.ok(dashboardContent.includes('<DriveApplicantsModal'), 'Must render DriveApplicantsModal');

  // Attendance route navigation
  assert.ok(dashboardContent.includes('/attendance'), 'Must preserve attendance navigation');

  // Archive / Restore / Delete lifecycle actions
  assert.ok(dashboardContent.includes('handleArchive(drive)'), 'Must preserve handleArchive');
  assert.ok(dashboardContent.includes('handleRestore(drive)'), 'Must preserve handleRestore');
  assert.ok(dashboardContent.includes('handleDelete(drive)'), 'Must preserve handleDelete');
});

test('9. Emerald Green Visual Theme Adherence: Zero Violet/Indigo Contamination', () => {
  // Emerald green palette classes present
  assert.ok(
    dashboardContent.includes('emerald-600') || dashboardContent.includes('emerald-700'),
    'Must use emerald green accents for primary actions and badges'
  );
  // Zero violet/indigo/purple classes
  assert.ok(
    !/indigo|violet|purple/i.test(dashboardContent),
    'OfficerDashboardPage must not contain any violet/indigo theme classes'
  );
});

