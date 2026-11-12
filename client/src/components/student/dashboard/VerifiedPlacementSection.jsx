import { Award, CheckCircle2, Calendar, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import EmptyState from '../../common/EmptyState';
import Skeleton from '../../common/Skeleton';
import SectionHeader from '../../common/SectionHeader';
import { METRIC_LABELS, METRIC_DESCRIPTIONS } from '../../../constants/placementMetrics';

/**
 * Verified Placement Section (Phase 4C standard).
 * Displays official verified recruitment outcomes confirmed by institutional officers.
 * Strictly adheres to institutional outcome tracking terminology rules.
 */
const VerifiedPlacementSection = ({
  verifiedOutcomes = [],
  loading = false,
  error = null,
  onRetry,
}) => {
  const formatVerifiedDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const countBadge = verifiedOutcomes.length > 0 ? (
    <Badge variant="emerald" size="sm">
      {verifiedOutcomes.length} {verifiedOutcomes.length === 1 ? 'Outcome' : 'Outcomes'}
    </Badge>
  ) : null;

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title={METRIC_LABELS.VERIFIED_SECTION_TITLE}
        description="Official verified recruitment outcomes confirmed by your institution"
        icon={Award}
        badge={countBadge}
      />

      {error ? (
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
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : verifiedOutcomes.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No verified placement outcomes yet"
          description={METRIC_DESCRIPTIONS.VERIFIED_EMPTY_STATE}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {verifiedOutcomes.map((outcome, idx) => (
            <div
              key={`${outcome.company}-${outcome.role}-${idx}`}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-200 transition duration-150 ease-in-out flex flex-col justify-between gap-3 min-w-0"
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate max-w-full">
                      {outcome.company}
                    </span>
                    <Badge variant="emerald" icon={CheckCircle2}>
                      Verified
                    </Badge>
                  </div>
                  <h3
                    className="text-sm sm:text-base font-semibold text-slate-900 mt-1 truncate"
                    title={outcome.role}
                  >
                    {outcome.role}
                  </h3>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2 min-w-0">
                {outcome.formattedCtc !== '—' ? (
                  <div className="flex items-center gap-1 font-semibold text-slate-900 shrink-0">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>{outcome.formattedCtc}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs shrink-0">
                    Package confidential
                  </span>
                )}
                {outcome.verifiedAt && (
                  <div className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Verified on {formatVerifiedDate(outcome.verifiedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default VerifiedPlacementSection;
