import { Briefcase, FileCheck2, Calendar, Award, AlertCircle, RefreshCw } from 'lucide-react';
import StatCard from '../../common/StatCard';
import { METRIC_LABELS, METRIC_DESCRIPTIONS } from '../../../constants/placementMetrics';

/**
 * KPI summary metrics presentational section.
 * Renders 4 standard cards using existing metrics:
 * 1. Eligible Drives
 * 2. Registered Applications
 * 3. In Progress Applications
 * 4. Selected (Unverified) (Awaiting officer verification)
 */
const DashboardKpiSection = ({
  summary,
  pendingSelectionsCount,
  loading = false,
  error = null,
  onRetry,
}) => {
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
          <span className="truncate">{error}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition min-h-[36px] shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* Eligible Drives */}
      <StatCard
        title="Eligible Drives"
        value={summary?.totalEligibleDrives ?? 0}
        helperText="Available to apply"
        icon={Briefcase}
        color="indigo"
        loading={loading}
      />

      {/* Registered Applications */}
      <StatCard
        title="Registered"
        value={summary?.registeredApplications ?? 0}
        helperText="Total applications submitted"
        icon={FileCheck2}
        color="blue"
        loading={loading}
      />

      {/* In Progress */}
      <StatCard
        title="In Progress"
        value={summary?.inProgressApplications ?? 0}
        helperText="Active recruitment rounds"
        icon={Calendar}
        color="amber"
        loading={loading}
      />

      {/* Selected (Unverified) */}
      <StatCard
        title={METRIC_LABELS.SELECTED_UNVERIFIED}
        value={pendingSelectionsCount ?? 0}
        helperText={METRIC_DESCRIPTIONS.SELECTED_UNVERIFIED}
        icon={Award}
        color="amber"
        loading={loading}
      />
    </div>
  );
};

export default DashboardKpiSection;

