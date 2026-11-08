import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { officerService } from '../../services/officerService';
import DepartmentManagementSection from '../../components/officer/DepartmentManagementSection';
import HodShareModal from '../../components/officer/HodShareModal';
import AttendancePrintModal from '../../components/officer/AttendancePrintModal';
import { downloadAttendanceCsv, copyAttendanceAsTsv } from '../../utils/attendanceExport';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock,
  History,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  XCircle,
  Square,
  MinusSquare,
  Tag,
  User,
  LogOut,
  Info,
  Share2,
  Download,
  Printer,
  Copy,
  Search,
  Filter,
  ChevronDown,
  FileSpreadsheet,
} from 'lucide-react';

/** Backend batch entry cap — must match server MAX_BATCH_ENTRIES */
const MAX_BATCH_ENTRIES = 200;

const UNASSIGNED_LABEL = 'Unassigned / Other';

const STATUS_BADGE_CLASSES = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Absent: 'bg-rose-50 text-rose-700 border-rose-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const LIFECYCLE_BADGE = {
  active: { label: '● Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: '✕ Registration Closed', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  archived: { label: '📦 Archived', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/**
 * Standard date formatter matching project conventions.
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DriveAttendancePage = () => {
  const { id: driveId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Core attendance data
  const [driveInfo, setDriveInfo] = useState(null);
  const [summary, setSummary] = useState({ totalApplicants: 0, present: 0, absent: 0, pending: 0 });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // College departments (for HOD contacts and aliases)
  const [collegeDepartments, setCollegeDepartments] = useState([]);

  // Drive context (from navigation state or fallback fetch)
  const [driveContext, setDriveContext] = useState(null);

  // Department Tab
  const [activeTab, setActiveTab] = useState('__ALL__');

  // Search & Filter within roster
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selection: Map<applicationId, true>
  const [selection, setSelection] = useState(new Map());

  // Marking state
  const [isMarking, setIsMarking] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error'|'info', message }

  // History expansion: Set<applicationId>
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [historyLoading, setHistoryLoading] = useState(new Set());

  // Inline department management panel
  const [showDeptPanel, setShowDeptPanel] = useState(null); // 'hod' | 'aliases' | null

  // Modals & Popovers
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Track if drive is archived (read-only)
  const isArchived = driveInfo?.isArchived || driveInfo?.status === 'archived';

  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((type, message, duration = 5000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, message });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Fetch College Departments (for HOD contacts) ----
  const loadCollegeDepartments = useCallback(async () => {
    try {
      const res = await officerService.getDepartments();
      if (res.success && Array.isArray(res.departments)) {
        setCollegeDepartments(res.departments);
      }
    } catch {
      // Non-blocking: will fallback to unconfigured state
    }
  }, []);

  useEffect(() => {
    loadCollegeDepartments();
  }, [loadCollegeDepartments]);

  // ---- Fetch Drive Attendance Data ----
  const fetchAttendance = useCallback(
    async (opts = {}) => {
      try {
        if (!opts.silent) setLoading(true);
        setFetchError('');
        const data = await officerService.getDriveAttendance(driveId);
        if (data.success) {
          setDriveInfo(data.drive);
          setSummary(data.summary);
          setDepartments(data.departments || []);
        } else {
          setFetchError(data.message || 'Failed to load attendance data.');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setFetchError('Placement drive not found or you do not have access.');
        } else {
          setFetchError(err.response?.data?.message || 'Server error loading attendance.');
        }
      } finally {
        setLoading(false);
      }
    },
    [driveId]
  );

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Read drive context from navigation state, or fallback fetch
  useEffect(() => {
    try {
      const state = window.history.state?.usr;
      if (state?.drive) {
        setDriveContext(state.drive);
        return;
      }
    } catch {
      // Ignore
    }

    // Fallback: fetch drive list to find matching drive date
    officerService
      .getDrives()
      .then((res) => {
        if (res.success && Array.isArray(res.drives)) {
          const match = res.drives.find((d) => d._id === driveId);
          if (match) setDriveContext(match);
        }
      })
      .catch(() => {});
  }, [driveId]);

  // Clear selection on tab switch
  useEffect(() => {
    setSelection(new Map());
  }, [activeTab]);

  // ---- Computed: current tab's applicants ----
  const currentApplicants = useMemo(() => {
    if (activeTab === '__ALL__') {
      return departments.flatMap((d) => d.applicants || []);
    }
    const dept = departments.find((d) => d.departmentName === activeTab);
    return dept?.applicants || [];
  }, [departments, activeTab]);

  const currentTabTotals = useMemo(() => {
    if (activeTab === '__ALL__') return summary;
    const dept = departments.find((d) => d.departmentName === activeTab);
    return dept?.totals || { total: 0, present: 0, absent: 0, pending: 0 };
  }, [departments, activeTab, summary]);

  // Filtered applicants based on search and status filter
  const filteredApplicants = useMemo(() => {
    let result = currentApplicants;

    if (statusFilter !== 'ALL') {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.studentName?.toLowerCase().includes(term) ||
          a.rollNumber?.toLowerCase().includes(term) ||
          a.departmentName?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [currentApplicants, searchTerm, statusFilter]);

  // ---- Selection helpers ----
  const toggleSelection = useCallback((appId) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.set(appId, true);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const next = new Map();
    filteredApplicants.forEach((a) => next.set(a.applicationId, true));
    setSelection(next);
  }, [filteredApplicants]);

  const clearSelection = useCallback(() => {
    setSelection(new Map());
  }, []);

  const selectedCount = selection.size;
  const allSelected =
    filteredApplicants.length > 0 && selectedCount === filteredApplicants.length;
  const someSelected = selectedCount > 0 && !allSelected;

  // ---- Bulk/Individual marking ----
  const handleMark = useCallback(
    async (targetStatus, applicationIds) => {
      if (isArchived || isMarking) return;

      const entries = applicationIds.map((id) => ({ applicationId: id, status: targetStatus }));
      if (entries.length === 0) return;

      setIsMarking(true);

      try {
        // Chunk requests into MAX_BATCH_ENTRIES (200)
        const chunks = [];
        for (let i = 0; i < entries.length; i += MAX_BATCH_ENTRIES) {
          chunks.push(entries.slice(i, i + MAX_BATCH_ENTRIES));
        }

        const allResults = [];
        let failed = false;

        for (let ci = 0; ci < chunks.length; ci++) {
          try {
            const res = await officerService.markDriveAttendance(driveId, chunks[ci]);
            if (res.success && Array.isArray(res.results)) {
              allResults.push(...res.results);
              const conflicts = res.results.filter((r) => r.result === 'conflict');
              if (conflicts.length > 0) {
                await fetchAttendance({ silent: true });
              }
            } else {
              allResults.push(
                ...chunks[ci].map((e) => ({
                  applicationId: e.applicationId,
                  result: 'error',
                  status: e.status,
                }))
              );
              failed = true;
              break;
            }
          } catch (chunkErr) {
            if (
              chunkErr.response?.status === 409 &&
              chunkErr.response?.data?.code === 'DRIVE_ARCHIVED'
            ) {
              showToast('error', 'This drive is archived. Attendance marking is disabled.');
              await fetchAttendance({ silent: true });
              setIsMarking(false);
              return;
            }

            allResults.push(
              ...chunks[ci].map((e) => ({
                applicationId: e.applicationId,
                result: 'error',
                status: e.status,
                message: chunkErr.response?.data?.message || 'Request failed',
              }))
            );
            failed = true;
            break;
          }
        }

        // Build summary toast
        const counts = {};
        allResults.forEach((r) => {
          counts[r.result] = (counts[r.result] || 0) + 1;
        });

        const parts = [];
        if (counts.created) parts.push(`${counts.created} marked`);
        if (counts.changed) parts.push(`${counts.changed} updated`);
        if (counts.unchanged) parts.push(`${counts.unchanged} already set`);
        if (counts.noop) parts.push(`${counts.noop} no change`);
        if (counts.conflict) parts.push(`${counts.conflict} conflict(s)`);
        if (counts.error) parts.push(`${counts.error} failed`);

        const type = counts.conflict || counts.error ? 'error' : 'success';
        showToast(type, parts.join(', ') + '.');

        // Refresh data
        await fetchAttendance({ silent: true });

        if (!failed) {
          setSelection(new Map());
        }
      } catch (err) {
        showToast('error', err.response?.data?.message || 'Marking failed.');
      } finally {
        setIsMarking(false);
      }
    },
    [driveId, isArchived, isMarking, fetchAttendance, showToast]
  );

  const handleBulkMark = useCallback(
    (status) => {
      const ids = [...selection.keys()];
      if (ids.length === 0) return;
      handleMark(status, ids);
    },
    [selection, handleMark]
  );

  const handleIndividualMark = useCallback(
    (applicationId, status) => {
      handleMark(status, [applicationId]);
    },
    [handleMark]
  );

  // ---- History expansion ----
  const toggleHistory = useCallback(
    async (applicationId) => {
      if (expandedHistory.has(applicationId)) {
        setExpandedHistory((prev) => {
          const next = new Set(prev);
          next.delete(applicationId);
          return next;
        });
        return;
      }

      // Check if history already loaded
      const hasHistory = departments.some((d) =>
        d.applicants?.some((a) => a.applicationId === applicationId && Array.isArray(a.history))
      );

      if (!hasHistory) {
        setHistoryLoading((prev) => new Set(prev).add(applicationId));
        try {
          const data = await officerService.getDriveAttendance(driveId, { includeHistory: true });
          if (data.success) {
            setDepartments(data.departments || []);
          }
        } catch {
          showToast('error', 'Failed to load attendance history.');
        } finally {
          setHistoryLoading((prev) => {
            const next = new Set(prev);
            next.delete(applicationId);
            return next;
          });
        }
      }

      setExpandedHistory((prev) => new Set(prev).add(applicationId));
    },
    [driveId, departments, expandedHistory, showToast]
  );

  // ---- Export Handlers ----
  const handleExportCsv = (allDepartments = false) => {
    setShowExportMenu(false);
    const targetApps = allDepartments
      ? departments.flatMap((d) => d.applicants || [])
      : currentApplicants;
    const targetDeptName = allDepartments ? 'All_Departments' : activeTab;
    downloadAttendanceCsv(targetApps, driveInfo, targetDeptName);
    showToast('success', `Exported CSV for ${targetDeptName.replace(/_/g, ' ')}.`);
  };

  const handleCopyTable = async () => {
    setShowExportMenu(false);
    const ok = await copyAttendanceAsTsv(filteredApplicants);
    if (ok) {
      showToast('success', 'Roster table copied. Ready to paste in Excel or Google Sheets.');
    } else {
      showToast('error', 'Failed to copy roster table.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/placement-officer/login');
  };

  // ---- Render helpers ----
  const driveDate = driveContext?.driveDate || driveInfo?.driveDate;
  const lifecycleStatus = driveInfo?.status || 'active';
  const lifecycleBadge = LIFECYCLE_BADGE[lifecycleStatus] || LIFECYCLE_BADGE.active;

  // Department tabs
  const tabs = useMemo(() => {
    const result = [{ key: '__ALL__', label: 'All Departments', totals: summary }];
    departments.forEach((dept) => {
      if (dept.departmentName === UNASSIGNED_LABEL && dept.totals.total === 0) return;
      result.push({
        key: dept.departmentName,
        label: dept.departmentName,
        totals: dept.totals,
        departmentId: dept.departmentId,
      });
    });
    return result;
  }, [departments, summary]);

  // Loading State
  if (loading && !driveInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading attendance data…</p>
        </div>
      </div>
    );
  }

  // Error State
  if (fetchError && !driveInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Unable to Load Attendance</h2>
          <p className="text-sm text-slate-600 mb-4">{fetchError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/officer/dashboard')}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => fetchAttendance()}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/officer/dashboard')}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm leading-tight block">
                    Drive Attendance
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">
                    CPMS Officer Portal
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-slate-800">
                  {user?.name || 'Officer'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-200"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`p-3 rounded-xl text-sm flex items-center justify-between shadow-xs ${
              toast.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <span className="font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-semibold ml-4 shrink-0 cursor-pointer opacity-60 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Archived Notice */}
        {isArchived && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">Archived Drive — Read Only.</span>{' '}
              <span className="text-xs">
                Attendance roster and audit history are viewable. Marking is disabled.
              </span>
            </div>
          </div>
        )}

        {/* Drive Header & Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {driveInfo?.company || 'Company'}
                </h1>
                <span className="text-slate-300">•</span>
                <span className="text-base font-semibold text-slate-700">
                  {driveInfo?.jobRole || 'Job Role'}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${lifecycleBadge.cls}`}
                >
                  {lifecycleBadge.label}
                </span>
              </div>

              {driveDate && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium">Drive Date: {formatDate(driveDate)}</span>
                </div>
              )}
            </div>

            {/* Summary Counters & Primary Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Metrics Box */}
              <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                <div className="text-center">
                  <div className="text-lg font-extrabold text-slate-900">
                    {summary.totalApplicants}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Total</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{summary.present}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase">Present</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-lg font-extrabold text-rose-700">{summary.absent}</div>
                  <div className="text-[10px] text-rose-600 font-semibold uppercase">Absent</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-lg font-extrabold text-amber-700">{summary.pending}</div>
                  <div className="text-[10px] text-amber-600 font-semibold uppercase">Pending</div>
                </div>
              </div>

              {/* Action Buttons: Share with HOD, Export Menu, Print, Refresh */}
              <div className="flex items-center gap-2">
                {/* Share with HOD Button */}
                <button
                  onClick={() => setShowShareModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition cursor-pointer"
                  title="Share attendance report with Department HOD"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share with HOD</span>
                </button>

                {/* Export Dropdown */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
                    aria-expanded={showExportMenu}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-xs">
                      <button
                        onClick={() => handleExportCsv(false)}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Export CSV ({activeTab === '__ALL__' ? 'All' : activeTab})</span>
                      </button>
                      <button
                        onClick={() => handleExportCsv(true)}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                        <span>Export All Departments CSV</span>
                      </button>
                      <button
                        onClick={handleCopyTable}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer border-t border-slate-100"
                      >
                        <Copy className="w-4 h-4 text-blue-600" />
                        <span>Copy Table (Excel / Sheets)</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          setShowPrintModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-purple-600" />
                        <span>Print Attendance Sheet / PDF</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Print Quick Button */}
                <button
                  onClick={() => setShowPrintModal(true)}
                  title="Print Attendance Report / Save as PDF"
                  className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-xl transition shadow-2xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {/* Refresh Button */}
                <button
                  onClick={() => fetchAttendance()}
                  disabled={loading}
                  title="Refresh attendance"
                  className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Quick links to department management */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
            <button
              onClick={() => setShowDeptPanel(showDeptPanel === 'hod' ? null : 'hod')}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer hover:underline"
            >
              <User className="w-3.5 h-3.5" />
              HOD Contact Settings
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setShowDeptPanel(showDeptPanel === 'aliases' ? null : 'aliases')}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer hover:underline"
            >
              <Tag className="w-3.5 h-3.5" />
              Manage Department Names & Aliases
            </button>
          </div>
        </div>

        {/* Department Management Panel (expanded inline) */}
        {showDeptPanel && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {showDeptPanel === 'hod' ? 'HOD Contact Settings' : 'Department Name Management'}
              </h2>
              <button
                onClick={() => {
                  setShowDeptPanel(null);
                  loadCollegeDepartments();
                }}
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
            <DepartmentManagementSection />
          </div>
        )}

        {/* Department Tabs & Roster Area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          {/* Tabs bar */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                aria-selected={activeTab === tab.key}
                role="tab"
              >
                {tab.key === '__ALL__' ? (
                  <Users className="w-3.5 h-3.5" />
                ) : tab.key === UNASSIGNED_LABEL ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Building2 className="w-3.5 h-3.5" />
                )}
                <span>{tab.label}</span>
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.key
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.totals.total}
                </span>
              </button>
            ))}
          </div>

          {/* Unassigned tab notice */}
          {activeTab === UNASSIGNED_LABEL && (
            <div className="mx-4 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Unassigned students</span> could not be matched to
                a department. Their profile text did not match any department name, code, or
                alias.{' '}
                <button
                  onClick={() => setShowDeptPanel('aliases')}
                  className="text-amber-900 font-semibold underline cursor-pointer hover:text-amber-700"
                >
                  Manage department aliases
                </button>{' '}
                to resolve them.
              </div>
            </div>
          )}

          {/* Filter Bar & Bulk Actions */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            {/* Search and Status Filter */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by name, roll, dept…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Present">Present Only</option>
                  <option value="Absent">Absent Only</option>
                  <option value="Pending">Pending Only</option>
                </select>
              </div>

              {(searchTerm || statusFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Bulk Selection Actions (only if not archived) */}
            {!isArchived && filteredApplicants.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={allSelected ? clearSelection : selectAll}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  disabled={isMarking}
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : someSelected ? (
                    <MinusSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                </button>

                {selectedCount > 0 && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-300">
                    <span className="text-xs text-slate-600 font-semibold">
                      {selectedCount} selected:
                    </span>
                    <button
                      onClick={() => handleBulkMark('Present')}
                      disabled={isMarking}
                      className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {isMarking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                      ) : (
                        'Present'
                      )}
                    </button>
                    <button
                      onClick={() => handleBulkMark('Absent')}
                      disabled={isMarking}
                      className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      Absent
                    </button>
                    <button
                      onClick={() => handleBulkMark('Pending')}
                      disabled={isMarking}
                      className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      Pending
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            {filteredApplicants.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium">
                  {searchTerm || statusFilter !== 'ALL'
                    ? 'No applicants match the filter criteria.'
                    : 'No applicants in this department group.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-xs" role="table">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    {!isArchived && <th className="px-4 py-2.5 w-10" />}
                    <th className="px-4 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">Roll Number</th>
                    <th className="px-3 py-2.5">Department</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Marked By</th>
                    <th className="px-3 py-2.5">Marked At</th>
                    <th className="px-3 py-2.5 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApplicants.map((applicant) => {
                    const isSelected = selection.has(applicant.applicationId);
                    const isHistoryExpanded = expandedHistory.has(applicant.applicationId);
                    const isHistoryLoadingItem = historyLoading.has(applicant.applicationId);
                    const statusBadge =
                      STATUS_BADGE_CLASSES[applicant.status] || STATUS_BADGE_CLASSES.Pending;

                    return (
                      <tr key={applicant.applicationId} className="group">
                        <td colSpan={isArchived ? 7 : 8} className="p-0">
                          <div
                            className={`flex flex-col ${
                              isSelected ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'
                            } transition`}
                          >
                            {/* Main row */}
                            <div className="flex items-center">
                              {/* Checkbox */}
                              {!isArchived && (
                                <div className="px-4 py-3 w-10 shrink-0">
                                  <label className="cursor-pointer flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelection(applicant.applicationId)}
                                      disabled={isMarking}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
                                      aria-label={`Select ${applicant.studentName}`}
                                    />
                                  </label>
                                </div>
                              )}

                              {/* Name */}
                              <div className="px-4 py-3 flex-1 min-w-[140px]">
                                <span className="font-semibold text-slate-900">
                                  {applicant.studentName}
                                </span>
                              </div>

                              {/* Roll */}
                              <div className="px-3 py-3 w-28">
                                <span
                                  className={`font-mono text-slate-700 ${
                                    applicant.rollNumber ? '' : 'text-slate-400 italic'
                                  }`}
                                >
                                  {applicant.rollNumber || 'N/A'}
                                </span>
                              </div>

                              {/* Department */}
                              <div className="px-3 py-3 w-36">
                                <span className="text-slate-700 truncate block">
                                  {applicant.departmentName}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <div className="px-3 py-3 w-24">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge}`}
                                >
                                  {applicant.status}
                                </span>
                              </div>

                              {/* Marked By */}
                              <div className="px-3 py-3 w-32">
                                <span className="text-slate-600 truncate block">
                                  {applicant.markedByName || '—'}
                                </span>
                              </div>

                              {/* Marked At */}
                              <div className="px-3 py-3 w-36">
                                <span className="text-slate-500">
                                  {applicant.markedAt ? formatDateTime(applicant.markedAt) : '—'}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="px-3 py-3 w-24 flex items-center gap-1">
                                {!isArchived && (
                                  <>
                                    {applicant.status !== 'Present' && (
                                      <button
                                        onClick={() =>
                                          handleIndividualMark(applicant.applicationId, 'Present')
                                        }
                                        disabled={isMarking}
                                        title="Mark Present"
                                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition cursor-pointer disabled:opacity-30"
                                        aria-label={`Mark ${applicant.studentName} as Present`}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    )}
                                    {applicant.status !== 'Absent' && (
                                      <button
                                        onClick={() =>
                                          handleIndividualMark(applicant.applicationId, 'Absent')
                                        }
                                        disabled={isMarking}
                                        title="Mark Absent"
                                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-30"
                                        aria-label={`Mark ${applicant.studentName} as Absent`}
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  onClick={() => toggleHistory(applicant.applicationId)}
                                  title={isHistoryExpanded ? 'Hide history' : 'Show history'}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                  aria-label={`${
                                    isHistoryExpanded ? 'Hide' : 'Show'
                                  } history for ${applicant.studentName}`}
                                >
                                  {isHistoryLoadingItem ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <History className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expanded History */}
                            {isHistoryExpanded && (
                              <div className="px-4 pb-3 ml-10">
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Attendance Audit Chain
                                  </h4>
                                  {Array.isArray(applicant.history) &&
                                  applicant.history.length > 0 ? (
                                    <div className="space-y-2">
                                      {applicant.history.map((h, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-start gap-2 text-xs text-slate-600"
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                          <div>
                                            <span className="font-semibold text-slate-800">
                                              {h.oldStatus} → {h.newStatus}
                                            </span>
                                            <span className="text-slate-400 mx-1.5">·</span>
                                            <span>
                                              Recorded by {h.changedByName || 'Officer'} on behalf of{' '}
                                              {h.onBehalfOf || 'HOD'}
                                            </span>
                                            {h.note && (
                                              <span className="text-slate-500 ml-1">
                                                — {h.note}
                                              </span>
                                            )}
                                            <span className="text-slate-400 ml-1.5 text-[10px]">
                                              {formatDateTime(h.changedAt)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">
                                      No changes recorded yet. (Initial status: Pending)
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 rounded-b-2xl">
            <span>
              Showing {filteredApplicants.length} of {currentApplicants.length} applicant
              {currentApplicants.length === 1 ? '' : 's'}
              {activeTab !== '__ALL__' && ` in ${activeTab}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-700 font-semibold">
                {currentTabTotals.present} present
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-700 font-semibold">
                {currentTabTotals.absent} absent
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-700 font-semibold">
                {currentTabTotals.pending} pending
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* HOD Share Modal */}
      <HodShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        departments={departments}
        initialDepartment={activeTab}
        collegeDepartments={collegeDepartments}
        driveInfo={driveInfo || {}}
        driveDate={driveDate}
        officerName={user?.name || 'Placement Officer'}
        onOpenHodSettings={() => setShowDeptPanel('hod')}
        onNotify={showToast}
      />

      {/* Attendance Print Modal */}
      <AttendancePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        driveInfo={driveInfo || {}}
        driveDate={driveDate}
        departmentName={activeTab === '__ALL__' ? 'All Departments' : activeTab}
        summary={currentTabTotals}
        applicants={currentApplicants}
        officerName={user?.name || 'Placement Officer'}
      />
    </div>
  );
};

export default DriveAttendancePage;
