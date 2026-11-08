/**
 * Utility functions for exporting Placement Drive Attendance data
 * Supports RFC 4180 CSV export with UTF-8 BOM, and TSV copy for Excel/Sheets.
 */

/**
 * Escapes a cell value for RFC 4180 CSV format.
 * Wraps in quotes and escapes double quotes if string contains comma, quote, or newline.
 */
const escapeCsvCell = (val) => {
  if (val == null) return '""';
  const str = String(val).trim();
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

/**
 * Clean string for filenames.
 */
const sanitizeFilenamePart = (str) => {
  if (!str) return 'report';
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

/**
 * Format date for export rows.
 */
const formatExportDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Generates and triggers download of a CSV file for applicants.
 * 
 * @param {Array} applicants List of applicant objects
 * @param {Object} driveInfo Drive metadata (company, jobRole, driveDate)
 * @param {string} departmentName Name of department or 'All_Departments'
 */
export const downloadAttendanceCsv = (applicants = [], driveInfo = {}, departmentName = 'All') => {
  const headers = [
    'Student Name',
    'Roll Number',
    'Department',
    'Attendance Status',
    'Marked By',
    'Marked At',
    'Latest Change',
  ];

  const rows = applicants.map((app) => [
    escapeCsvCell(app.studentName),
    escapeCsvCell(app.rollNumber || 'N/A'),
    escapeCsvCell(app.departmentName),
    escapeCsvCell(app.status),
    escapeCsvCell(app.markedByName || '—'),
    escapeCsvCell(formatExportDate(app.markedAt)),
    escapeCsvCell(app.latestChange || '—'),
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  // Prepend UTF-8 BOM (\uFEFF) so Excel respects UTF-8 encodings
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const comp = sanitizeFilenamePart(driveInfo.company || 'Drive');
  const dept = sanitizeFilenamePart(departmentName);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Attendance_${comp}_${dept}_${dateStr}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Copies the current applicants roster to clipboard formatted as TSV
 * (Tab-Separated Values) for direct pasting into Excel or Google Sheets.
 * 
 * @param {Array} applicants List of applicant objects
 * @returns {Promise<boolean>} Success status
 */
export const copyAttendanceAsTsv = async (applicants = []) => {
  const headers = [
    'Student Name',
    'Roll Number',
    'Department',
    'Attendance Status',
    'Marked By',
    'Marked At',
  ];

  const rows = applicants.map((app) => [
    app.studentName || 'Unknown',
    app.rollNumber || 'N/A',
    app.departmentName || '—',
    app.status || 'Pending',
    app.markedByName || '—',
    formatExportDate(app.markedAt),
  ]);

  const tsvContent = [
    headers.join('\t'),
    ...rows.map((r) => r.join('\t')),
  ].join('\n');

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(tsvContent);
    return true;
  }

  // Fallback
  const textarea = document.createElement('textarea');
  textarea.value = tsvContent;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);
  return successful;
};
