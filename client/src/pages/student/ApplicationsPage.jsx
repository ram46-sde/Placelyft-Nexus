import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '../../services/applicationService';
import {
  FileCheck2,
  Building2,
  Calendar,
  Clock,
  Search,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Users,
  Briefcase,
  AlertCircle,
  RotateCcw,
  X,
  IndianRupee,
  ShieldCheck,
  Award,
  Activity,
  ArrowUpDown,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { METRIC_LABELS } from '../../constants/placementMetrics';
import { getApplicationStages } from '../../utils/applicationTrackingUtils';

const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Returns status badge properties strictly adhering to institutional tokens.
 */
const getStatusBadgeConfig = (status, outcomeVerified) => {
  switch (status) {
    case 'Applied':
      return { variant: 'indigo', icon: Clock, label: 'Applied' };
    case 'Shortlisted':
      return { variant: 'indigo', icon: FileCheck2, label: 'Shortlisted' };
    case 'Interviewing':
      return { variant: 'amber', icon: Users, label: 'Interviewing' };
    case 'Selected':
      return outcomeVerified
        ? { variant: 'emerald', icon: ShieldCheck, label: 'Verified Placement' }
        : { variant: 'sky', icon: CheckCircle2, label: METRIC_LABELS.SELECTED_UNVERIFIED };
    case 'Rejected':
      return { variant: 'rose', icon: XCircle, label: 'Not Selected' };
    default:
      return { variant: 'slate', icon: Clock, label: status || 'Pending' };
  }
};

/**
 * Renders the responsive recruitment journey progress tracker for an application.
 */
const RecruitmentJourneyTracker = ({ application }) => {
  const stages = useMemo(() => getApplicationStages(application), [application]);

  // Compute completed / current progress percentage for desktop connector line
  const activeIndex = stages.findIndex((s) => s.status === 'current');
  const unsuccessfulIndex = stages.findIndex((s) => s.status === 'unsuccessful');
  const isAllCompleted = stages.every((s) => s.status === 'completed' || s.status === 'verified');
  const isUnsuccessful = unsuccessfulIndex !== -1;

  let progressPercent = 0;
  if (stages.length > 1) {
    if (isAllCompleted) {
      progressPercent = 100;
    } else if (unsuccessfulIndex !== -1) {
      // Progress line stops at the exact rejected stage node
      progressPercent = (unsuccessfulIndex / (stages.length - 1)) * 100;
    } else if (activeIndex !== -1) {
      progressPercent = (activeIndex / (stages.length - 1)) * 100;
    }
  }

  const getConnectorColor = () => {
    if (isUnsuccessful) return 'bg-rose-400';
    if (isAllCompleted) return 'bg-emerald-500';
    return 'bg-indigo-600';
  };

  return (
    <div className="w-full py-2">
      {/* Desktop Horizontal Tracker (sm:flex) */}
      <div className="hidden sm:block relative">
        <div className="relative flex items-start justify-between">
          {/* Background Track Line */}
          <div
            className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0"
            aria-hidden="true"
          />

          {/* Active Colored Progress Fill */}
          <div
            className={`absolute top-4 left-6 h-0.5 z-0 transition-all duration-300 ${getConnectorColor()}`}
            style={{ width: `calc(${progressPercent}% * (100% - 3rem) / 100)` }}
            aria-hidden="true"
          />

          {/* Stage Nodes */}
          {stages.map((stage, idx) => {
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            const isVerified = stage.status === 'verified';
            const isUnsuccessfulNode = stage.status === 'unsuccessful';

            return (
              <div
                key={stage.id}
                className="relative z-10 flex flex-col items-center text-center flex-1 max-w-[160px]"
              >
                {/* Node Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 ${
                    isVerified
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm'
                      : isCompleted
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md animate-pulse motion-reduce:animate-none'
                      : isUnsuccessfulNode
                      ? 'bg-rose-500 text-white ring-4 ring-rose-100 shadow-sm'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                  aria-label={`${stage.label}: ${stage.status}`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4" aria-hidden="true" />
                  ) : isUnsuccessfulNode ? (
                    <XCircle className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <span className="text-xs font-semibold">{idx + 1}</span>
                  )}
                </div>

                {/* Stage Label & Details */}
                <div className="mt-2 space-y-0.5">
                  <span
                    className={`block text-xs font-semibold leading-tight truncate ${
                      isCurrent
                        ? 'text-indigo-900 font-bold'
                        : isVerified
                        ? 'text-emerald-900'
                        : isUnsuccessfulNode
                        ? 'text-rose-900'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                    title={stage.label}
                  >
                    {stage.label}
                  </span>

                  {stage.date ? (
                    <span className="block text-[11px] text-slate-500 tabular-nums">
                      {stage.date}
                    </span>
                  ) : isCurrent ? (
                    <span className="inline-block px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">
                      Current Stage
                    </span>
                  ) : isUnsuccessfulNode ? (
                    <div className="space-y-0.5">
                      <span className="inline-block px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded">
                        Rejected
                      </span>
                      {stage.reason ? (
                        <span className="block text-[11px] text-rose-600 truncate max-w-[140px] mx-auto" title={stage.reason}>
                          {stage.reason}
                        </span>
                      ) : (
                        <span className="block text-[11px] text-slate-500 truncate" title={stage.description}>
                          {stage.description}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      className={`block text-[11px] truncate ${
                        stage.status === 'pending' ? 'text-slate-400 italic' : 'text-slate-400'
                      }`}
                    >
                      {stage.description}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Vertical Timeline (sm:hidden) */}
      <div className="sm:hidden space-y-3 pt-1">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === 'completed';
          const isCurrent = stage.status === 'current';
          const isVerified = stage.status === 'verified';
          const isUnsuccessfulNode = stage.status === 'unsuccessful';
          const isLast = idx === stages.length - 1;

          return (
            <div key={stage.id} className="relative flex items-start gap-3">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-[1px] ${
                    isUnsuccessfulNode || (unsuccessfulIndex !== -1 && idx >= unsuccessfulIndex)
                      ? 'bg-slate-200'
                      : isCompleted || isVerified
                      ? 'bg-emerald-400'
                      : isCurrent
                      ? 'bg-indigo-300'
                      : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Node Icon */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isVerified
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-100 animate-pulse motion-reduce:animate-none'
                    : isUnsuccessfulNode
                    ? 'bg-rose-500 text-white ring-2 ring-rose-100'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
                aria-label={`${stage.label}: ${stage.status}`}
              >
                {isVerified ? (
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                ) : isUnsuccessfulNode ? (
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                )}
              </div>

              {/* Label & Details */}
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? 'text-indigo-900 font-bold'
                        : isVerified
                        ? 'text-emerald-900'
                        : isUnsuccessfulNode
                        ? 'text-rose-900'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">
                      Current
                    </span>
                  )}
                  {isUnsuccessfulNode && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded">
                      Rejected
                    </span>
                  )}
                </div>

                <p
                  className={`text-[11px] mt-0.5 leading-tight ${
                    isUnsuccessfulNode
                      ? 'text-rose-600'
                      : stage.status === 'pending'
                      ? 'text-slate-400 italic'
                      : 'text-slate-500'
                  }`}
                >
                  {stage.date
                    ? `Registered on ${stage.date}`
                    : isUnsuccessfulNode && stage.reason
                    ? `Reason: ${stage.reason}`
                    : stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter controls
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | inProgress | unverified | verified | rejected
  const [sortBy, setSortBy] = useState('applied-desc'); // applied-desc | applied-asc | company-asc | driveDate-asc

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await applicationService.getMyApplications();
      if (res.success) {
        setApplications(res.applications || []);
      } else {
        setError(res.message || 'Failed to load your applications.');
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError(err.response?.data?.message || 'Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // KPI Overview counts strictly derived from live data
  const overviewCounts = useMemo(() => {
    const total = applications.length;
    let inProgress = 0;
    let selectedUnverified = 0;
    let verifiedOutcomes = 0;

    applications.forEach((app) => {
      if (['Applied', 'Shortlisted', 'Interviewing'].includes(app.status)) {
        inProgress += 1;
      } else if (app.status === 'Selected') {
        if (app.outcomeVerified) {
          verifiedOutcomes += 1;
        } else {
          selectedUnverified += 1;
        }
      }
    });

    return { total, inProgress, selectedUnverified, verifiedOutcomes };
  }, [applications]);

  // Filter and sort applications
  const filteredAndSortedApplications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filtered = applications.filter((app) => {
      const drive = app.placementDrive;
      if (!drive) return false;

      // 1. Search Query
      if (query) {
        const companyName = drive.company?.name?.toLowerCase() || '';
        const role = drive.jobRole?.toLowerCase() || '';
        const statusStr = app.status?.toLowerCase() || '';
        if (
          !companyName.includes(query) &&
          !role.includes(query) &&
          !statusStr.includes(query)
        ) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'inProgress') {
        return ['Applied', 'Shortlisted', 'Interviewing'].includes(app.status);
      }
      if (statusFilter === 'unverified') {
        return app.status === 'Selected' && !app.outcomeVerified;
      }
      if (statusFilter === 'verified') {
        return app.status === 'Selected' && Boolean(app.outcomeVerified);
      }
      if (statusFilter === 'rejected') {
        return app.status === 'Rejected';
      }

      return true;
    });

    // Sort applications
    return filtered.sort((a, b) => {
      if (sortBy === 'applied-desc') {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : -Infinity;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : -Infinity;
        return tB - tA;
      }
      if (sortBy === 'applied-asc') {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
        return tA - tB;
      }
      if (sortBy === 'company-asc') {
        const nameA = (a.placementDrive?.company?.name || '').toLowerCase();
        const nameB = (b.placementDrive?.company?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'driveDate-asc') {
        const tA = a.placementDrive?.driveDate
          ? new Date(a.placementDrive.driveDate).getTime()
          : Infinity;
        const tB = b.placementDrive?.driveDate
          ? new Date(b.placementDrive.driveDate).getTime()
          : Infinity;
        return tA - tB;
      }
      return 0;
    });
  }, [applications, searchTerm, statusFilter, sortBy]);

  const hasActiveFilters = Boolean(searchTerm.trim()) || statusFilter !== 'all' || sortBy !== 'applied-desc';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('applied-desc');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your recruitment stages, interview progress, and placement outcomes
          </p>
        </div>
      </div>

      {/* Application Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-indigo-300 hover:shadow transition"
          onClick={() => setStatusFilter('all')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Applications
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : overviewCounts.total}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total submitted drives</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-amber-300 hover:shadow transition"
          onClick={() => setStatusFilter('inProgress')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              In Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : overviewCounts.inProgress}
          </div>
          <p className="text-xs text-slate-500 mt-1">Under active evaluation</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-sky-300 hover:shadow transition"
          onClick={() => setStatusFilter('unverified')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {METRIC_LABELS.SELECTED_UNVERIFIED}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : overviewCounts.selectedUnverified}
          </div>
          <p className="text-xs text-slate-500 mt-1">Pending officer verification</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-emerald-300 hover:shadow transition"
          onClick={() => setStatusFilter('verified')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verified Outcomes
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : overviewCounts.verifiedOutcomes}
          </div>
          <p className="text-xs text-slate-500 mt-1">Verified institutional offers</p>
        </Card>
      </div>

      {/* Search, Filter & Sort Toolbar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <label htmlFor="application-search-input" className="sr-only">
                Search applications
              </label>
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="application-search-input"
                type="text"
                placeholder="Search by company, role or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search input"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded min-w-[32px] min-h-[32px] flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Filter & Sort Dropdowns */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Status Filter */}
              <div className="w-full sm:w-auto">
                <label htmlFor="status-filter-select" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                >
                  <option value="all">All Applications</option>
                  <option value="inProgress">In Progress</option>
                  <option value="unverified">{METRIC_LABELS.SELECTED_UNVERIFIED}</option>
                  <option value="verified">Verified Outcomes</option>
                  <option value="rejected">Not Selected</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="w-full sm:w-auto relative">
                <label htmlFor="sort-by-select" className="sr-only">
                  Sort applications
                </label>
                <select
                  id="sort-by-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full sm:w-auto pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                >
                  <option value="applied-desc">Applied: Newest First</option>
                  <option value="applied-asc">Applied: Oldest First</option>
                  <option value="company-asc">Company: A to Z</option>
                  <option value="driveDate-asc">Drive Date: Soonest</option>
                </select>
                <ArrowUpDown
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
              </div>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  aria-label="Reset all search and filter controls"
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition min-h-[44px] shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong className="text-slate-800 tabular-nums">{filteredAndSortedApplications.length}</strong> of{' '}
              <strong className="text-slate-800 tabular-nums">{applications.length}</strong>{' '}
              {applications.length === 1 ? 'application' : 'applications'}
            </span>
            {hasActiveFilters && (
              <span className="text-indigo-600 font-medium">Filtered results</span>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`app-skel-${idx}`} className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full rounded-xl pt-2" />
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to Load Applications</h3>
          <p className="text-xs text-slate-500 mt-1.5">{error}</p>
          <button
            type="button"
            onClick={fetchApplications}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </Card>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No applications submitted yet"
          description="Explore active campus placement drives and apply to recruitment opportunities matching your profile."
          action={
            <Link
              to="/student/drives"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition min-h-[44px]"
            >
              <span>Explore Placement Drives</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          }
        />
      ) : filteredAndSortedApplications.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching applications found"
          description="No applications match your current search and filter criteria. Try adjusting your query or resetting filters."
          action={
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition min-h-[44px] shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Filters</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {filteredAndSortedApplications.map((app) => {
            const drive = app.placementDrive;
            if (!drive) return null;

            const badgeConfig = getStatusBadgeConfig(app.status, app.outcomeVerified);

            return (
              <Card
                key={app._id}
                className="overflow-hidden border-slate-200 hover:border-slate-300 hover:shadow-md transition duration-150 ease-in-out p-5 sm:p-6 space-y-5"
              >
                {/* Application Card Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Company Logo Monogram */}
                    <div
                      className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      {drive.company?.logoUrl ? (
                        <img
                          src={drive.company.logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Company Name, Role & Applied Date */}
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wider block truncate"
                        title={drive.company?.name || 'Company'}
                      >
                        {drive.company?.name || 'Company'}
                      </span>
                      <h2
                        className="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5"
                        title={drive.jobRole}
                      >
                        {drive.jobRole}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>Applied on {formatDate(app.createdAt)}</span>
                        {drive.driveDate && (
                          <>
                            <span aria-hidden="true">&bull;</span>
                            <span>Drive Date: {formatDate(drive.driveDate)}</span>
                          </>
                        )}
                        {drive.packageDetails && (
                          <>
                            <span aria-hidden="true">&bull;</span>
                            <span className="font-semibold text-slate-700">
                              {drive.packageDetails}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Top-Right Status Badge */}
                  <div className="self-start sm:self-auto shrink-0">
                    <Badge variant={badgeConfig.variant} icon={badgeConfig.icon}>
                      {badgeConfig.label}
                    </Badge>
                  </div>
                </div>

                {/* Recruitment Journey Tracker (Focal Point) */}
                <div className="pt-2 pb-1 border-t border-slate-100">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2 sm:mb-3">
                    Recruitment Tracking Journey
                  </span>
                  <RecruitmentJourneyTracker application={app} />
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2 truncate">
                    {app.status === 'Selected' && app.outcomeVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span>Institutional outcome verified by placement cell</span>
                      </span>
                    ) : app.status === 'Selected' ? (
                      <span className="inline-flex items-center gap-1 text-sky-700 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                        <span>Awaiting final placement cell officer verification</span>
                      </span>
                    ) : app.status === 'Rejected' ? (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                        <XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />
                        <span>Application not selected for this drive</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                        <Activity className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                        <span>Recruitment progression active</span>
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/student/drives/${drive._id}`}
                    aria-label={`View drive details for ${drive.jobRole} at ${drive.company?.name || 'Company'}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 transition duration-150 min-h-[44px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <span>View Drive</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
