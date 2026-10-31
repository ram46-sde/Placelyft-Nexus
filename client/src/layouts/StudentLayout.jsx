import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { dashboardService } from '../services/dashboardService';
import {
  GraduationCap,
  LayoutDashboard,
  Briefcase,
  FileCheck2,
  User,
  Bell,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const StudentLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewDrives, setHasNewDrives] = useState(false);

  // Coordinated notification polling and custom event listening
  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      // If currently on notifications page, that page handles fetching and dispatches the count
      if (location.pathname === '/student/notifications') {
        return;
      }
      try {
        const data = await notificationService.getNotifications();
        if (isMounted && data.success) {
          const count = data.unreadCount ?? (data.notifications || []).filter((n) => !n.isRead).length;
          setUnreadCount(count);
        }
      } catch (err) {
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
            setHasNewDrives(new Date(data.latestDriveCreatedAt).getTime() > new Date(watermark).getTime());
          }
        }
      } catch (err) {
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

    // Listen for real-time notification update events dispatched by NotificationsPage
    const handleNotificationUpdate = (e) => {
      if (typeof e.detail?.unreadCount === 'number' && isMounted) {
        setUnreadCount(e.detail.unreadCount);
      }
    };

    // Listen for drives watermark updates dispatched by DrivesPage
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    {
      label: 'Placement Drives',
      path: '/student/drives',
      icon: Briefcase,
      badge: hasNewDrives ? 'NEW' : null,
      badgeColor: 'bg-emerald-600 text-white shadow-xs',
    },
    { label: 'My Applications', path: '/student/applications', icon: FileCheck2 },
    { label: 'Profile', path: '/student/profile', icon: User },
    {
      label: 'Notifications',
      path: '/student/notifications',
      icon: Bell,
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null,
      badgeColor: 'bg-indigo-600 text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Portal Label */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg leading-tight block">CPMS</span>
                <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider block">Student Portal</span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${item.badgeColor || 'bg-indigo-600 text-white'}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* User Profile & Logout */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="text-left pr-1">
                  <div className="text-xs font-semibold text-slate-800 leading-none">{user?.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium leading-tight">Student</div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1">
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'S'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
                <div className="text-xs text-slate-500">{user?.email}</div>
              </div>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold leading-none ${item.badgeColor || 'bg-indigo-600 text-white'}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        College Placement Management System &bull; Student Portal
      </footer>
    </div>
  );
};

export default StudentLayout;
