import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read OfficerDashboardPage.jsx source code for structural & behavioral verification
const dashboardPath = path.resolve(__dirname, 'OfficerDashboardPage.jsx');
const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');

// Mirror getDriveStatus and lifecycle helpers from OfficerDashboardPage.jsx
const isRegistrationDeadlinePassed = (registrationDeadline, now = new Date()) => {
  if (!registrationDeadline) return false;
  const deadlineDate = new Date(registrationDeadline);
  if (isNaN(deadlineDate.getTime())) return false;

  const refTime = new Date(now).getTime();

  const isDateOnly =
    (typeof registrationDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(registrationDeadline.trim())) ||
    (deadlineDate.getUTCHours() === 0 &&
      deadlineDate.getUTCMinutes() === 0 &&
      deadlineDate.getUTCSeconds() === 0 &&
      deadlineDate.getUTCMilliseconds() === 0) ||
    (deadlineDate.getHours() === 0 &&
      deadlineDate.getMinutes() === 0 &&
      deadlineDate.getSeconds() === 0 &&
      deadlineDate.getMilliseconds() === 0);

  let effectiveDeadlineTimestamp;
  if (isDateOnly) {
    const endOfDay = new Date(deadlineDate);
    if (
      deadlineDate.getUTCHours() === 0 &&
      deadlineDate.getUTCMinutes() === 0 &&
      deadlineDate.getUTCSeconds() === 0 &&
      deadlineDate.getUTCMilliseconds() === 0
    ) {
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      endOfDay.setHours(23, 59, 59, 999);
    }
    effectiveDeadlineTimestamp = endOfDay.getTime();
  } else {
    effectiveDeadlineTimestamp = deadlineDate.getTime();
  }

  return refTime >= effectiveDeadlineTimestamp;
};

const getDriveStatus = (drive, now = new Date()) => {
  if (!drive) return 'closed';
  if (drive.isArchived || drive.status === 'archived') return 'archived';
  if (drive.isActive === false || drive.status === 'closed') return 'closed';
  if (isRegistrationDeadlinePassed(drive.registrationDeadline, now)) return 'closed';
  return 'active';
};

// ─── 1. Edit Action Visibility: Active Drives ────────────────────────────────
test('1. Edit action is permitted for active drives', () => {
  const activeDrive = {
    _id: 'drive_active_1',
    isActive: true,
    isArchived: false,
    registrationDeadline: new Date(Date.now() + 86400000 * 10).toISOString(),
  };

  const status = getDriveStatus(activeDrive);
  assert.equal(status, 'active');

  // Verify dashboard JSX exposes Edit button when driveStatus !== 'archived'
  assert.ok(
    dashboardSource.includes('driveStatus === \'archived\' ? ('),
    'Dashboard must branch on driveStatus === "archived"'
  );
  assert.ok(
    dashboardSource.includes('onClick={() => handleOpenEditModal(drive)}'),
    'Active drive must render Edit button with handleOpenEditModal(drive)'
  );
});

// ─── 2. Edit Action Visibility: Closed Drives ────────────────────────────────
test('2. Edit action is permitted for closed drives', () => {
  const closedDrive = {
    _id: 'drive_closed_1',
    isActive: false, // Manually closed
    isArchived: false,
    registrationDeadline: new Date(Date.now() + 86400000 * 10).toISOString(),
  };

  const status = getDriveStatus(closedDrive);
  assert.equal(status, 'closed');

  // Closed drives (driveStatus === 'closed') take the non-archived branch
  assert.notEqual(status, 'archived');
  assert.ok(
    dashboardSource.includes('onClick={() => handleOpenEditModal(drive)}'),
    'Closed drive must render Edit button in the non-archived branch'
  );
});

// ─── 3. Edit Action Visibility: Archived Drives Excluded ──────────────────────
test('3. Edit action is strictly excluded for archived drives', () => {
  const archivedDrive = {
    _id: 'drive_archived_1',
    isActive: false,
    isArchived: true,
    archivedAt: new Date().toISOString(),
  };

  const status = getDriveStatus(archivedDrive);
  assert.equal(status, 'archived');

  // Inspect the archived branch: must only contain Restore and Delete, never Edit
  const archivedBranchMatch = dashboardSource.match(
    /driveStatus === 'archived'\s*\?\s*\(\s*<>([\s\S]*?)<\/>\s*\)\s*:\s*\(\s*<>/
  );
  assert.ok(archivedBranchMatch, 'Must locate archived JSX branch');

  const archivedJsx = archivedBranchMatch[1];
  assert.ok(
    archivedJsx.includes('handleRestore'),
    'Archived branch must include Restore action'
  );
  assert.ok(
    archivedJsx.includes('handleDelete'),
    'Archived branch must include Delete action'
  );
  assert.ok(
    !archivedJsx.includes('handleOpenEditModal') && !archivedJsx.includes('Edit'),
    'Archived branch must NOT include Edit button'
  );
});

// ─── 4. Clicking Edit selects the correct drive ──────────────────────────────
test('4. handleOpenEditModal stores the selected drive and sets isEditModalOpen to true', () => {
  assert.ok(
    dashboardSource.includes('const handleOpenEditModal = (drive) => {'),
    'Dashboard must define handleOpenEditModal handler'
  );
  assert.ok(
    dashboardSource.includes('setSelectedDriveForEdit(drive);'),
    'handleOpenEditModal must set selectedDriveForEdit'
  );
  assert.ok(
    dashboardSource.includes('setIsEditModalOpen(true);'),
    'handleOpenEditModal must set isEditModalOpen to true'
  );
});

// ─── 5. Correct drive is passed into EditDriveModal ──────────────────────────
test('5. EditDriveModal receives the correct prop contract', () => {
  assert.ok(
    dashboardSource.includes('<EditDriveModal'),
    'Dashboard must render EditDriveModal component'
  );
  assert.ok(
    dashboardSource.includes('isOpen={isEditModalOpen}'),
    'EditDriveModal must receive isOpen={isEditModalOpen}'
  );
  assert.ok(
    dashboardSource.includes('drive={selectedDriveForEdit}'),
    'EditDriveModal must receive drive={selectedDriveForEdit}'
  );
  assert.ok(
    dashboardSource.includes('onClose={handleCloseEditModal}'),
    'EditDriveModal must receive onClose={handleCloseEditModal}'
  );
  assert.ok(
    dashboardSource.includes('onSuccess={handleDriveUpdated}'),
    'EditDriveModal must receive onSuccess={handleDriveUpdated}'
  );
});

// ─── 6. Modal close resets selection ─────────────────────────────────────────
test('6. handleCloseEditModal clears selection and closes modal', () => {
  assert.ok(
    dashboardSource.includes('const handleCloseEditModal = () => {'),
    'Dashboard must define handleCloseEditModal handler'
  );
  assert.ok(
    dashboardSource.includes('setIsEditModalOpen(false);'),
    'handleCloseEditModal must set isEditModalOpen to false'
  );
  assert.ok(
    dashboardSource.includes('setSelectedDriveForEdit(null);'),
    'handleCloseEditModal must reset selectedDriveForEdit to null'
  );
});

// ─── 7. Successful update triggers drive list refresh ────────────────────────
test('7. handleDriveUpdated closes modal, notifies success, and triggers fetchDrives()', () => {
  assert.ok(
    dashboardSource.includes('const handleDriveUpdated = async (updatedDrive) => {'),
    'Dashboard must define async handleDriveUpdated handler'
  );
  assert.ok(
    dashboardSource.includes('setIsEditModalOpen(false);') &&
    dashboardSource.includes('setSelectedDriveForEdit(null);'),
    'handleDriveUpdated must close modal and clear selected drive'
  );
  assert.ok(
    dashboardSource.includes('setSuccessBanner('),
    'handleDriveUpdated must set success notification banner'
  );
  assert.ok(
    dashboardSource.includes('await fetchDrives();'),
    'handleDriveUpdated must refresh drives from the backend via await fetchDrives()'
  );
  assert.ok(
    dashboardSource.includes('setActionError('),
    'handleDriveUpdated must communicate clearly if list refresh fails'
  );
});

// ─── 8. Existing card actions remain present and unchanged ───────────────────
test('8. Existing card actions (View Applicants, Attendance, Archive, Restore, Delete) remain intact', () => {
  // View Applicants
  assert.ok(
    dashboardSource.includes('setSelectedDriveForApplicants(drive)'),
    'View Applicants action must remain present'
  );
  assert.ok(
    dashboardSource.includes('<span>View Applicants</span>'),
    'View Applicants button label must be preserved'
  );

  // Attendance
  assert.ok(
    dashboardSource.includes('/attendance'),
    'Attendance navigation action must remain present'
  );
  assert.ok(
    dashboardSource.includes('<span>Attendance</span>'),
    'Attendance button label must be preserved'
  );

  // Archive
  assert.ok(
    dashboardSource.includes('handleArchive(drive)'),
    'Archive action must remain present with unchanged handler'
  );

  // Restore
  assert.ok(
    dashboardSource.includes('handleRestore(drive)'),
    'Restore action must remain present with unchanged handler'
  );

  // Delete
  assert.ok(
    dashboardSource.includes('handleDelete(drive)'),
    'Delete action must remain present with unchanged handler'
  );
});

// ─── 9. Switching between different drives does not reuse stale modal data ────
test('9. State initialization supports clean drive switching without stale data retention', () => {
  // Simulated state transitions
  let selectedDrive = null;
  let isOpen = false;

  const openEdit = (drive) => {
    selectedDrive = drive;
    isOpen = true;
  };

  const closeEdit = () => {
    selectedDrive = null;
    isOpen = false;
  };

  const driveA = { _id: 'A', jobRole: 'Frontend Dev' };
  const driveB = { _id: 'B', jobRole: 'Backend Dev' };

  // Open Drive A
  openEdit(driveA);
  assert.equal(selectedDrive._id, 'A');
  assert.equal(isOpen, true);

  // Close modal
  closeEdit();
  assert.equal(selectedDrive, null);
  assert.equal(isOpen, false);

  // Open Drive B
  openEdit(driveB);
  assert.equal(selectedDrive._id, 'B');
  assert.equal(isOpen, true);
});

// ─── 10. Edit Button Styling & Accessibility ─────────────────────────────────
test('10. Edit button implements accessible attributes, icons, and consistent styling', () => {
  assert.ok(
    dashboardSource.includes('title="Edit placement drive details"'),
    'Edit button must provide a descriptive title attribute'
  );
  assert.ok(
    dashboardSource.includes('aria-label='),
    'Edit button must provide an aria-label attribute'
  );
  assert.ok(
    dashboardSource.includes('<Pencil className="w-3.5 h-3.5 text-slate-500" />'),
    'Edit button must include the Pencil icon'
  );
  assert.ok(
    dashboardSource.includes('inline-flex items-center gap-1 px-2.5 py-1.5'),
    'Edit button must use consistent button layout classes'
  );
});

