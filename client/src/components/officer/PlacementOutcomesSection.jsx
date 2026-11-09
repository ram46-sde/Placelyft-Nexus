import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  Briefcase,
  GraduationCap,
  Calendar,
  Clock,
  Layers,
  Archive,
  Info,
  History,
  RotateCcw,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import { formatCtc } from '../../utils/placementMetrics';
import VerifyOutcomeModal from './VerifyOutcomeModal';
import RevokeOutcomeModal from './RevokeOutcomeModal';
import OutcomeHistoryModal from './OutcomeHistoryModal';

/**
 * CPMS Phase 4D - Placement Outcomes Section
 * Manages the Needs Verification queue (Stage B) and confirmed Verified outcomes (Stage C).
 */
const PlacementOutcomesSection = ({
  subView = 'queue',
  onSubViewChange,
  drives = [],
  onOutcomeActionComplete,
}) => {
  // Current active sub-view: 'queue' | 'verified'
  const activeSubView = subView;

  // Queue state (Stage B)
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [queuePagination, setQueuePagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [queueDriveFilter, setQueueDriveFilter] = useState('');

  // Verified outcomes state (Stage C)
  const [verifiedList, setVerifiedList] = useState([]);
  const [verifiedLoading, setVerifiedLoading] = useState(true);
  const [verifiedError, setVerifiedError] = useState('');
  const [verifiedPage, setVerifiedPage] = useState(1);
  const [verifiedPagination, setVerifiedPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [verifiedDriveFilter, setVerifiedDriveFilter] = useState('');
  const [verifiedDepartmentFilter, setVerifiedDepartmentFilter] = useState('');

  // College departments for filter dropdown
  const [departments, setDepartments] = useState([]);

  // Toast / notification feedback state
  const [actionFeedback, setActionFeedback] = useState(null); // { kind, message }

  // Modal dialog states
  const [selectedItemForVerify, setSelectedItemForVerify] = useState(null);
  const [selectedItemForRevoke, setSelectedItemForRevoke] = useState(null);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);

  // Request ID refs to ignore stale responses and handle unmounts safely
  const queueRequestIdRef = useRef(0);
  const verifiedRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  // Fetch queue items from server
  const fetchQueue = useCallback(async () => {
    const requestId = ++queueRequestIdRef.current;
    setQueueLoading(true);
    setQueueError('');

    try {
      const data = await officerService.getOutcomesQueue({
        page: queuePage,
        limit: 20,
        driveId: queueDriveFilter || undefined,
      });

      if (requestId === queueRequestIdRef.current && isMountedRef.current) {
        if (data.success) {
          setQueue(data.queue || []);
          setQueuePagination(data.pagination || { page: queuePage, limit: 20, total: 0, totalPages: 1 });
        } else {
          setQueueError(data.message || 'Failed to load verification queue.');
        }
      }
    } catch (err) {
      if (requestId === queueRequestIdRef.current && isMountedRef.current) {
        setQueueError(err.response?.data?.message || 'Server error loading verification queue. Please retry.');
      }
    } finally {
      if (requestId === queueRequestIdRef.current && isMountedRef.current) {
        setQueueLoading(false);
      }
    }
  }, [queuePage, queueDriveFilter]);

  // Fetch verified outcomes from server
  const fetchVerifiedOutcomes = useCallback(async () => {
    const requestId = ++verifiedRequestIdRef.current;
    setVerifiedLoading(true);
    setVerifiedError('');

    try {
      const data = await officerService.getVerifiedOutcomes({
        page: verifiedPage,
        limit: 20,
        driveId: verifiedDriveFilter || undefined,
        department: verifiedDepartmentFilter || undefined,
      });

      if (requestId === verifiedRequestIdRef.current && isMountedRef.current) {
        if (data.success) {
          setVerifiedList(data.outcomes || []);
          setVerifiedPagination(data.pagination || { page: verifiedPage, limit: 20, total: 0, totalPages: 1 });
        } else {
          setVerifiedError(data.message || 'Failed to load verified outcomes.');
        }
      }
    } catch (err) {
      if (requestId === verifiedRequestIdRef.current && isMountedRef.current) {
        setVerifiedError(err.response?.data?.message || 'Server error loading verified outcomes. Please retry.');
      }
    } finally {
      if (requestId === verifiedRequestIdRef.current && isMountedRef.current) {
        setVerifiedLoading(false);
      }
    }
  }, [verifiedPage, verifiedDriveFilter, verifiedDepartmentFilter]);

  // Load college departments for filter dropdown
  useEffect(() => {
    let active = true;
    officerService
      .getDepartments()
      .then((res) => {
        if (!active) return;
        const list = res?.departments || res?.data || (Array.isArray(res) ? res : []);
        setDepartments(list);
      })
      .catch(() => {
        // Non-blocking fallback; user can still use All Departments
      });

    return () => {
      active = false;
    };
  }, []);

  // Data fetching lifecycle based on active sub-view
  useEffect(() => {
    isMountedRef.current = true;
    if (activeSubView === 'queue') {
      fetchQueue();
    } else if (activeSubView === 'verified') {
      fetchVerifiedOutcomes();
    }

    return () => {
      queueRequestIdRef.current += 1;
      verifiedRequestIdRef.current += 1;
    };
  }, [fetchQueue, fetchVerifiedOutcomes, activeSubView]);

  // Clear feedback toast after 5s
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Handler on successful outcome verification
  const handleVerifySuccess = ({ kind, message }) => {
    setActionFeedback({ kind, message });
    fetchQueue();
    fetchVerifiedOutcomes();
    if (onOutcomeActionComplete) {
      onOutcomeActionComplete();
    }
  };

  // Handler on successful outcome revocation
  const handleRevokeSuccess = ({ kind, message }) => {
    setActionFeedback({ kind, message });
    fetchVerifiedOutcomes();
    fetchQueue();
    if (onOutcomeActionComplete) {
      onOutcomeActionComplete();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDriveStatusBadge = (lifecycleState) => {
    switch (lifecycleState) {
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Archive className="w-3 h-3 text-amber-600" />
            <span>Archived</span>
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span>Active</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-view Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSubViewChange('queue')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'queue'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Needs Verification</span>
            {queuePagination.total > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSubView === 'queue' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {queuePagination.total}
              </span>
            )}
          </button>

          <button
            onClick={() => onSubViewChange('verified')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'verified'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Verified Outcomes</span>
            {verifiedPagination.total > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSubView === 'verified' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {verifiedPagination.total}
              </span>
            )}
          </button>
        </div>

        {/* Toolbar Filters: Queue Sub-View */}
        {activeSubView === 'queue' && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={queueDriveFilter}
              onChange={(e) => {
                setQueueDriveFilter(e.target.value);
                setQueuePage(1);
              }}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer"
              aria-label="Filter queue by placement drive"
            >
              <option value="">All Drives</option>
              {drives.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.company?.name || 'Company'} — {d.jobRole} {d.isArchived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={fetchQueue}
              disabled={queueLoading}
              title="Refresh Queue"
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        )}

        {/* Toolbar Filters: Verified Sub-View */}
        {activeSubView === 'verified' && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {/* Drive filter */}
            <select
              value={verifiedDriveFilter}
              onChange={(e) => {
                setVerifiedDriveFilter(e.target.value);
                setVerifiedPage(1);
              }}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer"
              aria-label="Filter verified outcomes by placement drive"
            >
              <option value="">All Drives</option>
              {drives.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.company?.name || 'Company'} — {d.jobRole} {d.isArchived ? '(Archived)' : ''}
                </option>
              ))}
            </select>

            {/* Department filter */}
            <select
              value={verifiedDepartmentFilter}
              onChange={(e) => {
                setVerifiedDepartmentFilter(e.target.value);
                setVerifiedPage(1);
              }}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer"
              aria-label="Filter verified outcomes by department"
            >
              <option value="">All Departments</option>
              {departments.map((dept, idx) => {
                const name = typeof dept === 'string' ? dept : dept.name;
                return (
                  <option key={dept._id || idx} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>

            <button
              onClick={fetchVerifiedOutcomes}
              disabled={verifiedLoading}
              title="Refresh Verified Outcomes"
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifiedLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
            actionFeedback.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionFeedback.kind === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : actionFeedback.kind === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {actionFeedback.kind === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : actionFeedback.kind === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-[11px] font-bold hover:underline cursor-pointer ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-view Content: Queue */}
      {activeSubView === 'queue' && (
        <div className="space-y-3">
          {/* Section Scoped Error & Retry */}
          {queueError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{queueError}</span>
              </div>
              <button
                onClick={fetchQueue}
                disabled={queueLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {queueLoading ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-xs text-slate-500 font-medium">Loading verification queue...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Queue is Clear</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  There are no Selected applications awaiting outcome verification at this time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-3 py-3">Roll Number</th>
                      <th scope="col" className="px-3 py-3">Department</th>
                      <th scope="col" className="px-4 py-3">Company & Role</th>
                      <th scope="col" className="px-3 py-3">Drive Status</th>
                      <th scope="col" className="px-3 py-3">Selected At</th>
                      <th scope="col" className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {queue.map((row) => (
                      <tr key={row.applicationId} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {row.studentName}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {row.rollNumber ? (
                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                              {row.rollNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">
                          {row.departmentName}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{row.company}</div>
                          <div className="text-[11px] text-slate-500">{row.role}</div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {getDriveStatusBadge(row.driveLifecycleState)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-500">
                          {formatDate(row.selectedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedItemForVerify(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs shadow-emerald-600/20 transition cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Verify</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Queue Pagination Controls */}
            {queuePagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Showing page <span className="font-bold text-slate-800">{queuePagination.page}</span> of{' '}
                  <span className="font-bold text-slate-800">{queuePagination.totalPages}</span> ({queuePagination.total} total)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                    disabled={queuePagination.page <= 1 || queueLoading}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-semibold text-slate-800">
                    {queuePagination.page}
                  </span>
                  <button
                    onClick={() => setQueuePage((p) => Math.min(queuePagination.totalPages, p + 1))}
                    disabled={queuePagination.page >= queuePagination.totalPages || queueLoading}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-view Content: Verified Outcomes (Stage C) */}
      {activeSubView === 'verified' && (
        <div className="space-y-3">
          {/* Section Scoped Error & Retry */}
          {verifiedError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{verifiedError}</span>
              </div>
              <button
                onClick={fetchVerifiedOutcomes}
                disabled={verifiedLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifiedLoading ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {verifiedLoading ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-xs text-slate-500 font-medium">Loading verified outcomes...</p>
              </div>
            ) : verifiedList.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Verified Outcomes Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  {verifiedDriveFilter || verifiedDepartmentFilter
                    ? 'No verified placement outcomes match the selected drive or department filter criteria.'
                    : 'No placement outcomes have been verified yet for this institution.'}
                </p>
                {(verifiedDriveFilter || verifiedDepartmentFilter) && (
                  <button
                    onClick={() => {
                      setVerifiedDriveFilter('');
                      setVerifiedDepartmentFilter('');
                      setVerifiedPage(1);
                    }}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-3 py-3">Roll Number</th>
                      <th scope="col" className="px-3 py-3">Department</th>
                      <th scope="col" className="px-4 py-3">Company & Role</th>
                      <th scope="col" className="px-3 py-3">Verification</th>
                      <th scope="col" className="px-3 py-3">Package (CTC)</th>
                      <th scope="col" className="px-3 py-3">Verified On</th>
                      <th scope="col" className="px-3 py-3">Verified By</th>
                      <th scope="col" className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {verifiedList.map((row) => (
                      <tr key={row.outcomeId || row.applicationId} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {row.studentName}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {row.rollNumber ? (
                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                              {row.rollNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-600">
                          {row.departmentName}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{row.company}</div>
                          <div className="text-[11px] text-slate-500">{row.role}</div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {/* Distinct verified badge with text + icon (not color alone) */}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title="Institutional outcome confirmed"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-900">
                          {row.ctc !== null && row.ctc !== undefined ? (
                            <span>{formatCtc(row.ctc)}</span>
                          ) : (
                            <span className="text-slate-400 italic">Not specified</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-500">
                          {formatDate(row.verifiedAt)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-700 font-medium">
                          {row.verifiedBy?.name || 'Placement Officer'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => setSelectedItemForHistory(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                              title="View outcome audit history"
                            >
                              <History className="w-3.5 h-3.5 text-slate-500" />
                              <span>History</span>
                            </button>
                            <button
                              onClick={() => setSelectedItemForRevoke(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer"
                              title="Revoke verified placement outcome"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Verified Pagination Controls */}
            {verifiedPagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Showing page <span className="font-bold text-slate-800">{verifiedPagination.page}</span> of{' '}
                  <span className="font-bold text-slate-800">{verifiedPagination.totalPages}</span> ({verifiedPagination.total} total)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVerifiedPage((p) => Math.max(1, p - 1))}
                    disabled={verifiedPagination.page <= 1 || verifiedLoading}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-semibold text-slate-800">
                    {verifiedPagination.page}
                  </span>
                  <button
                    onClick={() => setVerifiedPage((p) => Math.min(verifiedPagination.totalPages, p + 1))}
                    disabled={verifiedPagination.page >= verifiedPagination.totalPages || verifiedLoading}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verify Dialog Modal (Stage B) */}
      <VerifyOutcomeModal
        item={selectedItemForVerify}
        isOpen={!!selectedItemForVerify}
        onClose={() => setSelectedItemForVerify(null)}
        onSuccess={handleVerifySuccess}
      />

      {/* Revoke Dialog Modal (Stage C) */}
      <RevokeOutcomeModal
        item={selectedItemForRevoke}
        isOpen={!!selectedItemForRevoke}
        onClose={() => setSelectedItemForRevoke(null)}
        onSuccess={handleRevokeSuccess}
      />

      {/* Outcome Audit History Modal (Stage C) */}
      <OutcomeHistoryModal
        item={selectedItemForHistory}
        isOpen={!!selectedItemForHistory}
        onClose={() => setSelectedItemForHistory(null)}
      />
    </div>
  );
};

export default PlacementOutcomesSection;
