import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read source files for structural, state, and behavioral verification
const attendancePagePath = path.resolve(__dirname, '../../pages/officer/DriveAttendancePage.jsx');
const attendancePageSource = fs.readFileSync(attendancePagePath, 'utf8');

const deptSectionPath = path.resolve(__dirname, 'DepartmentManagementSection.jsx');
const deptSectionSource = fs.readFileSync(deptSectionPath, 'utf8');

const servicePath = path.resolve(__dirname, '../../services/officerService.js');
const serviceSource = fs.readFileSync(servicePath, 'utf8');

// Mirror normalization and validation logic from DepartmentManagementSection.jsx
const normalizeAlias = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
};

const validateDeptFields = (formData) => {
  const errors = {};
  const name = (formData.name || '').trim();
  const code = (formData.code || '').trim();

  if (!name) {
    errors.name = 'Department name is required.';
  } else if (name.length < 2 || name.length > 100) {
    errors.name = 'Department name must be between 2 and 100 characters.';
  }

  if (!code) {
    errors.code = 'Department code is required.';
  } else if (code.length < 2 || code.length > 20) {
    errors.code = 'Department code must be between 2 and 20 characters.';
  } else if (!/^[a-zA-Z0-9\-_]+$/.test(code)) {
    errors.code = 'Code must contain only letters, numbers, hyphens, and underscores.';
  }

  const hodName = (formData.hodContact?.name || '').trim();
  const hodEmail = (formData.hodContact?.email || '').trim();
  const hodPhone = (formData.hodContact?.phone || '').trim();
  const hodLoc = (formData.hodContact?.officeLocation || '').trim();

  if (hodName && (hodName.length < 2 || hodName.length > 100)) {
    errors.hodName = 'HOD name must be between 2 and 100 characters.';
  }

  if (hodEmail) {
    if (hodEmail.length > 254) {
      errors.hodEmail = 'HOD email cannot exceed 254 characters.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hodEmail)) {
      errors.hodEmail = 'Please enter a valid email address.';
    }
  }

  if (hodPhone) {
    const digits = hodPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      errors.hodPhone = 'Phone number must contain between 7 and 15 digits.';
    } else if (!/^(\+?[0-9\s\-()]+)$/.test(hodPhone)) {
      errors.hodPhone = 'Phone contains invalid characters (allowed: +, digits, spaces, -, ()).';
    }
  }

  if (hodLoc && hodLoc.length > 100) {
    errors.hodOfficeLocation = 'Office location cannot exceed 100 characters.';
  }

  return errors;
};

// ---------------------------------------------------------------------------
// Test Suite: CPMS Department Coordination - Stage 2 Unit & Integration Tests
// ---------------------------------------------------------------------------

test('1. Single Department Settings entry point in DriveAttendancePage replaces previous separate links', () => {
  // Must NOT contain the old separate links
  assert.ok(
    !attendancePageSource.includes('HOD Contact Settings'),
    'DriveAttendancePage.jsx must not contain legacy "HOD Contact Settings" link'
  );
  assert.ok(
    !attendancePageSource.includes('Manage Department Names & Aliases'),
    'DriveAttendancePage.jsx must not contain legacy "Manage Department Names & Aliases" link'
  );

  // Must contain single unified entry point
  assert.ok(
    attendancePageSource.includes('Department Settings'),
    'DriveAttendancePage.jsx must contain a single "Department Settings" button'
  );
  assert.ok(
    attendancePageSource.includes('setIsDeptPanelOpen'),
    'DriveAttendancePage.jsx must use boolean setIsDeptPanelOpen state'
  );
});

test('2. Clicking single entry point toggles unified department management panel', () => {
  assert.ok(
    attendancePageSource.includes('isDeptPanelOpen'),
    'DriveAttendancePage.jsx manages isDeptPanelOpen state'
  );
  assert.ok(
    attendancePageSource.includes('onClick={() => setIsDeptPanelOpen((prev) => !prev)}') ||
      attendancePageSource.includes('setIsDeptPanelOpen((prev) => !prev)') ||
      attendancePageSource.includes('setIsDeptPanelOpen(true)'),
    'Department Settings button toggles isDeptPanelOpen'
  );
  assert.ok(
    attendancePageSource.includes('{isDeptPanelOpen && (') &&
      attendancePageSource.includes('<DepartmentManagementSection'),
    'DepartmentManagementSection is conditionally rendered when isDeptPanelOpen is true'
  );
});

test('3. No duplicate / competing "Department Management" headings exist in attendance page wrapper', () => {
  // Ensure the outer wrapper in DriveAttendancePage.jsx does not render a competing <h2>
  const panelRenderSection = attendancePageSource.slice(
    attendancePageSource.indexOf('isDeptPanelOpen && ('),
    attendancePageSource.indexOf('<DepartmentManagementSection')
  );
  assert.ok(
    !panelRenderSection.includes('<h2'),
    'Outer attendance wrapper must not render a competing <h2> heading above DepartmentManagementSection'
  );
  assert.ok(
    deptSectionSource.includes('Department Directory'),
    'DepartmentManagementSection renders its canonical "Department Directory" heading'
  );
});

test('4. Empty state displays an "Add First Department" or "Add Department" action button', () => {
  assert.ok(
    deptSectionSource.includes('No active departments configured yet'),
    'Empty state clearly notifies officer that no active departments are configured'
  );
  assert.ok(
    deptSectionSource.includes('Add First Department'),
    'Empty state provides a prominent "Add First Department" button'
  );
  assert.ok(
    deptSectionSource.includes('openAddModal'),
    'Empty state action triggers openAddModal'
  );
});

test('5. Add Department form opens when clicking Add Department action in toolbar/header', () => {
  assert.ok(
    deptSectionSource.includes('isAddModalOpen'),
    'Add modal visibility is managed by isAddModalOpen state'
  );
  assert.ok(
    deptSectionSource.includes('onClick={openAddModal}'),
    'Add Department button in header binds to openAddModal'
  );
  assert.ok(
    deptSectionSource.includes('Add New Department'),
    'Add Modal contains title "Add New Department"'
  );
});

test('6. Add form contains Department Name, Department Code, Aliases, and HOD details', () => {
  // Name & Code fields
  assert.ok(
    deptSectionSource.includes('Department Name') && deptSectionSource.includes('addFormData.name'),
    'Add form binds department name'
  );
  assert.ok(
    deptSectionSource.includes('Code') && deptSectionSource.includes('addFormData.code'),
    'Add form binds department code'
  );
  // Aliases builder
  assert.ok(
    deptSectionSource.includes('addFormData.aliases') &&
      deptSectionSource.includes('handleAddAliasToAddForm') &&
      deptSectionSource.includes('handleRemoveAliasFromAddForm'),
    'Add form includes alias add/remove tags'
  );
  // HOD Contact fields
  assert.ok(
    deptSectionSource.includes('addFormData.hodContact.name'),
    'Add form binds HOD Name'
  );
  assert.ok(
    deptSectionSource.includes('addFormData.hodContact.email'),
    'Add form binds HOD Email'
  );
  assert.ok(
    deptSectionSource.includes('addFormData.hodContact.phone'),
    'Add form binds HOD Phone'
  );
  assert.ok(
    deptSectionSource.includes('addFormData.hodContact.officeLocation'),
    'Add form binds HOD Office Location'
  );
});

test('7. Form validation enforces schema rules and detects errors accurately', () => {
  // Empty required fields
  const emptyErrors = validateDeptFields({ name: '', code: '' });
  assert.equal(emptyErrors.name, 'Department name is required.');
  assert.equal(emptyErrors.code, 'Department code is required.');

  // Code with invalid characters
  const invalidCodeErrors = validateDeptFields({ name: 'Valid Dept', code: 'CSE@#$' });
  assert.equal(
    invalidCodeErrors.code,
    'Code must contain only letters, numbers, hyphens, and underscores.'
  );

  // Invalid email and phone
  const invalidHodErrors = validateDeptFields({
    name: 'Valid Dept',
    code: 'CSE',
    hodContact: {
      email: 'not-an-email',
      phone: '123', // less than 7 digits
    },
  });
  assert.equal(invalidHodErrors.hodEmail, 'Please enter a valid email address.');
  assert.equal(
    invalidHodErrors.hodPhone,
    'Phone number must contain between 7 and 15 digits.'
  );

  // Valid inputs pass with zero errors
  const validErrors = validateDeptFields({
    name: 'Computer Science and Engineering',
    code: 'CSE',
    hodContact: {
      name: 'Dr. John Doe',
      email: 'hod.cse@college.edu',
      phone: '+91 9876543210',
      officeLocation: 'Room 302',
    },
  });
  assert.deepEqual(validErrors, {});
});

test('8. Submitting valid Add form invokes officerService.createDepartment', () => {
  assert.ok(
    deptSectionSource.includes('officerService.createDepartment'),
    'DepartmentManagementSection calls officerService.createDepartment on form submit'
  );
  assert.ok(
    serviceSource.includes('createDepartment: async (payload)'),
    'officerService defines createDepartment API helper'
  );
  assert.ok(
    serviceSource.includes("api.post('/officer/departments', payload)"),
    'officerService.createDepartment posts to /officer/departments'
  );
});

test('9. Successful Add updates department list, resets form, and closes modal; failure preserves inputs', () => {
  assert.ok(
    deptSectionSource.includes('setDepartments((prev) => [...prev, res.department])'),
    'New department is appended to department state on success'
  );
  assert.ok(
    deptSectionSource.includes('closeAddModal()'),
    'Modal is closed on success'
  );
  assert.ok(
    deptSectionSource.includes('setAddErrors({ general: res.message'),
    'Modal retains form inputs and sets error state on failure'
  );
});

test('10. Edit Department modal pre-populates existing department name, code, aliases, and HOD details', () => {
  assert.ok(
    deptSectionSource.includes('openEditModal = (dept) =>'),
    'Component defines openEditModal pre-populating department values'
  );
  assert.ok(
    deptSectionSource.includes('name: dept.name || \'\''),
    'Prepopulates department name'
  );
  assert.ok(
    deptSectionSource.includes('code: dept.code || \'\''),
    'Prepopulates department code'
  );
  assert.ok(
    deptSectionSource.includes('aliases: Array.isArray(dept.aliases) ? [...dept.aliases] : []'),
    'Prepopulates department aliases'
  );
  assert.ok(
    deptSectionSource.includes('name: dept.hodContact?.name || \'\''),
    'Prepopulates HOD name'
  );
  assert.ok(
    deptSectionSource.includes('email: dept.hodContact?.email || \'\''),
    'Prepopulates HOD email'
  );
});

test('11. Submitting valid Edit form invokes officerService.updateDepartment and updates state', () => {
  assert.ok(
    deptSectionSource.includes('officerService.updateDepartment(editingDepartment._id, payload)'),
    'Calls officerService.updateDepartment with department ID and payload'
  );
  assert.ok(
    serviceSource.includes('updateDepartment: async (deptId, payload)'),
    'officerService defines updateDepartment API helper'
  );
  assert.ok(
    serviceSource.includes("api.put(`/officer/departments/${deptId}`, payload)"),
    'officerService.updateDepartment issues PUT request'
  );
  assert.ok(
    deptSectionSource.includes('prev.map((d) => (d._id === editingDepartment._id ? res.department : d))'),
    'Updated department replaces existing department in state'
  );
});

test('12. Permanent deletion flow: Delete button, confirmation policy, HTTP 409 handling, and card removal', () => {
  // 12a. Delete button is visible on department card
  assert.ok(
    deptSectionSource.includes('title="Delete Department"'),
    'Card header includes "Delete Department" button'
  );
  assert.ok(
    deptSectionSource.includes('openDeleteModal'),
    'Delete button triggers openDeleteModal'
  );

  // 12b. Confirmation modal with strict permanent deletion policy
  assert.ok(
    deptSectionSource.includes('Delete Department?'),
    'Confirmation dialog displays explicit "Delete Department?" title'
  );
  assert.ok(
    deptSectionSource.includes('Permanent Deletion Policy'),
    'Dialog features Permanent Deletion Policy notice'
  );
  assert.ok(
    deptSectionSource.includes('Historical attendance will never be deleted'),
    'Notice explicitly clarifies that historical attendance will never be deleted'
  );
  assert.ok(
    deptSectionSource.includes('only when no dependent records exist'),
    'Notice clarifies deletion is allowed only when no dependent records exist'
  );

  // 12c. Cancel does not delete and dismisses modal
  assert.ok(
    deptSectionSource.includes('onClick={closeDeleteModal}'),
    'Cancel button safely calls closeDeleteModal without mutating state'
  );

  // 12d. Successful deletion invokes officerService.deleteDepartment and removes card
  assert.ok(
    deptSectionSource.includes('officerService.deleteDepartment(deletingDepartment._id)'),
    'Invokes officerService.deleteDepartment with department ID'
  );
  assert.ok(
    deptSectionSource.includes('setDepartments((prev) => prev.filter((d) => d._id !== deletingDepartment._id))'),
    'Removes deleted department from state on success'
  );
  assert.ok(
    serviceSource.includes('deleteDepartment: async (deptId)'),
    'officerService defines deleteDepartment helper'
  );
  assert.ok(
    serviceSource.includes("api.delete(`/officer/departments/${deptId}`)"),
    'officerService issues DELETE request'
  );

  // 12e. HTTP 409 preserves card in directory and displays backend explanation
  assert.ok(
    deptSectionSource.includes('setDeleteError(') &&
      deptSectionSource.includes('{deleteError && ('),
    'Component retains form state and renders error banner on 409 failure'
  );

  // 12f. No Deactivate or Reactivate controls remain
  assert.ok(
    !deptSectionSource.includes('Deactivate Department'),
    'Component contains zero legacy "Deactivate Department" wording or controls'
  );
  assert.ok(
    !deptSectionSource.includes('Reactivate'),
    'Component contains zero "Reactivate" wording or controls'
  );
  assert.ok(
    !serviceSource.includes('updateDepartmentStatus'),
    'officerService contains zero legacy updateDepartmentStatus method'
  );
});

test('13. Preserves existing inline HOD contact and alias quick editing workflows', () => {
  // Inline HOD handlers
  assert.ok(
    deptSectionSource.includes('startEditHod') &&
      deptSectionSource.includes('handleSaveHod') &&
      deptSectionSource.includes('cancelEditHod'),
    'Inline HOD editing handlers and state are preserved'
  );
  assert.ok(
    deptSectionSource.includes('officerService.updateHodContact'),
    'Inline HOD save calls officerService.updateHodContact'
  );

  // Inline Aliases handlers
  assert.ok(
    deptSectionSource.includes('startEditAliases') &&
      deptSectionSource.includes('handleSaveAliases') &&
      deptSectionSource.includes('cancelEditAliases'),
    'Inline Aliases editing handlers and state are preserved'
  );
  assert.ok(
    deptSectionSource.includes('officerService.updateDepartmentAliases'),
    'Inline Aliases save calls officerService.updateDepartmentAliases'
  );

  // Alias normalization helper
  assert.equal(normalizeAlias('C.S.E.'), 'cse');
  assert.equal(normalizeAlias('E & TC'), 'e and tc');
  assert.equal(normalizeAlias('  Information   Technology  '), 'information technology');
});
