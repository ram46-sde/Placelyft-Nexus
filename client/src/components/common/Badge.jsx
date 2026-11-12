/**
 * Badge primitive component.
 * Accessibility invariant: Always displays text plus optional icon (never color alone).
 * Semantic tokens: emerald (success), amber (warning), rose (danger), sky (info), indigo (primary), slate (neutral).
 */
const VARIANT_STYLES = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

const Badge = ({
  children,
  variant = 'slate',
  size = 'sm',
  icon: Icon,
  iconClassName = 'w-3 h-3 shrink-0',
  className = '',
  ...rest
}) => {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.slate;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.sm;

  return (
    <span
      className={`inline-flex items-center font-medium leading-4 rounded-md border shrink-0 ${variantClass} ${sizeClass} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={iconClassName} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
};

export default Badge;

