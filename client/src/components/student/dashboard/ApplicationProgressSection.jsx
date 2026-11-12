import { Activity } from 'lucide-react';
import Card from '../../common/Card';
import SectionHeader from '../../common/SectionHeader';
import Skeleton from '../../common/Skeleton';
import EmptyState from '../../common/EmptyState';
import { METRIC_LABELS } from '../../../constants/placementMetrics';

/**
 * Application Progress & Pipeline section.
 * Renders an institutional recruitment funnel using CSS/SVG bars.
 * Derived entirely from existing verified data contracts (zero fake data).
 */
const ApplicationProgressSection = ({
  registered = 0,
  inProgress = 0,
  selectedUnverified = 0,
  verified = 0,
  loading = false,
}) => {
  const total = registered;

  const stages = [
    {
      label: 'Registered',
      count: registered,
      color: 'bg-indigo-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      borderColor: 'border-indigo-200',
    },
    {
      label: 'In Progress',
      count: inProgress,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
    },
    {
      label: METRIC_LABELS.SELECTED_UNVERIFIED,
      count: selectedUnverified,
      color: 'bg-sky-500',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-700',
      borderColor: 'border-sky-200',
    },
    {
      label: 'Verified Placement',
      count: verified,
      color: 'bg-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-200',
    },
  ];

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title="Application Progress"
        description="Recruitment stage progression for your submitted applications"
        icon={Activity}
      />

      {loading ? (
        <div className="space-y-3 pt-1">
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Activity}
          title="No applications tracked"
          description="Your recruitment pipeline will update here as you apply to campus drives."
        />
      ) : (
        <div className="space-y-4 pt-1">
          {/* Visual Progress Bar (CSS Bar) */}
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex gap-0.5" role="progressbar" aria-valuenow={registered} aria-valuemin={0} aria-valuemax={registered} aria-label="Application progression stages">
            {stages.map((stage) => {
              if (stage.count <= 0) return null;
              const pct = total > 0 ? (stage.count / total) * 100 : 0;
              return (
                <div
                  key={stage.label}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                  className={`${stage.color} h-full transition-all duration-150 motion-reduce:transition-none`}
                  title={`${stage.label}: ${stage.count}`}
                />
              );
            })}
          </div>

          {/* Stage Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stages.map((stage) => (
              <div
                key={stage.label}
                className={`p-3 rounded-lg border ${stage.borderColor} ${stage.bgColor} flex flex-col justify-between`}
              >
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider truncate" title={stage.label}>
                  {stage.label}
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className={`text-xl font-bold tabular-nums ${stage.textColor}`}>
                    {stage.count}
                  </span>
                  {total > 0 && (
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                      {Math.round((stage.count / total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ApplicationProgressSection;

