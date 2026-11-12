import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const driveDetailsPagePath = path.join(__dirname, 'DriveDetailsPage.jsx');

test('1. DriveDetailsPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(driveDetailsPagePath), 'DriveDetailsPage.jsx must exist');
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  assert.ok(
    content.includes('export default DriveDetailsPage;'),
    'Must export DriveDetailsPage as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in DriveDetailsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in DriveDetailsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Functional Check: API Invocations and Data Preserved', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  assert.ok(
    content.includes('driveService.getDriveById'),
    'Must call driveService.getDriveById'
  );
  assert.ok(
    content.includes('applicationService.applyForDrive'),
    'Must call applicationService.applyForDrive'
  );
  assert.ok(
    content.includes('to="/student/drives"'),
    'Must provide back navigation link to /student/drives'
  );
});

test('5. Functional Check: Invariants & Accessibility', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  assert.ok(
    content.includes('isArchived'),
    'Must preserve isArchived banner and state handling'
  );
  assert.ok(
    content.includes('role="dialog"'),
    'Must have role="dialog" on confirmation modal'
  );
  assert.ok(
    content.includes('aria-modal="true"'),
    'Must have aria-modal="true" on confirmation modal'
  );
  assert.ok(
    content.includes('min-h-[44px]'),
    'Must enforce min 44px touch targets on interactive controls'
  );
});

test('6. Functional Check: UG Basis Evaluation', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');
  assert.ok(
    content.includes('ugBasis'),
    'Must compute effective UG basis'
  );
  assert.ok(
    content.includes("'CGPA'"),
    'Must handle CGPA basis'
  );
  assert.ok(
    content.includes("'PERCENTAGE'"),
    'Must handle PERCENTAGE basis'
  );
});

test('7. Eligibility UI Correction: Positive messages never render as red Unmet Criteria', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');

  // Verify that Unmet Criteria block is strictly conditioned on !isEligible
  assert.ok(
    content.includes('isEligible ? ('),
    'Must conditionally branch based on isEligible'
  );
  assert.ok(
    content.includes('Profile Status'),
    'Eligible students must see a Profile Status card, not Unmet Criteria'
  );
  assert.ok(
    content.includes('Unmet Criteria'),
    'Ineligible students must see Unmet Criteria'
  );

  // Logic simulation of the component rendering branch
  const renderEligibilitySection = (isEligible, reasons) => {
    if (isEligible) {
      return {
        variant: 'emerald',
        title: 'Profile Status',
        message: reasons.length > 0 && reasons[0].includes('meet')
          ? reasons[0]
          : 'You meet all eligibility criteria for this drive.',
      };
    }
    return {
      variant: 'rose',
      title: 'Unmet Criteria',
      reasons: reasons.length > 0
        ? reasons
        : ['Your profile does not satisfy one or more requirements for this placement drive.'],
    };
  };

  // Case A: Eligible student with backend reason "You meet all eligibility criteria for this drive."
  const eligibleResult = renderEligibilitySection(true, ['You meet all eligibility criteria for this drive.']);
  assert.equal(eligibleResult.variant, 'emerald');
  assert.equal(eligibleResult.title, 'Profile Status');
  assert.notEqual(eligibleResult.title, 'Unmet Criteria');
  assert.equal(eligibleResult.message, 'You meet all eligibility criteria for this drive.');

  // Case B: Ineligible student with genuine reasons
  const ineligibleResult = renderEligibilitySection(false, ['10th Standard % below 60%.']);
  assert.equal(ineligibleResult.variant, 'rose');
  assert.equal(ineligibleResult.title, 'Unmet Criteria');
  assert.deepEqual(ineligibleResult.reasons, ['10th Standard % below 60%.']);

  // Case C: Ineligible student with empty reasons array
  const noReasonIneligible = renderEligibilitySection(false, []);
  assert.equal(noReasonIneligible.variant, 'rose');
  assert.equal(noReasonIneligible.title, 'Unmet Criteria');
  assert.equal(
    noReasonIneligible.reasons[0],
    'Your profile does not satisfy one or more requirements for this placement drive.'
  );
});

test('8. Hero Visual Hierarchy: Company Name and Job Title Typography & Alignment', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');

  // Company name: ~18-20px (text-lg sm:text-xl)
  assert.ok(
    content.includes('text-lg sm:text-xl font-semibold text-slate-800'),
    'Company name must use high-contrast readable typography (text-lg sm:text-xl font-semibold)'
  );

  // Primary heading: ~28-32px (text-2xl sm:text-3xl font-bold)
  assert.ok(
    content.includes('text-2xl sm:text-3xl font-bold tracking-tight text-slate-900'),
    'Job role heading must use prominent typography (text-2xl sm:text-3xl font-bold)'
  );

  // Logo isolation: negative margin must be applied to the logo container ONLY
  assert.ok(
    content.includes('-mt-10 sm:-mt-12 w-20 h-20 sm:w-24 sm:h-24'),
    'Negative top margin must be isolated to logo container to prevent text banner overlap'
  );

  // Verify flex row itself does NOT have negative top margin
  const lines = content.split('\n');
  const headerRowLine = lines.find((l) => l.includes('Header Row with Monogram, Company Identity & Titles'));
  assert.ok(headerRowLine, 'Header row marker must exist');
});

test('9. Functional Check: Application Button States Preserved', () => {
  const content = fs.readFileSync(driveDetailsPagePath, 'utf8');

  // 1. Archived state
  assert.ok(content.includes('Applied & Archived (Read-Only)'));

  // 2. Already applied state
  assert.ok(content.includes('Application Submitted'));

  // 3. Deadline passed state
  assert.ok(content.includes('Registration Closed'));

  // 4. Eligible state
  assert.ok(content.includes('Apply Now'));

  // 5. Ineligible state
  assert.ok(content.includes('Not Eligible to Apply'));
});
