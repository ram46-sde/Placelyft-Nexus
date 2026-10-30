import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { officerService } from '../../services/officerService';
import CreateDriveModal from '../../components/officer/CreateDriveModal';
import DriveApplicantsModal from '../../components/officer/DriveApplicantsModal';
import {
  Briefcase,
  Plus,
  Search,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  ExternalLink,
  LogOut,
  RefreshCw,
  AlertCircle,
  Filter,
  DollarSign,
  Layers,
  Award,
  Loader2,
  CheckCircle,
} from 'lucide-react';

const isDriveActive = (drive) => {
  if (!drive || !drive.isActive) return false;
  if (!drive.registrationDeadline) return true;
  const deadline = new Date(drive.registrationDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline.getTime() >= today.getTime();
};

const OfficerDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Per-drive applicant statistics map: { [driveId]: { count: number, offersCount: number, applications: [] } }
  const [driveStats, setDriveStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CLOSED'

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDriveForApplicants, setSelectedDriveForApplicants] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/placement-officer/login');
  };

  // Fetch applicant rosters for each drive to compute real Total Applicants and Offers Made
  const fetchApplicantStats = useCallback(async (drivesList) => {
    if (!drivesList || drivesList.length === 0) {
      setDriveStats({});
      return;
    }

    try {
      setStatsLoading(true);
      const results = await Promise.allSettled(
        drivesList.map((d) => officerService.getDriveApplicants(d._id))
      );

      const newStats = {};
      results.forEach((res, index) => {
        const driveId = drivesList[index]._id;
        if (res.status === 'fulfilled' && res.value?.success) {
          const apps = res.value.applications || res.value.applicants || [];
          const offers = apps.filter((a) => a.status === 'Selected').length;
          newStats[driveId] = {
            count: apps.length,
            offersCount: offers,
            applications: apps,
          };
        } else {
          newStats[driveId] = { count: 0, offersCount: 0, applications: [] };
        }
      });
      setDriveStats(newStats);
    } catch (statsErr) {
      console.error('Error fetching applicant stats:', statsErr);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch all placement drives for the officer's college
  const fetchDrives = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await officerService.getDrives();
      if (data.success) {
        const loadedDrives = data.drives || [];
        setDrives(loadedDrives);
        // Once drives are loaded, fetch applicant statistics for real summary metrics
        await fetchApplicantStats(loadedDrives);
      } else {
        setError(data.message || 'Failed to fetch placement drives.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error loading placement drives.');
    } finally {
      setLoading(false);
    }
  }, [fetchApplicantStats]);

  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  // Handler when a new drive is successfully created
  const handleDriveCreated = (newDrive) => {
    setDrives((prev) => [newDrive, ...prev]);
    setDriveStats((prev) => ({
      ...prev,
      [newDrive._id]: { count: 0, offersCount: 0, applications: [] },
    }));
    setSuccessBanner(`Drive for "${newDrive.company?.name || newDrive.jobRole}" created successfully.`);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  // Handler when an applicant's status is updated from the applicant roster modal
  const handleApplicantStatusUpdated = ({ driveId, applicationId, oldStatus, newStatus }) => {
    setDriveStats((prev) => {
      const current = prev[driveId];
      if (!current) return prev;

      const updatedApps = (current.applications || []).map((app) =>
        app._id === applicationId ? { ...app, status: newStatus } : app
      );

      let deltaOffers = 0;
      if (oldStatus !== 'Selected' && newStatus === 'Selected') deltaOffers = 1;
      if (oldStatus === 'Selected' && newStatus !== 'Selected') deltaOffers = -1;

      return {
        ...prev,
        [driveId]: {
          ...current,
          offersCount: Math.max(0, current.offersCount + deltaOffers),
          applications: updatedApps,
        },
      };
    });
  };

  // Real summary metrics computation
  const summaryMetrics = useMemo(() => {
    const totalDrives = drives.length;
    const activeDrives = drives.filter(isDriveActive).length;

    let totalApplicants = 0;
    let totalOffers = 0;

    Object.values(driveStats).forEach((stat) => {
      totalApplicants += stat.count || 0;
      totalOffers += stat.offersCount || 0;
    });

    return {
      totalDrives,
      activeDrives,
      totalApplicants,
      totalOffers,
    };
  }, [drives, driveStats]);

  // Client-side search and status filtering
  const filteredDrives = useMemo(() => {
    return drives.filter((drive) => {
      const query = searchTerm.toLowerCase().trim();
      const companyName = drive.company?.name || '';
      const industry = drive.company?.industry || '';
      const jobRole = drive.jobRole || '';
      const skills = (drive.eligibilityCriteria?.requiredSkills || []).join(' ');

      const matchesSearch =
        !query ||
        companyName.toLowerCase().includes(query) ||
        industry.toLowerCase().includes(query) ||
        jobRole.toLowerCase().includes(query) ||
        skills.toLowerCase().includes(query);

      const active = isDriveActive(drive);
      const matchesFilter =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && active) ||
        (statusFilter === 'CLOSED' && !active);

      return matchesSearch && matchesFilter;
    });
  }, [drives, searchTerm, statusFilter]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base sm:text-lg leading-tight block">
                  CPMS
                </span>
                <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider block">
                  Placement Officer Portal
                </span>
              </div>
            </div>

            {/* Officer Profile & Sign Out */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {user?.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <div className="text-xs font-semibold text-slate-800 leading-none">
                    {user?.name || 'Placement Officer'}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium leading-tight">
                    {user?.role || 'placement_officer'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Success / Info Banners */}
        {successBanner && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-medium">{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner('')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Placement Drives</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage on-campus placement drives, evaluate applicants, and record offers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchDrives}
              disabled={loading}
              title="Refresh Drives"
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Placement Drive</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Drives */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Drives
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {loading ? '-' : summaryMetrics.totalDrives}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Campus drives scheduled</div>
          </div>

          {/* Card 2: Active Drives */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Drives
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700">
              {loading ? '-' : summaryMetrics.activeDrives}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Registration currently open</div>
          </div>

          {/* Card 3: Total Applicants */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Applicants
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              {loading || statsLoading ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                summaryMetrics.totalApplicants
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Students registered across drives</div>
          </div>

          {/* Card 4: Offers Made */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Offers Made
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 flex items-center gap-2">
              {loading || statsLoading ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                summaryMetrics.totalOffers
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Selected candidate offers</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search drives by company, role, industry, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({drives.length})
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active ({summaryMetrics.activeDrives})
              </button>
              <button
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  statusFilter === 'CLOSED'
                    ? 'bg-white text-slate-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Closed ({drives.length - summaryMetrics.activeDrives})
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Failed to load placement drives</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              <button
                onClick={fetchDrives}
                className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Drives Listing */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-9 h-9 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-medium">Fetching placement drives...</p>
          </div>
        ) : drives.length === 0 ? (
          /* Empty State: No drives created yet */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Placement Drives Created Yet</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Get started by creating your college&apos;s first placement drive. Add job details,
              eligibility criteria, and invite student applications.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Drive</span>
            </button>
          </div>
        ) : filteredDrives.length === 0 ? (
          /* Empty State: Filter mismatch */
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
            <p className="text-sm font-bold text-slate-800">No placement drives found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No drives match &quot;{searchTerm}&quot; under the selected filter. Try adjusting your
              search criteria or filter view.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="mt-4 px-4 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Drives Grid / Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {filteredDrives.map((drive) => {
              const active = isDriveActive(drive);
              const stats = driveStats[drive._id] || { count: 0, offersCount: 0 };
              const eligibility = drive.eligibilityCriteria || {};

              return (
                <div
                  key={drive._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Drive Details */}
                  <div className="p-5 space-y-4">
                    {/* Header: Company & Active Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {drive.company?.logoUrl ? (
                            <img
                              src={drive.company.logoUrl}
                              alt={drive.company?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base leading-tight">
                              {drive.company?.name || 'Company Name'}
                            </h3>
                            {drive.company?.website && (
                              <a
                                href={drive.company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-emerald-600 transition"
                                title="Visit company website"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {drive.company?.industry || 'Technology & Services'}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {active ? '● Active' : '○ Closed'}
                      </span>
                    </div>

                    {/* Job Role & Compensation */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">{drive.jobRole}</div>
                        {drive.packageDetails && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
                            <DollarSign className="w-3 h-3 text-emerald-600" />
                            <span>{drive.packageDetails}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {drive.jobDescription}
                      </p>
                    </div>

                    {/* Drive Schedule Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Drive Date
                        </span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {formatDate(drive.driveDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Registration Deadline
                        </span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(drive.registrationDeadline)}
                        </span>
                      </div>
                    </div>

                    {/* Eligibility Summary Tags */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium">Eligibility:</span>
                        {eligibility.minTenthPercentage > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            Min 10th: {eligibility.minTenthPercentage}%
                          </span>
                        )}
                        {eligibility.minTwelfthPercentage > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            Min 12th: {eligibility.minTwelfthPercentage}%
                          </span>
                        )}
                        {drive.effectiveUgCriteriaType === 'PERCENTAGE' || eligibility.ugCriteriaType === 'PERCENTAGE' ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            Min UG: {eligibility.minUgPercentage}%
                          </span>
                        ) : drive.effectiveUgCriteriaType === 'NONE' || eligibility.ugCriteriaType === 'NONE' ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            UG: None
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            Min CGPA: {eligibility.minCgpa ?? 0}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                          Max Backlogs: {eligibility.maxBacklogs ?? 0}
                        </span>
                        {eligibility.requiredCourses?.length > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            Courses: {eligibility.requiredCourses.join(', ')}
                          </span>
                        )}
                      </div>

                      {/* Required Skills */}
                      {eligibility.requiredSkills?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          {eligibility.requiredSkills.slice(0, 4).map((sk, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-semibold border border-emerald-100"
                            >
                              {sk}
                            </span>
                          ))}
                          {eligibility.requiredSkills.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{eligibility.requiredSkills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drive Card Footer: Stats & "View Applicants" Action */}
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-slate-700 font-semibold">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{stats.count} Applicant{stats.count === 1 ? '' : 's'}</span>
                      </div>
                      {stats.offersCount > 0 && (
                        <div className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded-md text-[11px]">
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>{stats.offersCount} Offer{stats.offersCount === 1 ? '' : 's'}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedDriveForApplicants(drive)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View Applicants</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Drive Modal */}
      <CreateDriveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDriveCreated={handleDriveCreated}
      />

      {/* Applicant Roster Modal */}
      <DriveApplicantsModal
        isOpen={Boolean(selectedDriveForApplicants)}
        onClose={() => setSelectedDriveForApplicants(null)}
        drive={selectedDriveForApplicants}
        onStatusUpdated={handleApplicantStatusUpdated}
      />
    </div>
  );
};

export default OfficerDashboardPage;
