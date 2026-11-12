import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { dashboardService } from '../services/dashboardService';
import PlacelyftLogo from '../components/common/PlacelyftLogo';
import { getDepartmentLabel } from '../utils/studentProfileUtils';
import {
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

/**
 * Single source of truth for student navigation items.
 * Strictly includes ONLY existing student routes.
 */
const STUDENT_NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/student/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Placement Drives',
    path: '/student/drives',
    icon: Briefcase,
    hasNewBadge: true,
  },
  {
    label: 'My Applications',
    path: '/student/applications',
    icon: FileCheck2,
  },
  {
    label: 'Profile',
    path: '/student/profile',
    icon: User,
  },
  {
    label: 'Notifications',
    path: '/student/notifications',
    icon: Bell,
    hasCountBadge: true,
  },
];

/**
 * Returns human-readable page title based on current pathname.
 */
const getPageTitle = (pathname) => {
  if (pathname.startsWith('/student/dashboard')) return 'Dashboard';
  if (pathname === '/student/drives') return 'Placement Drives';
  if (pathname.startsWith('/student/drives/')) return 'Drive Details';
  if (pathname.startsWith('/student/applications')) return 'My Applications';
  if (pathname.startsWith('/student/profile')) return 'Student Profile';
  if (pathname.startsWith('/student/notifications')) return 'Notifications';
  return 'Student Portal';
};

const StudentLayout = () => {
  const { user, logout, studentProfile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const departmentLabel = getDepartmentLabel(studentProfile);

  // Authenticated student profile photo URL with fallback
  const avatarPhotoUrl = studentProfile?.profilePhotoUrl || user?.profilePhotoUrl || null;
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Reset image error state whenever avatar URL changes (e.g. after fresh upload or login)
  useEffect(() => {
    setAvatarImgError(false);
  }, [avatarPhotoUrl]);

  // Desktop sidebar collapsed state with try/catch-guarded localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cpms_student_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Profile dropdown menu state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const drawerRef = useRef(null);

  // Badges state
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewDrives, setHasNewDrives] = useState(false);

  // Toggle sidebar collapse and persist
  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cpms_student_sidebar_collapsed', String(next));
      } catch {
        // Silently catch private-browsing storage quota errors
      }
      return next;
    });
  };

  // Coordinated notification polling and custom event listening
  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      if (location.pathname === '/student/notifications') {
        return;
      }
      try {
        const data = await notificationService.getNotifications();
        if (isMounted && data.success) {
          const count =
            data.unreadCount ??
            (data.notifications || []).filter((n) => !n.isRead).length;
          setUnreadCount(count);
        }
      } catch {
        // Silently catch background badge polling errors
      }
    };

    const checkDrivesWatermark = async () => {
      if (!user?._id) return;
      if (location.pathname === '/student/drives') {
        setHasNewDrives(false);
        return;
      }
      try {
        const data = await dashboardService.getSummary();
        if (isMounted && data.success && data.latestDriveCreatedAt) {
          const watermark = localStorage.getItem(`cpms_drives_watermark_${user._id}`);
          if (!watermark) {
            setHasNewDrives(true);
          } else {
            setHasNewDrives(
              new Date(data.latestDriveCreatedAt).getTime() >
                new Date(watermark).getTime()
            );
          }
        }
      } catch {
        // Silently catch background watermark polling errors
      }
    };

    fetchUnreadCount();
    checkDrivesWatermark();

    // 30s background badge polling interval
    const intervalId = setInterval(() => {
      fetchUnreadCount();
      checkDrivesWatermark();
    }, 30000);

    // Listen for custom events dispatched by NotificationsPage and DrivesPage
    const handleNotificationUpdate = (e) => {
      if (typeof e.detail?.unreadCount === 'number' && isMounted) {
        setUnreadCount(e.detail.unreadCount);
      }
    };

    const handleWatermarkUpdate = (e) => {
      if (isMounted) {
        setHasNewDrives(!!e.detail?.hasNewDrives);
      }
    };

    window.addEventListener('cpms_notifications_updated', handleNotificationUpdate);
    window.addEventListener('cpms_drives_watermark_updated', handleWatermarkUpdate);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('cpms_notifications_updated', handleNotificationUpdate);
      window.removeEventListener('cpms_drives_watermark_updated', handleWatermarkUpdate);
    };
  }, [location.pathname, user?._id]);

  // Handle outside click to close profile menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setMobileDrawerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Focus trap for mobile drawer when opened
  useEffect(() => {
    if (mobileDrawerOpen && drawerRef.current) {
      const focusableEls = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length > 0) {
        focusableEls[0].focus();
      }
    }
  }, [mobileDrawerOpen]);

  const handleLogout = () => {
    setProfileMenuOpen(false);
    logout();
    navigate('/');
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Skip to Content Accessibility Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 text-sm font-semibold"
      >
        Skip to content
      </a>

      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (lg:flex) */}
        <aside
          aria-label="Student navigation sidebar"
          className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200 transition-all duration-150 ease-in-out motion-reduce:transition-none ${
            isCollapsed ? 'w-[72px]' : 'w-64'
          }`}
        >
          {/* Sidebar Header / Wordmark */}
          <div className="h-16 flex items-center px-4 border-b border-slate-200 justify-between">
            <div
              className="flex items-center gap-3 min-w-0 overflow-hidden"
              {...(isCollapsed ? { role: 'img', 'aria-label': 'Placelyft Nexus' } : {})}
            >
              <div
                className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm"
                aria-hidden={!isCollapsed}
              >
                <PlacelyftLogo className="w-6 h-6" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 overflow-hidden whitespace-nowrap">
                  <span className="font-bold text-slate-900 text-base leading-tight block truncate">
                    Placelyft Nexus
                  </span>
                  <span className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wider block truncate">
                    Student Portal
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {STUDENT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center min-h-[44px] rounded-lg text-sm font-medium transition duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                      isCollapsed
                        ? 'justify-center px-2 py-2.5'
                        : 'gap-3 px-3.5 py-2.5'
                    } ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative shrink-0">
                        <Icon
                          className={`w-5 h-5 ${
                            isActive ? 'text-indigo-600' : 'text-slate-500'
                          }`}
                          aria-hidden="true"
                        />
                        {/* Dot indicator on collapsed sidebar */}
                        {isCollapsed && item.hasNewBadge && hasNewDrives && (
                          <span
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white"
                            title="New Drives Available"
                          />
                        )}
                        {isCollapsed && item.hasCountBadge && unreadCount > 0 && (
                          <span
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white"
                            title={`${unreadCount} unread notifications`}
                          />
                        )}
                      </div>

                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}

                      {!isCollapsed && item.hasNewBadge && hasNewDrives && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          NEW
                        </span>
                      )}

                      {!isCollapsed && item.hasCountBadge && unreadCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold leading-none bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 tabular-nums">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Sidebar Collapse Toggle Button */}
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={toggleSidebarCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center min-h-[44px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
              }`}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-600 truncate">
                    Collapse sidebar
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Content Area (offset by sidebar width on lg) */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-150 ease-in-out motion-reduce:transition-none ${
            isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
          }`}
        >
          {/* Top Bar Header */}
          <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Drawer Toggle */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-expanded={mobileDrawerOpen}
                aria-controls="mobile-navigation-drawer"
                aria-label="Open navigation menu"
                className="lg:hidden p-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* Page Title */}
              <h1 className="text-lg sm:text-xl font-semibold leading-7 text-slate-900 truncate">
                {pageTitle}
              </h1>
            </div>

            {/* Top Bar Right: Notifications & User Profile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notification Bell Shortcut */}
              <NavLink
                to="/student/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
                className="relative p-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition duration-150 ease-in-out min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600 ring-2 ring-white" />
                  </span>
                )}
              </NavLink>

              {/* User Profile Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="true"
                  aria-label="User profile menu"
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 transition duration-150 ease-in-out min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  {avatarPhotoUrl && !avatarImgError ? (
                    <img
                      src={avatarPhotoUrl}
                      alt={user?.name || 'Student profile photo'}
                      onError={() => setAvatarImgError(true)}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100 shrink-0 border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-700 to-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ring-2 ring-indigo-100">
                      {user?.name?.charAt(0).toUpperCase() || 'S'}
                    </div>
                  )}
                  <div className="hidden sm:block text-left min-w-0 max-w-[150px]">
                    <div className="text-xs font-semibold text-slate-800 truncate" title={user?.name || 'Student'}>
                      {user?.name || 'Student'}
                    </div>
                    {profileLoading ? (
                      <div
                        className="h-3.5 w-16 bg-slate-200 animate-pulse rounded mt-0.5 motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <div
                        className="text-[10px] text-slate-500 font-medium truncate"
                        title={departmentLabel}
                      >
                        {departmentLabel}
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                      profileMenuOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* Profile Dropdown Popover */}
                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-40 focus:outline-none animate-in fade-in-50 duration-150"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>

                    <div className="py-1">
                      <NavLink
                        to="/student/profile"
                        onClick={() => setProfileMenuOpen(false)}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition min-h-[38px]"
                      >
                        <User className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>View Profile</span>
                      </NavLink>
                      <NavLink
                        to="/student/notifications"
                        onClick={() => setProfileMenuOpen(false)}
                        role="menuitem"
                        className="flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition min-h-[38px]"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <span>Notifications</span>
                        </div>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums">
                            {unreadCount}
                          </span>
                        )}
                      </NavLink>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        role="menuitem"
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition min-h-[38px] text-left"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content Body */}
          <main
            id="main-content"
            tabIndex="-1"
            className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 outline-none"
          >
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
            College Placement Management System &bull; Student Portal
          </footer>
        </div>
      </div>

      {/* Accessible Mobile Drawer (<1024px) */}
      {mobileDrawerOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          className="lg:hidden fixed inset-0 z-50 flex"
          ref={drawerRef}
        >
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-150"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl z-10">
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden whitespace-nowrap">
                <div
                  className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm"
                  aria-hidden="true"
                >
                  <PlacelyftLogo className="w-5 h-5" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <span className="font-bold text-slate-900 text-base leading-tight block truncate">
                    Placelyft Nexus
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider block truncate">
                    Student Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="p-2.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* User Profile Card inside Drawer */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                {avatarPhotoUrl && !avatarImgError ? (
                  <img
                    src={avatarPhotoUrl}
                    alt={user?.name || 'Student profile photo'}
                    onError={() => setAvatarImgError(true)}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100 shrink-0 border border-slate-200 shadow-2xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-700 to-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ring-2 ring-indigo-100">
                    {user?.name?.charAt(0).toUpperCase() || 'S'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {user?.name || 'Student'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {STUDENT_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition duration-150 min-h-[44px] ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-5 h-5 ${
                            isActive ? 'text-indigo-600' : 'text-slate-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{item.label}</span>

                        {item.hasNewBadge && hasNewDrives && (
                          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold leading-none bg-emerald-50 text-emerald-700 border border-emerald-200">
                            NEW
                          </span>
                        )}

                        {item.hasCountBadge && unreadCount > 0 && (
                          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold leading-none bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Drawer Footer Sign Out */}
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition min-h-[44px]"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLayout;
