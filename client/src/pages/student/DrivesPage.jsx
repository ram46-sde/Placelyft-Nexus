import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { driveService } from '../../services/driveService';
import { applicationService } from '../../services/applicationService';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Search,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  IndianRupee,
  Loader2,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import CompanyLocation from '../../components/common/CompanyLocation';

const DRIVES_PER_PAGE = 9;

/**
 * Evaluates the deadline urgency and validity.
 */
const getDeadlineInfo = (deadlineString) => {
  if (!deadlineString) return null;
  const deadline = new Date(deadlineString);
  if (Number.isNaN(deadline.getTime())) return null;

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isPassed: true,
      isUrgent: false,
      label: 'Registration Closed',
      variant: 'rose',
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    return {
      isPassed: false,
      isUrgent: true,
      label: diffHours <= 1 ? 'Closes in 1 hour' : `Closes in ${diffHours}h`,
      variant: 'amber',
    };
  }

  if (diffDays <= 2) {
    return {
      isPassed: false,
      isUrgent: true,
      label: diffDays === 1 ? 'Closes today' : 'Closes in 2 days',
      variant: 'amber',
    };
  }

  return {
    isPassed: false,
    isUrgent: false,
    label: `Closes in ${diffDays} days`,
    variant: 'slate',
  };
};

const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const DrivesPage = () => {
  const { user } = useAuth();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search, Filter & Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState('all'); // all | eligible | ineligible | closingSoon
  const [statusFilter, setStatusFilter] = useState('all'); // all | applied | notApplied
  const [sortBy, setSortBy] = useState('driveDate-asc'); // driveDate-asc | driveDate-desc | deadline-asc | company-asc | package-desc
  const [currentPage, setCurrentPage] = useState(1);

  // Expandable reason disclosures for ineligible drives (keyed by drive._id)
  const [expandedReasons, setExpandedReasons] = useState({});

  // Quick Apply Modal & Notification States
  const [confirmApplyDrive, setConfirmApplyDrive] = useState(null);
  const [submittingApply, setSubmittingApply] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDrives();
  }, []);

  const fetchDrives = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await driveService.getAvailableDrives();
      if (res.success) {
        setDrives(res.drives || []);

        // Update student watermark in localStorage to clear new-drive navigation badge
        if (user?._id) {
          const watermark = res.latestDriveCreatedAt || new Date().toISOString();
          localStorage.setItem(`cpms_drives_watermark_${user._id}`, watermark);
          window.dispatchEvent(
            new CustomEvent('cpms_drives_watermark_updated', {
              detail: { watermark, hasNewDrives: false },
            })
          );
        }
      } else {
        setError(res.message || 'Failed to load placement drives.');
      }
    } catch (err) {
      console.error('Error fetching drives:', err);
      setError(err.response?.data?.message || 'Failed to load placement drives. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle reason disclosure on card
  const toggleReasonDisclosure = (driveId) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [driveId]: !prev[driveId],
    }));
  };

  // KPI calculations derived directly from live drives array
  const kpiCounts = useMemo(() => {
    const total = drives.length;
    let eligible = 0;
    let applied = 0;
    let closingSoon = 0;

    drives.forEach((drive) => {
      if (drive.eligibility?.isEligible) eligible += 1;
      if (drive.hasApplied) applied += 1;
      const dl = getDeadlineInfo(drive.registrationDeadline);
      if (dl && !dl.isPassed && dl.isUrgent) closingSoon += 1;
    });

    return { total, eligible, applied, closingSoon };
  }, [drives]);

  // Filter and sort drives
  const filteredAndSortedDrives = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filtered = drives.filter((drive) => {
      // 1. Search Query
      if (query) {
        const companyName = drive.company?.name?.toLowerCase() || '';
        const role = drive.jobRole?.toLowerCase() || '';
        const location = drive.companyLocation?.toLowerCase() || '';
        const skills = (drive.eligibilityCriteria?.requiredSkills || []).join(' ').toLowerCase();
        const pkg = drive.packageDetails?.toLowerCase() || '';

        const matchesQuery =
          companyName.includes(query) ||
          role.includes(query) ||
          location.includes(query) ||
          skills.includes(query) ||
          pkg.includes(query);

        if (!matchesQuery) return false;
      }

      // 2. Eligibility Filter
      if (eligibilityFilter === 'eligible' && !drive.eligibility?.isEligible) {
        return false;
      }
      if (eligibilityFilter === 'ineligible' && drive.eligibility?.isEligible) {
        return false;
      }
      if (eligibilityFilter === 'closingSoon') {
        const dl = getDeadlineInfo(drive.registrationDeadline);
        if (!dl || dl.isPassed || !dl.isUrgent) return false;
      }

      // 3. Application Status Filter
      if (statusFilter === 'applied' && !drive.hasApplied) {
        return false;
      }
      if (statusFilter === 'notApplied' && drive.hasApplied) {
        return false;
      }

      return true;
    });

    // Sort drives
    return filtered.sort((a, b) => {
      if (sortBy === 'driveDate-asc') {
        const tA = a.driveDate ? new Date(a.driveDate).getTime() : Infinity;
        const tB = b.driveDate ? new Date(b.driveDate).getTime() : Infinity;
        return tA - tB;
      }
      if (sortBy === 'driveDate-desc') {
        const tA = a.driveDate ? new Date(a.driveDate).getTime() : -Infinity;
        const tB = b.driveDate ? new Date(b.driveDate).getTime() : -Infinity;
        return tB - tA;
      }
      if (sortBy === 'deadline-asc') {
        const tA = a.registrationDeadline ? new Date(a.registrationDeadline).getTime() : Infinity;
        const tB = b.registrationDeadline ? new Date(b.registrationDeadline).getTime() : Infinity;
        return tA - tB;
      }
      if (sortBy === 'company-asc') {
        const nameA = (a.company?.name || '').toLowerCase();
        const nameB = (b.company?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'package-desc') {
        const getPkgVal = (d) => {
          if (!d.packageDetails) return 0;
          const match = d.packageDetails.match(/[\d.]+/);
          return match ? parseFloat(match[0]) : 0;
        };
        return getPkgVal(b) - getPkgVal(a);
      }
      return 0;
    });
  }, [drives, searchTerm, eligibilityFilter, statusFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, eligibilityFilter, statusFilter, sortBy]);

  // Pagination calculation
  const totalItems = filteredAndSortedDrives.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / DRIVES_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * DRIVES_PER_PAGE;
  const paginatedDrives = filteredAndSortedDrives.slice(startIndex, startIndex + DRIVES_PER_PAGE);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    eligibilityFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'driveDate-asc';

  const resetFilters = () => {
    setSearchTerm('');
    setEligibilityFilter('all');
    setStatusFilter('all');
    setSortBy('driveDate-asc');
    setCurrentPage(1);
  };

  // Quick Apply submission
  const handleExecuteApply = async () => {
    if (!confirmApplyDrive) return;
    try {
      setSubmittingApply(true);
      setApplyError(null);
      const res = await applicationService.applyForDrive(confirmApplyDrive._id);
      if (res.success) {
        setDrives((prev) =>
          prev.map((d) => (d._id === confirmApplyDrive._id ? { ...d, hasApplied: true } : d))
        );
        setSuccessMessage(
          `Application submitted successfully for ${confirmApplyDrive.jobRole} at ${
            confirmApplyDrive.company?.name || 'the company'
          }.`
        );
        setConfirmApplyDrive(null);
      } else {
        setApplyError(res.message || 'Failed to submit application.');
      }
    } catch (err) {
      setApplyError(err.response?.data?.message || 'Failed to submit application.');
    } finally {
      setSubmittingApply(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Heading & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Placement Drives</h1>
          <p className="text-sm text-slate-500 mt-1">
            Explore and apply for campus recruitment opportunities scheduled for your institution
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-indigo-300 hover:shadow transition"
          onClick={() => {
            setEligibilityFilter('all');
            setStatusFilter('all');
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Drives
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : kpiCounts.total}
          </div>
          <p className="text-xs text-slate-500 mt-1">Active campus drives</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-emerald-300 hover:shadow transition"
          onClick={() => {
            setEligibilityFilter('eligible');
            setStatusFilter('all');
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Eligible
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : kpiCounts.eligible}
          </div>
          <p className="text-xs text-slate-500 mt-1">Matching your profile</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-indigo-300 hover:shadow transition"
          onClick={() => {
            setStatusFilter('applied');
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Applications
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : kpiCounts.applied}
          </div>
          <p className="text-xs text-slate-500 mt-1">Submitted applications</p>
        </Card>

        <Card
          className="flex flex-col justify-between p-4 cursor-pointer hover:border-amber-300 hover:shadow transition"
          onClick={() => {
            setEligibilityFilter('closingSoon');
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Closing Soon
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-7 w-12" /> : kpiCounts.closingSoon}
          </div>
          <p className="text-xs text-slate-500 mt-1">Within next 48 hours</p>
        </Card>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="font-medium truncate">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="Dismiss notification"
            className="text-emerald-700 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100/60 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Search, Filter & Sort Toolbar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <label htmlFor="drive-search-input" className="sr-only">
                Search placement drives
              </label>
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="drive-search-input"
                type="text"
                placeholder="Search by company, role, location, or skill..."
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

            {/* Filter & Sort Controls */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Eligibility Filter */}
              <div className="w-full sm:w-auto">
                <label htmlFor="eligibility-filter-select" className="sr-only">
                  Filter by eligibility
                </label>
                <select
                  id="eligibility-filter-select"
                  value={eligibilityFilter}
                  onChange={(e) => setEligibilityFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                >
                  <option value="all">All Opportunities</option>
                  <option value="eligible">Eligible Only</option>
                  <option value="ineligible">Not Eligible</option>
                  <option value="closingSoon">Closing Soon</option>
                </select>
              </div>

              {/* Application Status Filter */}
              <div className="w-full sm:w-auto">
                <label htmlFor="status-filter-select" className="sr-only">
                  Filter by application status
                </label>
                <select
                  id="status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                >
                  <option value="all">All Applications</option>
                  <option value="notApplied">Not Applied</option>
                  <option value="applied">Already Applied</option>
                </select>
              </div>

              {/* Sort Selector */}
              <div className="w-full sm:w-auto flex items-center gap-1.5">
                <label htmlFor="sort-by-select" className="sr-only">
                  Sort drives by
                </label>
                <div className="relative w-full sm:w-auto">
                  <select
                    id="sort-by-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full sm:w-auto pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                  >
                    <option value="driveDate-asc">Drive Date: Soonest</option>
                    <option value="driveDate-desc">Drive Date: Furthest</option>
                    <option value="deadline-asc">Deadline: Earliest</option>
                    <option value="company-asc">Company: A to Z</option>
                    <option value="package-desc">Package: Highest</option>
                  </select>
                  <ArrowUpDown
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Reset Filters Button */}
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

          {/* Result Count and Active Filters Feedback */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong className="text-slate-800 tabular-nums">{totalItems}</strong> of{' '}
              <strong className="text-slate-800 tabular-nums">{drives.length}</strong> placement{' '}
              {drives.length === 1 ? 'drive' : 'drives'}
            </span>
            {hasActiveFilters && (
              <span className="text-indigo-600 font-medium">Filtered results</span>
            )}
          </div>
        </div>
      </Card>

      {/* Main Drives Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={`drive-skel-${idx}`} className="flex flex-col justify-between p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to Load Drives</h3>
          <p className="text-xs text-slate-500 mt-1.5">{error}</p>
          <button
            type="button"
            onClick={fetchDrives}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </Card>
      ) : drives.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No placement drives found"
          description="Currently there are no active recruitment drives announced for your institution. Check back later."
        />
      ) : paginatedDrives.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching placement drives"
          description="No drives match your current search and filter criteria. Try adjusting your query or resetting filters."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {paginatedDrives.map((drive) => {
            const isEligible = Boolean(drive.eligibility?.isEligible);
            const ineligibilityReasons = drive.eligibility?.reasons || [];
            const deadlineInfo = getDeadlineInfo(drive.registrationDeadline);
            const isDeadlinePassed = Boolean(deadlineInfo?.isPassed);
            const isExpanded = Boolean(expandedReasons[drive._id]);

            return (
              <Card
                key={drive._id}
                className="flex flex-col justify-between overflow-hidden border-slate-200 hover:border-slate-300 hover:shadow-md transition duration-150 ease-in-out"
                padding="p-0"
              >
                {/* Card Top / Header */}
                <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Company Monogram / Logo */}
                      <div
                        className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden"
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
                          <Building2 className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      {/* Company Name & Role */}
                      <div className="min-w-0 flex-1">
                        <span
                          className="text-xs font-semibold text-slate-500 truncate block"
                          title={drive.company?.name || 'Company'}
                        >
                          {drive.company?.name || 'Company'}
                        </span>
                        <h2
                          className="text-base font-bold text-slate-900 truncate mt-0.5"
                          title={drive.jobRole}
                        >
                          {drive.jobRole}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Status & Eligibility Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {drive.hasApplied && (
                      <Badge variant="sky" icon={CheckCircle2}>
                        Applied
                      </Badge>
                    )}

                    {isEligible ? (
                      <Badge variant="emerald" icon={CheckCircle2}>
                        Eligible
                      </Badge>
                    ) : (
                      <Badge variant="rose" icon={XCircle}>
                        Not Eligible
                      </Badge>
                    )}

                    {deadlineInfo && (
                      <Badge variant={deadlineInfo.variant} icon={Clock}>
                        {deadlineInfo.label}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card Details / Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2 text-xs text-slate-600">
                    {/* Drive Date */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        Drive Date:{' '}
                        <span className="font-semibold text-slate-800">
                          {formatDate(drive.driveDate)}
                        </span>
                      </span>
                    </div>

                    {/* Registration Deadline */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        Deadline:{' '}
                        <span className="font-semibold text-slate-800">
                          {formatDate(drive.registrationDeadline)}
                        </span>
                      </span>
                    </div>

                    {/* CTC / Package */}
                    {drive.packageDetails && (
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          Package:{' '}
                          <span className="font-semibold text-slate-800">
                            {drive.packageDetails}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Location */}
                    <CompanyLocation
                      location={drive.companyLocation}
                      className="flex items-center gap-2 text-xs text-slate-600 min-w-0"
                      iconClassName="w-4 h-4 text-slate-400 shrink-0"
                    />
                  </div>

                  {/* Required Skills (if any) */}
                  {Array.isArray(drive.eligibilityCriteria?.requiredSkills) &&
                    drive.eligibilityCriteria.requiredSkills.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap gap-1">
                          {drive.eligibilityCriteria.requiredSkills.slice(0, 3).map((skill, sIdx) => (
                            <span
                              key={`${drive._id}-skill-${sIdx}`}
                              className="px-2 py-0.5 text-[11px] font-medium rounded bg-slate-100 text-slate-600"
                            >
                              {skill}
                            </span>
                          ))}
                          {drive.eligibilityCriteria.requiredSkills.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                              +{drive.eligibilityCriteria.requiredSkills.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Expandable Ineligibility Breakdown */}
                  {!isEligible && ineligibilityReasons.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => toggleReasonDisclosure(drive._id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
                        aria-expanded={isExpanded}
                      >
                        <span>{isExpanded ? 'Hide reason' : 'Why am I not eligible?'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-[11px] text-rose-800 space-y-1">
                          {ineligibilityReasons.map((reason, rIdx) => (
                            <p key={`${drive._id}-reason-${rIdx}`} className="leading-snug">
                              &bull; {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2.5">
                  <Link
                    to={`/student/drives/${drive._id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition duration-150 min-h-[44px] flex-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  </Link>

                  {drive.hasApplied ? (
                    <button
                      type="button"
                      disabled
                      aria-label="Already applied for this drive"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 opacity-90 cursor-not-allowed min-h-[44px] flex-1 text-center"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Applied</span>
                    </button>
                  ) : isDeadlinePassed ? (
                    <button
                      type="button"
                      disabled
                      aria-label="Registration deadline has passed"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 opacity-80 cursor-not-allowed min-h-[44px] flex-1 text-center"
                    >
                      <span>Closed</span>
                    </button>
                  ) : isEligible ? (
                    <button
                      type="button"
                      onClick={() => setConfirmApplyDrive(drive)}
                      aria-label={`Apply for ${drive.jobRole} at ${drive.company?.name || 'Company'}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition duration-150 shadow-xs min-h-[44px] flex-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    >
                      <span>Apply Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-label="Profile does not meet eligibility criteria"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed min-h-[44px] flex-1 text-center"
                    >
                      <span>Not Eligible</span>
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-800 tabular-nums">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-slate-800 tabular-nums">
              {Math.min(startIndex + DRIVES_PER_PAGE, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-slate-800 tabular-nums">{totalItems}</span> drives
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Go to previous page"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            {Array.from({ length: totalPages }).map((_, pIdx) => {
              const pageNum = pIdx + 1;
              const isActive = pageNum === safeCurrentPage;
              return (
                <button
                  key={`page-btn-${pageNum}`}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-semibold rounded-lg transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Go to next page"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Quick Apply Modal */}
      {confirmApplyDrive && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-apply-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 id="confirm-apply-title" className="text-lg font-bold text-slate-900">
                Confirm Application
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Are you sure you want to apply for{' '}
                <strong className="text-slate-900">{confirmApplyDrive.jobRole}</strong> at{' '}
                <strong className="text-slate-900">{confirmApplyDrive.company?.name || 'Company'}</strong>?
              </p>
              <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Your verified student profile credentials will be submitted to the college placement cell for this recruitment drive.
              </p>

              {applyError && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{applyError}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={submittingApply}
                  onClick={() => {
                    setConfirmApplyDrive(null);
                    setApplyError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingApply}
                  onClick={handleExecuteApply}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50"
                >
                  {submittingApply ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Application</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrivesPage;
