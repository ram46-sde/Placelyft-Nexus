import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  FileCheck2,
  Sparkles,
  Inbox,
  Filter,
} from 'lucide-react';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import {
  groupNotificationsByTimeline,
  formatNotificationDate,
  getNotificationMetadata,
} from '../../utils/notificationUtils';

export { groupNotificationsByTimeline, formatNotificationDate, getNotificationMetadata };

const POLLING_INTERVAL_MS = 30000; // 30 seconds background polling

const ICON_MAP = {
  Award,
  FileCheck2,
  Briefcase,
  Bell,
  CheckCircle2,
  Sparkles,
};

/**
 * Resolves visual presentation, category badge, and navigation destination based on actual backend types.
 */
export const getNotificationConfig = (item = {}) => {
  const meta = getNotificationMetadata(item);
  return {
    ...meta,
    icon: ICON_MAP[meta.iconKey] || Bell,
    badgeIcon: ICON_MAP[meta.badgeIconKey] || Bell,
  };
};

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'UNREAD', label: 'Unread' },
  { id: 'DRIVES', label: 'Drives' },
  { id: 'APPLICATIONS', label: 'Applications' },
  { id: 'OUTCOMES', label: 'Outcomes' },
];

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');

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

  // Filtered notifications list based on active filter tab
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'UNREAD':
        return notifications.filter((n) => !n.isRead);
      case 'DRIVES':
        return notifications.filter((n) => n.type === 'DRIVE_ANNOUNCEMENT');
      case 'APPLICATIONS':
        return notifications.filter((n) => n.type === 'STATUS_UPDATE');
      case 'OUTCOMES':
        return notifications.filter((n) => n.type === 'OUTCOME_VERIFIED');
      case 'ALL':
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // Group filtered notifications by timeline
  const timelineGroups = useMemo(() => {
    return groupNotificationsByTimeline(filteredNotifications);
  }, [filteredNotifications]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-700 to-violet-600 text-white text-xs font-semibold shadow-xs">
                {unreadCount} unread
              </span>
            )}
            {refreshing && (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" title="Updating..." />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Stay updated on placement drives, application status changes, and verified recruitment outcomes.
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchNotifications(false)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center p-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 hover:text-slate-900 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer disabled:opacity-50 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            title="Refresh notifications"
            aria-label="Refresh notifications"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-600'}`}
              aria-hidden="true"
            />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-700 to-violet-600 hover:from-indigo-800 hover:to-violet-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow transition-all duration-150 cursor-pointer disabled:opacity-50 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {markingAllRead ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <CheckCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Error Feedback */}
      {error && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Unable to load notifications</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchNotifications(false)}
            className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Category & Read Filter Tabs */}
      {!loading && notifications.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              let count = null;
              if (tab.id === 'ALL') count = notifications.length;
              if (tab.id === 'UNREAD') count = unreadCount;
              if (tab.id === 'DRIVES')
                count = notifications.filter((n) => n.type === 'DRIVE_ANNOUNCEMENT').length;
              if (tab.id === 'APPLICATIONS')
                count = notifications.filter((n) => n.type === 'STATUS_UPDATE').length;
              if (tab.id === 'OUTCOMES')
                count = notifications.filter((n) => n.type === 'OUTCOME_VERIFIED').length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap min-h-[36px] ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== null && count > 0 && (
                    <span
                      className={`px-1.5 py-0.25 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Content States */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" aria-hidden="true" />
          <p className="text-sm text-slate-600 font-medium">Loading notification center...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving official announcements and status updates</p>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No notifications yet"
          description="You are all caught up! Official updates regarding placement drives, application status changes, and recruitment outcomes will appear here."
          action={
            <Link
              to="/student/drives"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-700 to-violet-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Placement Drives</span>
            </Link>
          }
        />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={activeFilter === 'UNREAD' ? 'All caught up!' : 'No matching notifications'}
          description={
            activeFilter === 'UNREAD'
              ? 'You have read all notifications. Switch to "All" to view past activity.'
              : 'There are no notifications matching the selected filter criteria.'
          }
          action={
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <span>View All Notifications</span>
            </button>
          }
        />
      ) : (
        /* 5. Notification Timeline Groups */
        <div className="space-y-6">
          {timelineGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              {/* Group Timeline Header */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {group.title}
                </span>
                <span className="px-1.5 py-0.25 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {group.items.length}
                </span>
                <div className="flex-1 h-px bg-slate-200/70" />
              </div>

              {/* Group Items */}
              <div className="space-y-2.5">
                {group.items.map((item) => {
                  const isItemUpdating = actionLoadingId === item._id;
                  const config = getNotificationConfig(item);
                  const Icon = config.icon;

                  return (
                    <div
                      key={item._id}
                      className={`relative p-4 sm:p-4.5 rounded-2xl border transition-all duration-150 ${
                        item.isRead
                          ? 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                          : 'bg-white border-slate-200/90 border-l-4 border-l-indigo-600 shadow-xs ring-1 ring-indigo-500/5 hover:shadow'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        {/* Notification Category Icon Box */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${config.iconBoxStyle}`}
                          aria-hidden="true"
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Notification Main Content */}
                        <div className="min-w-0 flex-1">
                          {/* Metadata Row: Category Badge, Unread Chip, Timestamp */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge
                              variant={config.badgeVariant}
                              icon={config.badgeIcon}
                              size="sm"
                            >
                              {config.category}
                            </Badge>

                            {!item.isRead && (
                              <span className="inline-flex items-center px-1.5 py-0.25 rounded-md bg-indigo-600 text-white text-[10px] font-bold tracking-wide shadow-2xs">
                                New
                              </span>
                            )}

                            <span className="text-[11px] text-slate-400 font-medium inline-flex items-center gap-1 ml-auto">
                              <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                              <span>{formatNotificationDate(item.createdAt)}</span>
                            </span>
                          </div>

                          {/* Title */}
                          <h3
                            className={`text-sm tracking-tight ${
                              item.isRead
                                ? 'font-semibold text-slate-800'
                                : 'font-bold text-slate-900'
                            }`}
                          >
                            {item.title}
                          </h3>

                          {/* Plain text message - safely rendered as text content */}
                          <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                            {item.message}
                          </p>

                          {/* Footer Action Bar: Destination Link */}
                          {config.link && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <Link
                                to={config.link}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                              >
                                <span>{config.linkText}</span>
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                              </Link>

                              {/* On Mobile: Mark as read button if unread */}
                              {!item.isRead && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsRead(item._id)}
                                  disabled={isItemUpdating}
                                  className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition cursor-pointer disabled:opacity-50 min-h-[32px]"
                                  title="Mark as read"
                                >
                                  {isItemUpdating ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                  ) : (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  )}
                                  <span>Mark read</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Desktop Mark as Read Action Button */}
                        {!item.isRead && (
                          <div className="hidden sm:block shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(item._id)}
                              disabled={isItemUpdating}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer disabled:opacity-50 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              title="Mark as read"
                            >
                              {isItemUpdating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>Mark read</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
