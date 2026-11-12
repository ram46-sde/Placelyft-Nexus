/**
 * EmptyState primitive component.
 * Displays helpful, clean zero-data state with icon, title, description, and optional action.
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 ${className}`}>
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5" aria-hidden="true">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold leading-5 text-slate-700">{title}</h3>
      {description && (
        <p className="text-xs leading-4 text-slate-500 max-w-md mx-auto mt-1">
          {description}
        </p>
      )}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
};

export default EmptyState;

