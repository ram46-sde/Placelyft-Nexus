import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractStudentIdentifier,
  calculateApplicantMetrics,
  formatSerialNumber,
} from './applicantMetrics.js';

test('1. extractStudentIdentifier extracts stable identifier from populated student._id', () => {
  const app = {
    _id: 'app-001',
    student: {
      _id: 'student-user-123',
      name: 'Aarav Sharma',
      email: 'aarav@nexus.edu',
    },
    academicProfile: {
      rollNumber: '21CS001',
    },
  };
  assert.equal(extractStudentIdentifier(app), 'student-user-123');
});

test('2. extractStudentIdentifier falls back to unpopulated string student ID', () => {
  const app = {
    _id: 'app-002',
    student: 'student-user-456',
    academicProfile: null,
  };
  assert.equal(extractStudentIdentifier(app), 'student-user-456');
});

test('3. extractStudentIdentifier falls back to academicProfile rollNumber when student is missing', () => {
  const app = {
    _id: 'app-003',
    student: null,
    academicProfile: {
      rollNumber: '21IT042',
    },
  };
  assert.equal(extractStudentIdentifier(app), 'roll:21IT042');
});

test('4. extractStudentIdentifier falls back to application _id when no student identity exists', () => {
  const app = {
    _id: 'app-004',
    student: null,
    academicProfile: null,
  };
  assert.equal(extractStudentIdentifier(app), 'app:app-004');
});

test('5. extractStudentIdentifier safely returns null for null/undefined/non-object input', () => {
  assert.equal(extractStudentIdentifier(null), null);
  assert.equal(extractStudentIdentifier(undefined), null);
  assert.equal(extractStudentIdentifier('invalid'), null);
  assert.equal(extractStudentIdentifier({}), null);
});

test('6. Example Case: Six applications from ONE student produces Unique Applicants = 1 and Total Applications = 6', () => {
  const studentId = 'student-aarav-sharma-101';
  const sixDriveStats = {
    driveA: {
      count: 1,
      offersCount: 0,
      applications: [{ _id: 'app-a', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Applied' }],
    },
    driveB: {
      count: 1,
      offersCount: 0,
      applications: [{ _id: 'app-b', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Applied' }],
    },
    driveC: {
      count: 1,
      offersCount: 0,
      applications: [{ _id: 'app-c', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Shortlisted' }],
    },
    driveD: {
      count: 1,
      offersCount: 0,
      applications: [{ _id: 'app-d', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Interviewing' }],
    },
    driveE: {
      count: 1,
      offersCount: 1,
      applications: [{ _id: 'app-e', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Selected' }],
    },
    driveF: {
      count: 1,
      offersCount: 0,
      applications: [{ _id: 'app-f', student: { _id: studentId, name: 'Aarav Sharma' }, status: 'Applied' }],
    },
  };

  const metrics = calculateApplicantMetrics(sixDriveStats);
  assert.equal(metrics.uniqueApplicants, 1, 'Unique applicants must be 1');
  assert.equal(metrics.totalApplicants, 1, 'Total applicants (SSoT alias) must be 1');
  assert.equal(metrics.totalApplications, 6, 'Total applications must be 6');
  assert.equal(metrics.totalOffers, 1, 'Total offers must be 1');
});

test('7. Distinct students with the EXACT SAME NAME are counted separately using stable IDs', () => {
  const statsWithSameNames = {
    drive1: {
      count: 2,
      offersCount: 0,
      applications: [
        { _id: 'app-1', student: { _id: 'student-id-001', name: 'Rahul Sharma' }, status: 'Applied' },
        { _id: 'app-2', student: { _id: 'student-id-002', name: 'Rahul Sharma' }, status: 'Applied' },
      ],
    },
  };

  const metrics = calculateApplicantMetrics(statsWithSameNames);
  assert.equal(metrics.uniqueApplicants, 2, 'Distinct students sharing name must count as 2');
  assert.equal(metrics.totalApplicants, 2, 'Total applicants must count as 2');
  assert.equal(metrics.totalApplications, 2, 'Total applications must count as 2');
});

test('8. calculateApplicantMetrics handles empty, null or undefined input safely', () => {
  const empty1 = calculateApplicantMetrics(null);
  assert.deepEqual(empty1, {
    uniqueApplicants: 0,
    totalApplicants: 0,
    totalApplications: 0,
    totalOffers: 0,
  });

  const empty2 = calculateApplicantMetrics({});
  assert.deepEqual(empty2, {
    uniqueApplicants: 0,
    totalApplicants: 0,
    totalApplications: 0,
    totalOffers: 0,
  });

  const empty3 = calculateApplicantMetrics([]);
  assert.deepEqual(empty3, {
    uniqueApplicants: 0,
    totalApplicants: 0,
    totalApplications: 0,
    totalOffers: 0,
  });
});

test('9. formatSerialNumber correctly pads numbers with leading zeros and handles pagination', () => {
  assert.equal(formatSerialNumber(0), '01');
  assert.equal(formatSerialNumber(1), '02');
  assert.equal(formatSerialNumber(8), '09');
  assert.equal(formatSerialNumber(9), '10');
  assert.equal(formatSerialNumber(99), '100');

  // With pagination
  assert.equal(formatSerialNumber(0, 1, 10), '01');
  assert.equal(formatSerialNumber(0, 2, 10), '11');
  assert.equal(formatSerialNumber(4, 3, 10), '25');

  // Edge cases
  assert.equal(formatSerialNumber(-1), '01');
  assert.equal(formatSerialNumber(null), '01');
  assert.equal(formatSerialNumber(undefined), '01');
});

