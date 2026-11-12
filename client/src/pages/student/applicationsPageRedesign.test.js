import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApplicationStages } from '../../utils/applicationTrackingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const applicationsPagePath = path.join(__dirname, 'ApplicationsPage.jsx');

test('1. ApplicationsPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(applicationsPagePath), 'ApplicationsPage.jsx must exist');
  const content = fs.readFileSync(applicationsPagePath, 'utf8');
  assert.ok(
    content.includes('export default ApplicationsPage;'),
    'Must export ApplicationsPage as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const content = fs.readFileSync(applicationsPagePath, 'utf8');
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in ApplicationsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const content = fs.readFileSync(applicationsPagePath, 'utf8');
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in ApplicationsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Recruitment Tracking Stages: Applied Status', () => {
  const app = {
    _id: 'app1',
    status: 'Applied',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  // Stage 1: Applied (Current)
  assert.equal(stages[0].id, 'applied');
  assert.equal(stages[0].status, 'current');
  assert.ok(stages[0].date);

  // Subsequent stages pending
  assert.equal(stages[1].status, 'pending');
  assert.equal(stages[2].status, 'pending');
  assert.equal(stages[3].status, 'pending');
});

test('5. Recruitment Tracking Stages: Shortlisted Status', () => {
  const app = {
    _id: 'app2',
    status: 'Shortlisted',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'current');
  assert.equal(stages[2].status, 'pending');
  assert.equal(stages[3].status, 'pending');
});

test('6. Recruitment Tracking Stages: Interviewing Status', () => {
  const app = {
    _id: 'app3',
    status: 'Interviewing',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[2].status, 'current');
  assert.equal(stages[3].status, 'pending');
});

test('7. Recruitment Tracking Stages: Selected (Unverified) Status', () => {
  const app = {
    _id: 'app4',
    status: 'Selected',
    outcomeVerified: false,
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[2].status, 'completed');
  assert.equal(stages[3].id, 'outcome');
  assert.equal(stages[3].status, 'completed');
  assert.equal(stages[3].label, 'Selected (Unverified)');
});

test('8. Recruitment Tracking Stages: Verified Placement Status', () => {
  const app = {
    _id: 'app5',
    status: 'Selected',
    outcomeVerified: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[2].status, 'completed');
  assert.equal(stages[3].id, 'outcome');
  assert.equal(stages[3].status, 'verified');
  assert.equal(stages[3].label, 'Verified Placement');
});

test('9. Recruitment Tracking Stages: Rejected at Shortlisting', () => {
  const app = {
    _id: 'app6a',
    status: 'Rejected',
    level_name: 'Shortlisting',
    rejection_reason: 'Minimum CGPA threshold of 8.0 not met',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 4);

  // Application Submitted: completed
  assert.equal(stages[0].id, 'applied');
  assert.equal(stages[0].status, 'completed');
  assert.ok(stages[0].date);

  // Shortlisting: unsuccessful (Red X), shows reason
  assert.equal(stages[1].id, 'shortlisting');
  assert.equal(stages[1].status, 'unsuccessful');
  assert.equal(stages[1].reason, 'Minimum CGPA threshold of 8.0 not met');

  // Subsequent stages: pending / Not reached
  assert.equal(stages[2].id, 'interviewing');
  assert.equal(stages[2].status, 'pending');
  assert.equal(stages[2].description, 'Not reached');

  assert.equal(stages[3].id, 'outcome');
  assert.equal(stages[3].status, 'pending');
  assert.equal(stages[3].description, 'Not reached');
});

test('10. Recruitment Tracking Stages: Rejected at Technical Interview', () => {
  const app = {
    _id: 'app6b',
    status: 'Rejected',
    level_name: 'Technical Interview',
    rejection_reason: 'Coding evaluation did not pass benchmark',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 5);

  // Application Submitted: completed
  assert.equal(stages[0].status, 'completed');

  // Shortlisting: confirmed completed
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[1].label, 'Shortlisting');

  // Technical Interview: unsuccessful (Red X)
  assert.equal(stages[2].id, 'technical_interview');
  assert.equal(stages[2].status, 'unsuccessful');
  assert.equal(stages[2].reason, 'Coding evaluation did not pass benchmark');

  // Subsequent stages: pending / Not reached
  assert.equal(stages[3].id, 'hr_interview');
  assert.equal(stages[3].status, 'pending');
  assert.equal(stages[3].description, 'Not reached');

  assert.equal(stages[4].id, 'outcome');
  assert.equal(stages[4].status, 'pending');
  assert.equal(stages[4].description, 'Not reached');
});

test('11. Recruitment Tracking Stages: Rejected at HR Interview', () => {
  const app = {
    _id: 'app6c',
    status: 'Rejected',
    level_name: 'HR Interview Round',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 5);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[2].status, 'completed');

  // HR Interview: unsuccessful
  assert.equal(stages[3].id, 'hr_interview');
  assert.equal(stages[3].status, 'unsuccessful');
  assert.equal(stages[3].reason, undefined, 'No fabricated reason when data does not provide one');

  // Final Outcome: pending / Not reached
  assert.equal(stages[4].id, 'outcome');
  assert.equal(stages[4].status, 'pending');
  assert.equal(stages[4].description, 'Not reached');
});

test('12. Recruitment Tracking Stages: Rejected during Assessment / Online Test', () => {
  const app = {
    _id: 'app6d',
    status: 'Rejected',
    level_name: 'Aptitude Test',
    rejection_reason: 'Aptitude cutoff not cleared',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 5);

  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[1].status, 'completed');
  assert.equal(stages[2].id, 'assessment');
  assert.equal(stages[2].status, 'unsuccessful');
  assert.equal(stages[2].reason, 'Aptitude cutoff not cleared');
  assert.equal(stages[3].status, 'pending');
  assert.equal(stages[4].status, 'pending');
});

test('13. Recruitment Tracking Stages: Rejected with Missing level_name Shows Honest Unavailable State', () => {
  const app = {
    _id: 'app6e',
    status: 'Rejected',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const stages = getApplicationStages(app);
  assert.equal(stages.length, 3);

  // Application Submitted: completed
  assert.equal(stages[0].status, 'completed');

  // Evaluation: unsuccessful, description says stage information unavailable
  assert.equal(stages[1].id, 'evaluation');
  assert.equal(stages[1].status, 'unsuccessful');
  assert.equal(stages[1].description, 'Stage information unavailable');
  assert.equal(stages[1].reason, undefined, 'Must not fabricate a rejection reason');

  // Final Outcome: pending / Not reached
  assert.equal(stages[2].id, 'outcome');
  assert.equal(stages[2].status, 'pending');
  assert.equal(stages[2].description, 'Not reached');
});

test('14. Recruitment Tracking Stages: Fallback Fields for level_name (rejection_level, rejected_round)', () => {
  const app1 = {
    status: 'Rejected',
    rejection_level: 'Technical Round 2',
  };
  const stages1 = getApplicationStages(app1);
  const unsuccessfulStage1 = stages1.find((s) => s.status === 'unsuccessful');
  assert.ok(unsuccessfulStage1);
  assert.equal(unsuccessfulStage1.id, 'technical_interview');

  const app2 = {
    status: 'Rejected',
    rejected_round: 'Shortlisting Screening',
  };
  const stages2 = getApplicationStages(app2);
  const unsuccessfulStage2 = stages2.find((s) => s.status === 'unsuccessful');
  assert.ok(unsuccessfulStage2);
  assert.equal(unsuccessfulStage2.id, 'shortlisting');
});

test('15. Recruitment Tracking Stages: Incomplete or Missing Data Graceful Handling', () => {
  assert.deepEqual(getApplicationStages(null), []);
  assert.deepEqual(getApplicationStages(undefined), []);

  const emptyApp = {};
  const stages = getApplicationStages(emptyApp);
  assert.equal(stages.length, 4);
  assert.equal(stages[0].id, 'applied');
  assert.equal(stages[0].status, 'current');
});

test('16. Functional Check: API Invocations, Responsive Layouts & Accessibility', () => {
  const content = fs.readFileSync(applicationsPagePath, 'utf8');

  // API invocation
  assert.ok(
    content.includes('applicationService.getMyApplications()'),
    'Must call applicationService.getMyApplications()'
  );

  // Navigation
  assert.ok(
    content.includes('to={`/student/drives/${drive._id}`}'),
    'Must link to drive details'
  );

  // Responsive layouts (desktop horizontal + mobile vertical)
  assert.ok(content.includes('hidden sm:block'), 'Must contain desktop tracker layout');
  assert.ok(content.includes('sm:hidden'), 'Must contain mobile vertical timeline');

  // Touch targets
  assert.ok(content.includes('min-h-[44px]'), 'Must support min 44px touch targets');
});
