/**
 * Baseline standard department suggestions for College Placement Management Platform.
 *
 * NOTE: These are approved suggested department options for college configuration.
 * To preserve strict multi-tenant isolation, this catalog is NOT automatically seeded
 * into the database. Colleges or authorized college admins selectively adopt or
 * instantiate standard departments within their tenant scope.
 */

const STANDARD_DEPARTMENTS = Object.freeze([
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'ECE', name: 'Electronics and Communication Engineering' },
  { code: 'EEE', name: 'Electrical and Electronics Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'CHEM', name: 'Chemical Engineering' },
  { code: 'AI_DS', name: 'Artificial Intelligence and Data Science' },
  { code: 'CS_BS', name: 'Computer Science and Business Systems' },
  { code: 'MCA', name: 'Master of Computer Applications' },
  { code: 'MBA', name: 'Master of Business Administration' },
]);

module.exports = {
  STANDARD_DEPARTMENTS,
};
