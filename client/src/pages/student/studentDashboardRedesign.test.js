import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRIC_LABELS, METRIC_DESCRIPTIONS } from '../../constants/placementMetrics.js';
import { formatCtc } from '../../utils/placementMetrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../');

test('1. Student Nav Items Invariant: Matches Only Existing Student Routes', () => {
  const layoutPath = path.join(clientSrcDir, 'layouts/StudentLayout.jsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  // Must include only existing student routes
  const expectedRoutes = [
    '/student/dashboard',
    '/student/drives',
    '/student/applications',
    '/student/profile',
    '/student/notifications',
  ];

  for (const route of expectedRoutes) {
    assert.ok(
      layoutContent.includes(`path: '${route}'`),
      `StudentLayout must include route ${route}`
    );
  }

  // Must NOT include non-existent student routes like attendance
  assert.ok(
    !layoutContent.includes('/student/attendance'),
    'StudentLayout must not contain /student/attendance route'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const targetFiles = [
    path.join(clientSrcDir, 'layouts/StudentLayout.jsx'),
    path.join(clientSrcDir, 'pages/student/DashboardPage.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/WelcomeBanner.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/DashboardKpiSection.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/VerifiedPlacementSection.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/ApplicationProgressSection.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/LatestDrivesSection.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/RecentActivitySection.jsx'),
  ];

  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  for (const file of targetFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      assert.ok(
        !bannedRegex.test(line),
        `Banned wording found in ${file}:${idx + 1}: ${line.trim()}`
      );
    });
  }
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings Outside formatCtc', () => {
  const targetFiles = [
    path.join(clientSrcDir, 'pages/student/DashboardPage.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/VerifiedPlacementSection.jsx'),
    path.join(clientSrcDir, 'components/student/dashboard/LatestDrivesSection.jsx'),
  ];

  const lpaCrRegex = /['"`][^'"`\n]*(?:LPA|Cr)[^'"`\n]*['"`]/;

  for (const file of targetFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      assert.ok(
        !lpaCrRegex.test(line),
        `Hand-built LPA/Cr string found in ${file}:${idx + 1}: ${line.trim()}`
      );
    });
  }
});

test('4. Metric Terminology Adherence in Dashboard Components', () => {
  const verifiedSectionPath = path.join(
    clientSrcDir,
    'components/student/dashboard/VerifiedPlacementSection.jsx'
  );
  const kpiSectionPath = path.join(
    clientSrcDir,
    'components/student/dashboard/DashboardKpiSection.jsx'
  );

  const verifiedContent = fs.readFileSync(verifiedSectionPath, 'utf8');
  const kpiContent = fs.readFileSync(kpiSectionPath, 'utf8');

  // Must reference METRIC_LABELS constants
  assert.ok(
    verifiedContent.includes('METRIC_LABELS.VERIFIED_SECTION_TITLE'),
    'VerifiedPlacementSection must reference METRIC_LABELS.VERIFIED_SECTION_TITLE'
  );
  assert.ok(
    kpiContent.includes('METRIC_LABELS.SELECTED_UNVERIFIED'),
    'DashboardKpiSection must reference METRIC_LABELS.SELECTED_UNVERIFIED'
  );

  // Exact constant values
  assert.equal(METRIC_LABELS.VERIFIED_SECTION_TITLE, 'Verified Placement');
  assert.equal(METRIC_LABELS.SELECTED_UNVERIFIED, 'Selected (Unverified)');
  assert.equal(
    METRIC_DESCRIPTIONS.VERIFIED_EMPTY_STATE,
    'Verified outcomes appear here once your placement officer verifies a selection.'
  );
});

test('5. Shared UI Primitives Exist and Export Standard Components', () => {
  const commonFiles = [
    'Card.jsx',
    'Badge.jsx',
    'SectionHeader.jsx',
    'StatCard.jsx',
    'EmptyState.jsx',
    'Skeleton.jsx',
  ];

  for (const file of commonFiles) {
    const filePath = path.join(clientSrcDir, 'components/common', file);
    assert.ok(fs.existsSync(filePath), `Shared primitive ${file} must exist`);
  }
});

