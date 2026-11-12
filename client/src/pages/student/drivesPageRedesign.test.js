import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const drivesPagePath = path.join(__dirname, 'DrivesPage.jsx');

test('1. DrivesPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(drivesPagePath), 'DrivesPage.jsx must exist');
  const content = fs.readFileSync(drivesPagePath, 'utf8');
  assert.ok(content.includes('export default DrivesPage;'), 'Must export DrivesPage as default');
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const content = fs.readFileSync(drivesPagePath, 'utf8');
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in DrivesPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const content = fs.readFileSync(drivesPagePath, 'utf8');
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in DrivesPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Functional Check: Watermark Updates Preserved for Navigation Badge', () => {
  const content = fs.readFileSync(drivesPagePath, 'utf8');
  assert.ok(
    content.includes("cpms_drives_watermark_"),
    'Must store watermark in localStorage under cpms_drives_watermark_${user._id}'
  );
  assert.ok(
    content.includes("cpms_drives_watermark_updated"),
    'Must dispatch cpms_drives_watermark_updated custom event'
  );
});

test('5. Functional Check: Accessibility & Semantic Structure', () => {
  const content = fs.readFileSync(drivesPagePath, 'utf8');
  // Check accessible labels and roles
  assert.ok(content.includes('role="dialog"'), 'Quick apply modal must use role="dialog"');
  assert.ok(content.includes('aria-modal="true"'), 'Quick apply modal must have aria-modal="true"');
  assert.ok(content.includes('aria-labelledby='), 'Quick apply modal must have aria-labelledby');
  assert.ok(content.includes('aria-label='), 'Action buttons must have aria-label for screen readers');
  assert.ok(content.includes('min-h-[44px]'), 'Must support minimum 44px touch targets');
});

test('6. Search and Filter Simulation Tests', () => {
  const mockDrives = [
    {
      _id: 'd1',
      jobRole: 'Frontend Engineer',
      company: { name: 'Acme Corp' },
      companyLocation: 'Bengaluru',
      driveDate: '2026-12-01',
      registrationDeadline: '2026-11-20',
      packageDetails: '14 LPA',
      hasApplied: false,
      eligibility: { isEligible: true, reasons: [] },
      eligibilityCriteria: { requiredSkills: ['React', 'TypeScript'] },
    },
    {
      _id: 'd2',
      jobRole: 'Backend Developer',
      company: { name: 'Beta Systems' },
      companyLocation: 'Hyderabad',
      driveDate: '2026-11-25',
      registrationDeadline: '2026-11-15',
      packageDetails: '18 LPA',
      hasApplied: true,
      eligibility: { isEligible: true, reasons: [] },
      eligibilityCriteria: { requiredSkills: ['Node.js', 'PostgreSQL'] },
    },
    {
      _id: 'd3',
      jobRole: 'Data Analyst',
      company: { name: 'Gamma Analytics' },
      companyLocation: 'Pune',
      driveDate: '2026-12-10',
      registrationDeadline: '2026-11-30',
      packageDetails: '9 LPA',
      hasApplied: false,
      eligibility: { isEligible: false, reasons: ['CGPA requirement not met'] },
      eligibilityCriteria: { requiredSkills: ['Python', 'SQL'] },
    },
  ];

  // Search by company name
  const queryCompany = 'beta';
  const matchCompany = mockDrives.filter(
    (d) =>
      d.company.name.toLowerCase().includes(queryCompany) ||
      d.jobRole.toLowerCase().includes(queryCompany)
  );
  assert.equal(matchCompany.length, 1);
  assert.equal(matchCompany[0]._id, 'd2');

  // Search by skill
  const querySkill = 'react';
  const matchSkill = mockDrives.filter((d) =>
    (d.eligibilityCriteria.requiredSkills || []).join(' ').toLowerCase().includes(querySkill)
  );
  assert.equal(matchSkill.length, 1);
  assert.equal(matchSkill[0]._id, 'd1');

  // Filter eligible
  const eligibleDrives = mockDrives.filter((d) => d.eligibility.isEligible);
  assert.equal(eligibleDrives.length, 2);

  // Filter ineligible
  const ineligibleDrives = mockDrives.filter((d) => !d.eligibility.isEligible);
  assert.equal(ineligibleDrives.length, 1);
  assert.equal(ineligibleDrives[0]._id, 'd3');

  // Filter applied
  const appliedDrives = mockDrives.filter((d) => d.hasApplied);
  assert.equal(appliedDrives.length, 1);
  assert.equal(appliedDrives[0]._id, 'd2');
});

test('7. Sorting Simulation Tests', () => {
  const drives = [
    { _id: 'd1', driveDate: '2026-12-05', company: { name: 'Zeta' }, packageDetails: '10 LPA' },
    { _id: 'd2', driveDate: '2026-11-20', company: { name: 'Alpha' }, packageDetails: '25 LPA' },
    { _id: 'd3', driveDate: '2026-12-01', company: { name: 'Beta' }, packageDetails: '15 LPA' },
  ];

  // Drive date soonest
  const sortedSoonest = [...drives].sort(
    (a, b) => new Date(a.driveDate).getTime() - new Date(b.driveDate).getTime()
  );
  assert.equal(sortedSoonest[0]._id, 'd2');
  assert.equal(sortedSoonest[1]._id, 'd3');
  assert.equal(sortedSoonest[2]._id, 'd1');

  // Company A-Z
  const sortedCompany = [...drives].sort((a, b) =>
    a.company.name.localeCompare(b.company.name)
  );
  assert.equal(sortedCompany[0].company.name, 'Alpha');
  assert.equal(sortedCompany[1].company.name, 'Beta');
  assert.equal(sortedCompany[2].company.name, 'Zeta');

  // Package highest
  const getPkgVal = (d) => {
    const match = d.packageDetails.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };
  const sortedPackage = [...drives].sort((a, b) => getPkgVal(b) - getPkgVal(a));
  assert.equal(sortedPackage[0]._id, 'd2'); // 25
  assert.equal(sortedPackage[1]._id, 'd3'); // 15
  assert.equal(sortedPackage[2]._id, 'd1'); // 10
});

