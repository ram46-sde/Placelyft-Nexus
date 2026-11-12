/**
 * Skeleton primitive component for loading states.
 * Uses slate-200 pulse; honors prefers-reduced-motion.
 */
const Skeleton = ({
  className = '',
  variant = 'rect',
  ...rest
}) => {
  const variantClass =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded h-4'
      : 'rounded-lg';

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 motion-reduce:animate-none ${variantClass} ${className}`}
      {...rest}
    />
  );
};

export default Skeleton;

