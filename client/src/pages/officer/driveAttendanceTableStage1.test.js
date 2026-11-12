import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read DriveAttendancePage.jsx source code for structural & architectural verification
const attendancePath = path.resolve(__dirname, 'DriveAttendancePage.jsx');
const attendanceSource = fs.readFileSync(attendancePath, 'utf8');

// Mirror column configuration definition from DriveAttendancePage.jsx
const ATTENDANCE_TABLE_COLUMNS = [
  {
    id: 'select',
    label: '',
    headerClassName: 'w-10 px-4 py-2.5 text-center',
    cellClassName: 'w-10 px-4 py-3 text-center align-middle',
    isConditional: true,
  },
  {
    id: 'studentName',
    label: 'Student Name',
    headerClassName: 'px-4 py-2.5 text-left font-semibold min-w-[160px]',
    cellClassName: 'px-4 py-3 text-left align-middle min-w-[160px]',
  },
  {
    id: 'rollNumber',
    label: 'Roll Number',
    headerClassName: 'w-28 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-28 px-3 py-3 text-left align-middle',
  },
  {
    id: 'department',
    label: 'Department',
    headerClassName: 'w-36 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-36 px-3 py-3 text-left align-middle',
  },
  {
    id: 'status',
    label: 'Status',
    headerClassName: 'w-24 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-24 px-3 py-3 text-left align-middle',
  },
  {
    id: 'markedBy',
    label: 'Marked By',
    headerClassName: 'w-32 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-32 px-3 py-3 text-left align-middle',
  },
  {
    id: 'markedAt',
    label: 'Marked At',
    headerClassName: 'w-36 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-36 px-3 py-3 text-left align-middle',
  },
  {
    id: 'actions',
    label: 'Actions',
    headerClassName: 'w-24 px-3 py-2.5 text-left font-semibold',
    cellClassName: 'w-24 px-3 py-3 text-left align-middle',
  },
];

const getActiveAttendanceColumns = ({ isArchived = false } = {}) => {
  return ATTENDANCE_TABLE_COLUMNS.filter((col) => !isArchived || !col.isConditional);
};

// ─── 1. Shared Column Configuration Definition ──────────────────────────────
test('1. Shared column configuration is defined and drives both thead and tbody', () => {
  assert.ok(
    attendanceSource.includes('const ATTENDANCE_TABLE_COLUMNS = ['),
    'DriveAttendancePage must define ATTENDANCE_TABLE_COLUMNS'
  );
  assert.ok(
    attendanceSource.includes('const getActiveAttendanceColumns = ('),
    'DriveAttendancePage must define getActiveAttendanceColumns'
  );
  assert.ok(
    attendanceSource.includes('const activeColumns = useMemo('),
    'DriveAttendancePage must instantiate activeColumns via useMemo'
  );
  assert.ok(
    attendanceSource.includes('{activeColumns.map((col) => ('),
    'Both header and row must map over activeColumns'
  );
});

// ─── 2. Column Count in Non-Archived Mode ───────────────────────────────────
test('2. Header and body have exactly 8 matching columns in non-archived mode', () => {
  const activeCols = getActiveAttendanceColumns({ isArchived: false });
  assert.equal(activeCols.length, 8);

  const columnIds = activeCols.map((c) => c.id);
  assert.deepEqual(columnIds, [
    'select',
    'studentName',
    'rollNumber',
    'department',
    'status',
    'markedBy',
    'markedAt',
    'actions',
  ]);

  // Verify the header iterates activeColumns
  assert.ok(
    attendanceSource.includes('key={col.id}') && attendanceSource.includes('className={col.headerClassName}'),
    'Header must render <th key={col.id} className={col.headerClassName}> for each activeColumn'
  );

  // Verify the row iterates activeColumns
  assert.ok(
    attendanceSource.includes('<td key={col.id} className={col.cellClassName}>'),
    'Main row must render <td key={col.id}> for each activeColumn'
  );
});

// ─── 3. Column Count in Archived Mode ───────────────────────────────────────
test('3. Header and body have exactly 7 matching columns in archived mode (select excluded)', () => {
  const archivedCols = getActiveAttendanceColumns({ isArchived: true });
  assert.equal(archivedCols.length, 7);

  const columnIds = archivedCols.map((c) => c.id);
  assert.deepEqual(columnIds, [
    'studentName',
    'rollNumber',
    'department',
    'status',
    'markedBy',
    'markedAt',
    'actions',
  ]);

  assert.ok(
    !columnIds.includes('select'),
    'Archived table must strictly exclude the select checkbox column'
  );
});

// ─── 4. Semantic Table Elements & No Flexbox td Spanning ────────────────────
test('4. Table uses genuine <thead>, <tbody>, <tr>, <th>, <td> without colSpan flex wrapper', () => {
  // Verify native semantic elements
  assert.ok(attendanceSource.includes('<table className="w-full text-xs" role="table">'));
  assert.ok(attendanceSource.includes('<tbody className="divide-y divide-slate-100">'));
  assert.ok(attendanceSource.includes('<Fragment key={applicant.applicationId}>'));

  // Ensure the old broken pattern (<td colSpan={isArchived ? 7 : 8} className="p-0">) is completely removed
  assert.ok(
    !attendanceSource.includes('<td colSpan={isArchived ? 7 : 8} className="p-0">'),
    'The old colSpan="8" single-td body wrapper must not exist'
  );
  assert.ok(
    !attendanceSource.includes('<div className="px-4 py-3 flex-1 min-w-[140px]">'),
    'The old flex-1 student name container must not exist'
  );
});

// ─── 5. Consistent Widths & Paddings Between Header and Cells ───────────────
test('5. Corresponding header and cell columns share identical width and padding classes', () => {
  const activeCols = getActiveAttendanceColumns({ isArchived: false });

  for (const col of activeCols) {
    if (col.id === 'select') {
      assert.ok(col.headerClassName.includes('w-10') && col.cellClassName.includes('w-10'));
      assert.ok(col.headerClassName.includes('px-4') && col.cellClassName.includes('px-4'));
    } else if (col.id === 'studentName') {
      assert.ok(col.headerClassName.includes('min-w-[160px]') && col.cellClassName.includes('min-w-[160px]'));
      assert.ok(col.headerClassName.includes('px-4') && col.cellClassName.includes('px-4'));
    } else if (col.id === 'rollNumber') {
      assert.ok(col.headerClassName.includes('w-28') && col.cellClassName.includes('w-28'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    } else if (col.id === 'department') {
      assert.ok(col.headerClassName.includes('w-36') && col.cellClassName.includes('w-36'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    } else if (col.id === 'status') {
      assert.ok(col.headerClassName.includes('w-24') && col.cellClassName.includes('w-24'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    } else if (col.id === 'markedBy') {
      assert.ok(col.headerClassName.includes('w-32') && col.cellClassName.includes('w-32'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    } else if (col.id === 'markedAt') {
      assert.ok(col.headerClassName.includes('w-36') && col.cellClassName.includes('w-36'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    } else if (col.id === 'actions') {
      assert.ok(col.headerClassName.includes('w-24') && col.cellClassName.includes('w-24'));
      assert.ok(col.headerClassName.includes('px-3') && col.cellClassName.includes('px-3'));
    }
  }
});

// ─── 6. Preservation of Missing Roll Number Alignment ───────────────────────
test('6. Rows with missing rollNumber preserve column alignment and display italic N/A', () => {
  assert.ok(
    attendanceSource.includes("applicant.rollNumber || 'N/A'"),
    'Missing roll number must render N/A'
  );
  assert.ok(
    attendanceSource.includes("applicant.rollNumber ? '' : 'text-slate-400 italic'"),
    'Missing roll number must be styled with text-slate-400 italic'
  );
});

// ─── 7. Preservation of Missing Department Alignment ────────────────────────
test('7. Rows with missing department fallback cleanly without shifting cells', () => {
  assert.ok(
    attendanceSource.includes('applicant.departmentName || UNASSIGNED_LABEL'),
    'Missing department name must fall back to UNASSIGNED_LABEL'
  );
  assert.ok(
    attendanceSource.includes('title={applicant.departmentName}'),
    'Department cell must maintain tooltip title'
  );
});

// ─── 8. Preservation of Missing Marked By and Marked At Fallbacks ───────────
test('8. Missing markedBy and markedAt display em-dash fallback without shifting cells', () => {
  assert.ok(
    attendanceSource.includes("applicant.markedByName || '—'"),
    'Missing markedBy must display em-dash'
  );
  assert.ok(
    attendanceSource.includes("applicant.markedAt ? formatDateTime(applicant.markedAt) : '—'"),
    'Missing markedAt must display em-dash'
  );
});

// ─── 9. Expandable Attendance History as Independent Secondary Row ─────────
test('9. Expanded history renders as an independent <tr> with colSpan matching activeColumns.length', () => {
  assert.ok(
    attendanceSource.includes('{/* Expandable Attendance History (Secondary <tr>) */}'),
    'History comment marker must be present'
  );
  assert.ok(
    attendanceSource.includes('<td colSpan={activeColumns.length} className="px-4 pb-3 pt-1">'),
    'History row must use colSpan={activeColumns.length} to span exactly across active columns'
  );
  assert.ok(
    attendanceSource.includes('Attendance Audit Chain'),
    'Attendance Audit Chain heading must be preserved'
  );
  assert.ok(
    attendanceSource.includes('toggleHistory(applicant.applicationId)'),
    'Toggle history button action must be preserved'
  );
});

// ─── 10. Checkbox & Selection Integrity ─────────────────────────────────────
test('10. Checkbox retains selection binding, marking disable guard, and aria-label', () => {
  assert.ok(
    attendanceSource.includes('checked={isSelected}'),
    'Checkbox must bind checked to isSelected'
  );
  assert.ok(
    attendanceSource.includes('onChange={() => toggleSelection(applicant.applicationId)}'),
    'Checkbox must invoke toggleSelection on change'
  );
  assert.ok(
    attendanceSource.includes('disabled={isMarking}'),
    'Checkbox must be disabled during isMarking'
  );
  assert.ok(
    attendanceSource.includes('aria-label={`Select ${applicant.studentName}`}'),
    'Checkbox must have accessible aria-label'
  );
});

// ─── 11. Individual Attendance Action Buttons Intact ────────────────────────
test('11. Mark Present and Mark Absent individual buttons remain intact', () => {
  assert.ok(
    attendanceSource.includes("handleIndividualMark(applicant.applicationId, 'Present')"),
    'Mark Present button must call handleIndividualMark with Present'
  );
  assert.ok(
    attendanceSource.includes("handleIndividualMark(applicant.applicationId, 'Absent')"),
    'Mark Absent button must call handleIndividualMark with Absent'
  );
  assert.ok(
    attendanceSource.includes('aria-label={`Mark ${applicant.studentName} as Present`}'),
    'Present button must have accessible aria-label'
  );
  assert.ok(
    attendanceSource.includes('aria-label={`Mark ${applicant.studentName} as Absent`}'),
    'Absent button must have accessible aria-label'
  );
});

// ─── 12. Overflow Wrapper for Narrow Viewports ──────────────────────────────
test('12. Roster table is wrapped in overflow-x-auto to prevent mobile and narrow layout drift', () => {
  assert.ok(
    attendanceSource.includes('<div className="overflow-x-auto">'),
    'Table must be wrapped in overflow-x-auto container'
  );
});
