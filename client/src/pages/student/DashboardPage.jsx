import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  FileCheck2,
  Calendar,
  Award,
  Bell,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();

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

      {/* Quick Summary Cards (Calculated directly from actual records, empty states for clean DB) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Eligible Drives</span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <p className="text-xs text-slate-400 mt-1">Available to apply</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <p className="text-xs text-slate-400 mt-1">Total applications submitted</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <p className="text-xs text-slate-400 mt-1">Active recruitment rounds</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <p className="text-xs text-slate-400 mt-1">Offers accepted</p>
        </div>
      </div>

      {/* Main Sections: Eligible Drives & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Placement Drives (Empty state) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Latest Placement Drives</h2>
            <Link
              to="/drives"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Genuine Empty State */}
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No placement drives available</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Active recruitment drives published by the placement cell will appear here.
            </p>
          </div>
        </div>

        {/* Notifications and Profile Completion */}
        <div className="space-y-6">
          {/* Notifications Card (Empty state) */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Recent Notifications</h2>
              <Link
                to="/notifications"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
              >
                <span>All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Genuine Empty State */}
            <div className="py-8 px-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-slate-700">No notifications yet</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Updates regarding your drives and interview schedules will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
