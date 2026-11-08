import { useRef } from 'react';
import { X, Printer, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react';

const AttendancePrintModal = ({
  isOpen,
  onClose,
  driveInfo = {},
  driveDate,
  departmentName = 'All Departments',
  summary = { total: 0, present: 0, absent: 0, pending: 0 },
  applicants = [],
  officerName = 'Placement Officer',
}) => {
  const printAreaRef = useRef(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDriveDate = driveDate
    ? new Date(driveDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  const generatedDate = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const attendanceRate =
    summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold">Print Attendance Report</h2>
            <span className="text-xs text-slate-400">| Preview mode</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close print preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div
          ref={printAreaRef}
          className="p-8 overflow-y-auto print:p-0 print:overflow-visible space-y-6 text-slate-900 bg-white"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                  Campus Placement Drive Attendance Roster
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Official Recruitment Record • College Placement Management System
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Date: {new Date().toLocaleDateString('en-US')}</div>
                <div>Status: Official</div>
              </div>
            </div>

            {/* Drive Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Company</span>
                <span className="font-bold text-slate-900 text-sm">{driveInfo.company || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Job Role</span>
                <span className="font-semibold text-slate-800 text-sm">{driveInfo.jobRole || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Drive Date</span>
                <span className="font-semibold text-slate-800">{formattedDriveDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Scope</span>
                <span className="font-semibold text-emerald-800">{departmentName}</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-300 text-center">
            <div>
              <div className="text-lg font-extrabold text-slate-900">{summary.total}</div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Total Registered</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-emerald-700">{summary.present}</div>
              <div className="text-[10px] uppercase font-bold text-emerald-600">Present</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-rose-700">{summary.absent}</div>
              <div className="text-[10px] uppercase font-bold text-rose-600">Absent</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-amber-700">{summary.pending}</div>
              <div className="text-[10px] uppercase font-bold text-amber-600">Pending</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-blue-700">{attendanceRate}%</div>
              <div className="text-[10px] uppercase font-bold text-blue-600">Turnout Rate</div>
            </div>
          </div>

          {/* Roster Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Applicant Attendance List ({applicants.length})
            </h3>
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left text-[11px] font-bold text-slate-700 uppercase">
                  <th className="border border-slate-300 px-3 py-2 w-10 text-center">#</th>
                  <th className="border border-slate-300 px-3 py-2">Student Name</th>
                  <th className="border border-slate-300 px-3 py-2 w-28">Roll Number</th>
                  <th className="border border-slate-300 px-3 py-2 w-36">Department</th>
                  <th className="border border-slate-300 px-3 py-2 w-24 text-center">Status</th>
                  <th className="border border-slate-300 px-3 py-2 w-32">Marked By</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((app, idx) => (
                  <tr key={app.applicationId || idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="border border-slate-300 px-3 py-1.5 text-center text-slate-500 font-mono text-[10px]">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 px-3 py-1.5 font-semibold text-slate-900">
                      {app.studentName}
                    </td>
                    <td className="border border-slate-300 px-3 py-1.5 font-mono text-slate-700">
                      {app.rollNumber || 'N/A'}
                    </td>
                    <td className="border border-slate-300 px-3 py-1.5 text-slate-700">
                      {app.departmentName}
                    </td>
                    <td className="border border-slate-300 px-3 py-1.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          app.status === 'Present'
                            ? 'text-emerald-800 font-extrabold'
                            : app.status === 'Absent'
                            ? 'text-rose-800 font-extrabold'
                            : 'text-amber-800'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="border border-slate-300 px-3 py-1.5 text-slate-600 text-[11px]">
                      {app.markedByName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures & Footer */}
          <div className="pt-8 mt-6 border-t-2 border-slate-300 text-xs">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <div className="h-14 border-b border-dashed border-slate-400" />
                <div className="mt-2 font-bold text-slate-800">Placement Officer Signature</div>
                <div className="text-[11px] text-slate-500">
                  Officer: {officerName} • Verified Record
                </div>
              </div>
              <div>
                <div className="h-14 border-b border-dashed border-slate-400" />
                <div className="mt-2 font-bold text-slate-800">Department HOD Signature</div>
                <div className="text-[11px] text-slate-500">
                  Department: {departmentName} • Acknowledged
                </div>
              </div>
            </div>
            <div className="mt-8 text-[10px] text-slate-400 text-center">
              Generated on {generatedDate} • CPMS Autonomous Placement Operations Platform
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePrintModal;
