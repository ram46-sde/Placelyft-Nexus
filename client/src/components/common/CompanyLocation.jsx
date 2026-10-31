import { MapPin } from 'lucide-react';

/**
 * Reusable CompanyLocation component.
 * Displays a MapPin icon and sanitized plain-text location.
 * Falls back to "Location not specified" for missing, null, empty, or whitespace-only values.
 * Truncates long values with a tooltip to prevent breaking card layouts.
 */
const CompanyLocation = ({
  location,
  className = 'inline-flex items-center gap-1.5 text-xs text-slate-500 min-w-0',
  iconClassName = 'w-3.5 h-3.5 text-slate-400 shrink-0',
  textClassName = 'truncate',
}) => {
  const hasLocation = typeof location === 'string' && location.trim().length > 0;
  const displayText = hasLocation ? location.trim() : 'Location not specified';
  const isFallback = !hasLocation;

  return (
    <div className={className} title={displayText}>
      <MapPin className={iconClassName} />
      <span className={`${textClassName} ${isFallback ? 'italic text-slate-400' : ''}`}>
        {displayText}
      </span>
    </div>
  );
};

export default CompanyLocation;
