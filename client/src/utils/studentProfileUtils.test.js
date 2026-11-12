import test from 'node:test';
import assert from 'node:assert/strict';
import { getDepartmentLabel } from './studentProfileUtils.js';

test('getDepartmentLabel - null / undefined / non-object inputs', () => {
  assert.equal(getDepartmentLabel(null), 'Student');
  assert.equal(getDepartmentLabel(undefined), 'Student');
  assert.equal(getDepartmentLabel(42), 'Student');
  assert.equal(getDepartmentLabel('not an object'), 'Student');
  assert.equal(getDepartmentLabel(true), 'Student');
  assert.equal(getDepartmentLabel([]), 'Student');
});

test('getDepartmentLabel - empty or missing fields fallback to Student', () => {
  assert.equal(getDepartmentLabel({}), 'Student');
  assert.equal(getDepartmentLabel({ department: '' }), 'Student');
  assert.equal(getDepartmentLabel({ department: '   ' }), 'Student');
  assert.equal(getDepartmentLabel({ department: null }), 'Student');
  assert.equal(getDepartmentLabel({ departmentId: null }), 'Student');
  assert.equal(getDepartmentLabel({ departmentId: {} }), 'Student');
  assert.equal(getDepartmentLabel({ departmentId: { name: '' } }), 'Student');
  assert.equal(getDepartmentLabel({ departmentId: { name: '   ' } }), 'Student');
});

test('getDepartmentLabel - plain department string', () => {
  assert.equal(
    getDepartmentLabel({ department: 'Computer Science and Engineering' }),
    'Computer Science and Engineering'
  );
  assert.equal(
    getDepartmentLabel({ department: '  Information Technology  ' }),
    'Information Technology'
  );
});

test('getDepartmentLabel - populated departmentId object precedence', () => {
  assert.equal(
    getDepartmentLabel({
      departmentId: { _id: '123', name: 'Mechanical Engineering' },
      department: 'Old Dept',
    }),
    'Mechanical Engineering'
  );

  assert.equal(
    getDepartmentLabel({
      departmentId: { name: '  Electrical and Electronics Engineering  ' },
    }),
    'Electrical and Electronics Engineering'
  );
});

test('getDepartmentLabel - fallback when departmentId name is empty', () => {
  assert.equal(
    getDepartmentLabel({
      departmentId: { name: '   ' },
      department: 'Civil Engineering',
    }),
    'Civil Engineering'
  );

  assert.equal(
    getDepartmentLabel({
      departmentId: 'raw_object_id_string',
      department: 'Civil Engineering',
    }),
    'Civil Engineering'
  );
});

test('getDepartmentLabel - legacyDepartment fallback', () => {
  assert.equal(
    getDepartmentLabel({
      legacyDepartment: 'Aerospace Engineering',
    }),
    'Aerospace Engineering'
  );

  assert.equal(
    getDepartmentLabel({
      department: '',
      legacyDepartment: 'Biotechnology',
    }),
    'Biotechnology'
  );
});

test('getDepartmentLabel - plain text preservation (XSS / special characters)', () => {
  const specialStr = '<script>alert("xss")</script>';
  assert.equal(getDepartmentLabel({ department: specialStr }), specialStr);
});

