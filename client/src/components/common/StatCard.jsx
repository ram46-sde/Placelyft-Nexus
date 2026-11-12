import Card from './Card';
import Skeleton from './Skeleton';

const COLOR_MAP = {
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  blue: {
    bg: 'bg-sky-50',
    text: 'text-sky-600',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
};

/**
 * StatCard primitive for dashboard KPI metrics.
 * Follows design tokens: tabular-nums, uppercase label, helper text, accessible loading skeleton.
 */
const StatCard = ({
  title,
  value,
  helperText,
  icon: Icon,
  color = 'indigo',
  loading = false,
  className = '',
  onClick,
}) => {
  const colorStyle = COLOR_MAP[color] || COLOR_MAP.indigo;

  return (
    <Card
      className={`flex flex-col justify-between ${className}`}
      hoverable={!!onClick}
      onClick={onClick}
    >
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          {Icon && (
            <div
              className={`w-9 h-9 rounded-lg ${colorStyle.bg} ${colorStyle.text} flex items-center justify-center shrink-0`}
              aria-hidden="true"
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-8 w-20 mb-1" />
        ) : (
          <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-xs leading-4 text-slate-500 mt-2 truncate">
          {helperText}
        </p>
      )}
    </Card>
  );
};

export default StatCard;

