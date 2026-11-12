import { Link } from 'react-router-dom';
import { Bell, Clock, ArrowRight } from 'lucide-react';
import Card from '../../common/Card';
import SectionHeader from '../../common/SectionHeader';
import EmptyState from '../../common/EmptyState';
import Skeleton from '../../common/Skeleton';

/**
 * Recent Activity section.
 * Renders latest institutional updates from the student's authenticated notification stream.
 */
const RecentActivitySection = ({
  notifications = [],
  loading = false,
}) => {
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
  };

  const viewAllAction = (
    <Link
      to="/student/notifications"
      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition min-h-[44px] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
    >
      <span>View all</span>
      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
    </Link>
  );

  return (
    <Card className="flex flex-col justify-between h-full">
      <div className="space-y-4">
        <SectionHeader
          title="Recent Activity"
          description="Updates regarding your recruitment rounds"
          icon={Bell}
          action={viewAllAction}
        />

        {loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No activity yet"
            description="Updates regarding your scheduled drives, round outcomes, and notices will appear here."
          />
        ) : (
          <div className="space-y-3 pt-1">
            {notifications.map((notif) => (
              <div
                key={notif._id}
                className={`p-3.5 rounded-lg border text-left transition duration-150 ${
                  notif.isRead
                    ? 'bg-slate-50/60 border-slate-100'
                    : 'bg-indigo-50/30 border-indigo-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {!notif.isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"
                        title="Unread notification"
                        aria-label="Unread notification"
                      />
                    )}
                    <h4 className="text-xs font-semibold text-slate-800 truncate">
                      {notif.title}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{formatTimeAgo(notif.createdAt)}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default RecentActivitySection;

