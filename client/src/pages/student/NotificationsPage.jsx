import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Briefcase,
  Award,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const POLLING_INTERVAL_MS = 30000; // 30 seconds

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  const notifyLayout = useCallback((count) => {
    window.dispatchEvent(
      new CustomEvent('cpms_notifications_updated', {
        detail: { unreadCount: count },
      })
    );
  }, []);

  const fetchNotifications = useCallback(
    async (isBackground = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (!isBackground) {
          setError('');
        } else {
          setRefreshing(true);
        }

        const data = await notificationService.getNotifications();

        if (!isMountedRef.current) return;

        if (data.success) {
          const list = data.notifications || [];
          const count = data.unreadCount ?? list.filter((n) => !n.isRead).length;
          setNotifications(list);
          setUnreadCount(count);
          notifyLayout(count);
        } else {
          if (!isBackground) {
            setError(data.message || 'Failed to load notifications.');
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Error fetching notifications:', err);
        if (!isBackground) {
          setError(
            err.response?.data?.message || 'Server error loading notifications. Please try again.'
          );
        }
      } finally {
        isFetchingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [notifyLayout]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications(false);

    // REST polling every 30 seconds
    const intervalId = setInterval(() => {
      fetchNotifications(true);
    }, POLLING_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);

    try {
      const res = await notificationService.markAsRead(id);
      if (res.success && isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => {
          const nextCount = Math.max(0, prev - 1);
          notifyLayout(nextCount);
          return nextCount;
        });
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      if (isMountedRef.current) {
        setActionLoadingId(null);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAllRead || unreadCount === 0) return;
    setMarkingAllRead(true);

    try {
      const res = await notificationService.markAllAsRead();
      if (res.success && isMountedRef.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        notifyLayout(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      if (isMountedRef.current) {
        setMarkingAllRead(false);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNotificationConfig = (item) => {
    const driveId = item.placementDrive
      ? typeof item.placementDrive === 'object'
        ? item.placementDrive._id
        : item.placementDrive
      : null;

    switch (item.type) {
      case 'OUTCOME_VERIFIED':
        return {
          icon: <Award className="w-4 h-4" />,
          iconBg: item.isRead
            ? 'bg-slate-100 text-slate-500'
            : 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20',
          badge: (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Verified Outcome</span>
            </span>
          ),
          link: driveId ? `/student/drives/${driveId}` : '/student/applications',
          linkText: 'View Drive Details',
        };
      case 'STATUS_UPDATE':
        return {
          icon: <Briefcase className="w-4 h-4" />,
          iconBg: item.isRead
            ? 'bg-slate-100 text-slate-500'
            : 'bg-blue-600 text-white shadow-xs shadow-blue-600/20',
          badge: (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Status Update
            </span>
          ),
          link: driveId ? `/student/drives/${driveId}` : '/student/applications',
          linkText: 'View Application',
        };
      case 'DRIVE_ANNOUNCEMENT':
        return {
          icon: <Briefcase className="w-4 h-4" />,
          iconBg: item.isRead
            ? 'bg-slate-100 text-slate-500'
            : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20',
          badge: (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              New Drive
            </span>
          ),
          link: driveId ? `/student/drives/${driveId}` : '/student/drives',
          linkText: 'Explore Drive',
        };
      default:
        // Safe fallback for unknown notification types
        return {
          icon: <Bell className="w-4 h-4" />,
          iconBg: item.isRead
            ? 'bg-slate-100 text-slate-500'
            : 'bg-slate-700 text-white shadow-xs shadow-slate-700/20',
          badge: (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Notice
            </span>
          ),
          link: '/student/dashboard',
          linkText: 'View Dashboard',
        };
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-semibold">
                {unreadCount} unread
              </span>
            )}
            {refreshing && (
              <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" title="Updating..." />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Official updates regarding placement drives, application statuses, and interview rounds
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications(false)}
            disabled={loading || refreshing}
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition cursor-pointer disabled:opacity-50"
            >
              {markingAllRead ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Content State Handling */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No notifications yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            You have no notifications at this moment. You will be notified here when an officer updates your application status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const isItemUpdating = actionLoadingId === item._id;
            const config = getNotificationConfig(item);

            return (
              <div
                key={item._id}
                className={`p-4 rounded-xl border transition shadow-xs ${
                  item.isRead
                    ? 'bg-white border-slate-200/80 text-slate-700'
                    : 'bg-indigo-50/50 border-indigo-200/80 text-slate-900 shadow-indigo-950/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.iconBg}`}
                    >
                      {config.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`text-sm ${
                            item.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                          }`}
                        >
                          {item.title}
                        </h3>
                        {config.badge}
                        {!item.isRead && (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-semibold">
                            New
                          </span>
                        )}
                      </div>
                      {/* Plain text message rendering - strictly no dangerouslySetInnerHTML */}
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>

                      {/* Navigation Link to Drive / Application */}
                      {config.link && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center">
                          <Link
                            to={config.link}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            <span>{config.linkText}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mark single as read */}
                  {!item.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(item._id)}
                      disabled={isItemUpdating}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                      title="Mark as read"
                    >
                      {isItemUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                      ) : (
                        <Check className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>Read</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
