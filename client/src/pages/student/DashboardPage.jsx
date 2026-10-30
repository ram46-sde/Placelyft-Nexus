import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/dashboardService';
import { notificationService } from '../../services/notificationService';
import {
  Briefcase,
  FileCheck2,
  Calendar,
  Award,
  Bell,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    totalEligibleDrives: 0,
    registeredApplications: 0,
    inProgressApplications: 0,
    selectedApplications: 0,
  });
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError('');
        const [summaryRes, notifRes] = await Promise.allSettled([
          dashboardService.getSummary(),
          notificationService.getNotifications(),
        ]);

        if (!isMounted) return;

        if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
          const s = summaryRes.value;
          setSummary({
            totalEligibleDrives: s.totalEligibleDrives ?? s.summary?.totalEligibleDrives ?? 0,
            registeredApplications: s.registeredApplications ?? s.summary?.registeredApplications ?? 0,
            inProgressApplications: s.inProgressApplications ?? s.summary?.inProgressApplications ?? 0,
            selectedApplications: s.selectedApplications ?? s.summary?.selectedApplications ?? 0,
          });
        } else if (summaryRes.status === 'rejected') {
          console.error('Failed to load dashboard summary:', summaryRes.reason);
          setError(
            summaryRes.reason?.response?.data?.message ||
              'Unable to load dashboard summary metrics. Please refresh.'
          );
        }

        if (notifRes.status === 'fulfilled' && notifRes.value?.success) {
          const notifs = notifRes.value.notifications || [];
          setRecentNotifications(notifs.slice(0, 3));
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching dashboard data:', err);
        setError('An unexpected error occurred while loading dashboard data.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Welcome back</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Hello, {user?.name || 'Student'}!
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Manage your placement applications, review company recruitment drives, and track your interview rounds progression all in one place.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Summary Cards (Populated from authenticated student summary endpoint) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Eligible Drives */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Eligible Drives</span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {loading ? <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /> : summary.totalEligibleDrives}
          </div>
          <p className="text-xs text-slate-400 mt-1">Available to apply</p>
        </div>

        {/* Registered Applications */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {loading ? <Loader2 className="w-6 h-6 text-blue-600 animate-spin" /> : summary.registeredApplications}
          </div>
          <p className="text-xs text-slate-400 mt-1">Total applications submitted</p>
        </div>

        {/* In Progress */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {loading ? <Loader2 className="w-6 h-6 text-amber-600 animate-spin" /> : summary.inProgressApplications}
          </div>
          <p className="text-xs text-slate-400 mt-1">Active recruitment rounds</p>
        </div>

        {/* Selected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {loading ? <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /> : summary.selectedApplications}
          </div>
          <p className="text-xs text-slate-400 mt-1">Offers accepted</p>
        </div>
      </div>

      {/* Main Sections: Eligible Drives & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Placement Drives Link Block */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Latest Placement Drives</h2>
              <Link
                to="/student/drives"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Dashboard Drive Teaser */}
            <div className="py-12 px-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Explore Active Recruitment Drives</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Review verified campus recruitment opportunities, check your academic eligibility, and apply directly.
              </p>
              <Link
                to="/student/drives"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <span>Browse Placement Drives</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Recent Notifications</h2>
              <Link
                to="/student/notifications"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
              >
                <span>All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                <span className="text-xs text-slate-400">Loading notifications...</span>
              </div>
            ) : recentNotifications.length > 0 ? (
              <div className="space-y-3">
                {recentNotifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`p-3 rounded-lg border text-left transition ${
                      notif.isRead
                        ? 'bg-slate-50/60 border-slate-100'
                        : 'bg-indigo-50/40 border-indigo-100/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" title="Unread" />
                        )}
                        <h4 className="text-xs font-semibold text-slate-800 truncate">{notif.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-semibold text-slate-700">No notifications yet</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Updates regarding your drives and interview schedules will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
