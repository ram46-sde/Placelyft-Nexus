import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PlacelyftLogo from '../components/common/PlacelyftLogo';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ClipboardCheck,
  Building2,
  Award,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

/**
 * Single source of truth for Officer Portal navigation entries.
 * Connects genuinely supported routes and marks upcoming step-by-step
 * modules as disabled until their dedicated pages are implemented.
 */
const OFFICER_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/officer/dashboard',
    icon: LayoutDashboard,
    isImplemented: true,
  },
  {
    id: 'drives',
    label: 'Placement Drives',
    path: '/officer/drives',
    icon: Briefcase,
    isImplemented: true,
  },
  {
    id: 'applicants',
    label: 'Applicants',
    path: '/officer/applicants',
    icon: Users,
    isImplemented: false,
    badge: 'Soon',
    tooltip: 'Dedicated Applicant Management coming in Step 4',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/officer/attendance',
    icon: ClipboardCheck,
    isImplemented: false,
    badge: 'Active on Drive',
    isAttendance: true,
    tooltip: 'Open Attendance directly from any drive card on Dashboard',
  },
  {
    id: 'departments',
    label: 'Departments',
    path: '/officer/departments',
    icon: Building2,
    isImplemented: false,
    badge: 'Soon',
    tooltip: 'Dedicated Department Management page coming in Step 6',
  },
  {
    id: 'outcomes',
    label: 'Placement Outcomes',
    path: '/officer/outcomes',
    icon: Award,
    isImplemented: false,
    badge: 'Soon',
    tooltip: 'Dedicated Outcomes Center coming in Step 7 (view outcomes on Dashboard)',
  },
];

/**
 * Returns human-readable page title and breadcrumb info based on current route.
 */
const getPageHeaderInfo = (pathname) => {
  if (pathname.includes('/attendance')) {
    return {
      title: 'Drive Attendance',
      breadcrumb: [
        { label: 'Placement Drives', path: '/officer/drives' },
        { label: 'Drive Attendance', path: null },
      ],
    };
  }
  if (pathname.startsWith('/officer/drives')) {
    return {
      title: 'Placement Drives',
      breadcrumb: [
        { label: 'Dashboard', path: '/officer/dashboard' },
        { label: 'Placement Drives', path: null },
      ],
    };
  }
  if (pathname.startsWith('/officer/dashboard')) {
    return {
      title: 'Officer Dashboard',
      breadcrumb: [{ label: 'Placement Officer Portal', path: null }],
    };
  }
  return {
    title: 'Placement Officer Portal',
    breadcrumb: [{ label: 'Home', path: '/officer/dashboard' }],
  };
};

const OfficerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop sidebar collapsed state with try/catch-guarded localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cpms_officer_sidebar_collapsed') === 'true';
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

  // Toggle sidebar collapse and persist to storage
  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cpms_officer_sidebar_collapsed', String(next));
      } catch {
        // Silently catch private-browsing storage quota errors
      }
      return next;
    });
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen]);

  // Handle ESC key to close mobile drawer and focus management
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    if (mobileDrawerOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  // Focus trap for mobile drawer
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
    navigate('/placement-officer/login');
  };

  const headerInfo = getPageHeaderInfo(location.pathname);
  const isAttendanceRoute = location.pathname.includes('/attendance');

  // Institution name if available from existing authenticated data
  const institutionName =
    user?.collegeName ||
    (typeof user?.collegeId === 'object' && user?.collegeId?.name ? user.collegeId.name : null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Skip to Content Accessibility Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-lg focus:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 text-sm font-semibold"
      >
        Skip to content
      </a>

      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (lg:flex) */}
        <aside
          aria-label="Placement Officer navigation sidebar"
          className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200 transition-all duration-150 ease-in-out motion-reduce:transition-none ${
            isCollapsed ? 'w-[72px]' : 'w-64'
          }`}
        >
          {/* Sidebar Header / Placelyft Nexus Wordmark */}
          <div className="h-16 flex items-center px-4 border-b border-slate-200 justify-between">
            <div
              className="flex items-center gap-3 min-w-0 overflow-hidden"
              {...(isCollapsed ? { role: 'img', 'aria-label': 'Placelyft Nexus Officer Portal' } : {})}
            >
              <div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm"
                aria-hidden={!isCollapsed}
              >
                <PlacelyftLogo className="w-6 h-6" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 overflow-hidden whitespace-nowrap">
                  <span className="font-bold text-slate-900 text-base leading-tight block truncate">
                    Placelyft Nexus
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block bg-emerald-50 px-1.5 py-0.25 rounded border border-emerald-200">
                      Officer Portal
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
            {OFFICER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isItemActive =
                (item.id === 'dashboard' && location.pathname.startsWith('/officer/dashboard')) ||
                (item.id === 'drives' && location.pathname.startsWith('/officer/drives') && !isAttendanceRoute) ||
                (item.isAttendance && isAttendanceRoute);

              if (item.isImplemented) {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center min-h-[44px] rounded-xl text-sm font-medium transition duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                        isCollapsed
                          ? 'justify-center px-2 py-2.5'
                          : 'gap-3 px-3.5 py-2.5'
                      } ${
                        isActive || isItemActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-2xs border-l-3 border-l-emerald-600'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isItemActive ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 font-semibold">{item.label}</span>
                    )}
                  </NavLink>
                );
              }

              // Non-implemented or context-dependent route entries: rendered transparently without fake pages
              return (
                <div
                  key={item.id}
                  title={item.tooltip}
                  className={`flex items-center min-h-[44px] rounded-xl text-sm transition select-none ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
                  } ${
                    isItemActive
                      ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-3 border-l-emerald-600'
                      : 'text-slate-400 hover:bg-slate-50/60 cursor-not-allowed'
                  }`}
                  aria-disabled="true"
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isItemActive ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  {!isCollapsed && (
                    <>
                      <span className="truncate flex-1 text-slate-500">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border ${
                            isItemActive
                              ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200/80'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Collapse Toggle Button */}
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={toggleSidebarCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition duration-150 ease-in-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
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
              {/* Mobile Drawer Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-expanded={mobileDrawerOpen}
                aria-controls="mobile-navigation-drawer"
                aria-label="Open navigation menu"
                className="lg:hidden p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 cursor-pointer"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* Page Title & Breadcrumb */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5 truncate">
                  {headerInfo.breadcrumb.map((crumb, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5">
                      {crumb.path ? (
                        <Link
                          to={crumb.path}
                          className="hover:text-emerald-700 transition font-medium"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-slate-600 font-semibold">{crumb.label}</span>
                      )}
                      {idx < headerInfo.breadcrumb.length - 1 && (
                        <span className="text-slate-300">/</span>
                      )}
                    </span>
                  ))}
                </div>
                <h1 className="text-lg sm:text-xl font-bold leading-6 text-slate-900 tracking-tight truncate">
                  {headerInfo.title}
                </h1>
              </div>
            </div>

            {/* Top Bar Right: Institution Name & User Profile */}
            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
              {/* Institution Name Pill (only if authenticated data provides it) */}
              {institutionName && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/80">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[200px]" title={institutionName}>
                    {institutionName}
                  </span>
                </div>
              )}

              {/* User Profile Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="true"
                  aria-label="Placement Officer profile menu"
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 transition duration-150 ease-in-out min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ring-2 ring-emerald-100">
                    {user?.name?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <div className="hidden sm:block text-left min-w-0 max-w-[160px]">
                    <div
                      className="text-xs font-bold text-slate-900 truncate"
                      title={user?.name || 'Placement Officer'}
                    >
                      {user?.name || 'Placement Officer'}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                      <span>Placement Officer</span>
                    </div>
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
                    className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-40 focus:outline-none animate-in fade-in-50 duration-150"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user?.name || 'Placement Officer'}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Institutional Placement Cell
                      </div>
                    </div>

                    <div className="pt-1.5 px-1.5">
                      <button
                        type="button"
                        onClick={handleLogout}
                        role="menuitem"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition min-h-[38px] text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        <span>Sign Out of Portal</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main
            id="main-content"
            tabIndex="-1"
            className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 outline-none"
          >
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
            Placelyft Nexus &bull; Placement Officer Portal &bull; Multi-Tenant Campus Placement System
          </footer>
        </div>
      </div>

      {/* Mobile Drawer Slide-over (lg:hidden) */}
      {mobileDrawerOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-150"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={drawerRef}
            className="relative max-w-xs w-full bg-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200"
          >
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden whitespace-nowrap">
                <div
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm"
                  aria-hidden="true"
                >
                  <PlacelyftLogo className="w-5 h-5" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <span className="font-bold text-slate-900 text-base leading-tight block truncate">
                    Placelyft Nexus
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                    Officer Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Officer Profile Card inside Drawer */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ring-2 ring-emerald-100">
                  {user?.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {user?.name || 'Placement Officer'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  <span className="inline-block mt-1 px-2 py-0.25 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Placement Officer
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {OFFICER_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isItemActive =
                  (item.id === 'dashboard' && location.pathname.startsWith('/officer/dashboard')) ||
                  (item.id === 'drives' && location.pathname.startsWith('/officer/drives') && !isAttendanceRoute) ||
                  (item.isAttendance && isAttendanceRoute);

                if (item.isImplemented) {
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition duration-150 min-h-[44px] ${
                          isActive || isItemActive
                            ? 'bg-emerald-50 text-emerald-800 font-bold border-l-3 border-l-emerald-600 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          isItemActive ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </NavLink>
                  );
                }

                return (
                  <div
                    key={item.id}
                    title={item.tooltip}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition min-h-[44px] select-none ${
                      isItemActive
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-3 border-l-emerald-600'
                        : 'text-slate-400 opacity-70'
                    }`}
                    aria-disabled="true"
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isItemActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-slate-500">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border ${
                          isItemActive
                            ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200/80'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Drawer Sign Out */}
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition min-h-[44px] cursor-pointer"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>Sign Out of Portal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerLayout;

