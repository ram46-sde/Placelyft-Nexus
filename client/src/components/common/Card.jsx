/**
 * Card primitive component.
 * Standard surface: white background, slate-200 border, rounded-xl radius, shadow-sm.
 */
const Card = ({
  children,
  className = '',
  padding = 'p-5 sm:p-6',
  hoverable = false,
  as: Component = 'div',
  ...rest
}) => {
  return (
    <Component
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${
        hoverable
          ? 'hover:shadow hover:border-slate-300 transition duration-150 ease-in-out motion-reduce:transition-none cursor-pointer'
          : ''
      } ${padding} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
};

export default Card;

