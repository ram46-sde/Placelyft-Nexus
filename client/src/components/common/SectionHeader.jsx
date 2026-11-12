/**
 * SectionHeader primitive component.
 * Standard typography: title 16/24 semibold, subtitle 12/16 muted.
 */
const SectionHeader = ({
  title,
  description,
  icon: Icon,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start sm:items-center justify-between gap-3 flex-wrap ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0" aria-hidden="true">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold leading-6 text-slate-900 truncate">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="text-xs leading-4 text-slate-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default SectionHeader;

