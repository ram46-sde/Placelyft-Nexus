/**
 * PlacelyftLogo: Original SVG brand mark for Placelyft Nexus.
 * Abstract "P" with an ascending trajectory path and three connected nexus nodes.
 * Strict invariants:
 * - viewBox 0 0 32 32
 * - Uses currentColor (no hardcoded hex values)
 * - Zero gradients or id/url(#...) references (prevents DOM collisions when rendered multiple times)
 * - Scalable, legible at 24px and 32px
 */
const PlacelyftLogo = ({ className = 'w-6 h-6', ...props }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Vertical stem of abstract P */}
      <path
        d="M8 25V7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Loop of abstract P */}
      <path
        d="M8 7H17C20.866 7 24 10.134 24 14C24 17.866 20.866 21 17 21H8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Upward-moving ascending nexus trajectory */}
      <path
        d="M13 21L25 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Three connected nexus nodes */}
      <circle cx="8" cy="25" r="2.25" fill="currentColor" />
      <circle cx="17" cy="7" r="2" fill="currentColor" />
      <circle cx="25" cy="9" r="2.25" fill="currentColor" />
    </svg>
  );
};

export default PlacelyftLogo;

