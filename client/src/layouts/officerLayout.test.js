import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const layoutPath = path.join(__dirname, 'OfficerLayout.jsx');
const appPath = path.join(__dirname, '../App.jsx');
const content = fs.readFileSync(layoutPath, 'utf8');
const appContent = fs.readFileSync(appPath, 'utf8');

test('1. OfficerLayout File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(layoutPath), 'OfficerLayout.jsx must exist');
  assert.ok(
    content.includes('export default OfficerLayout;'),
    'Must export OfficerLayout as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in OfficerLayout.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in OfficerLayout.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Desktop Sidebar: Dimensions, Collapse State & Persistence', () => {
  // Expanded width 256px (w-64) and collapsed width 72px (w-[72px])
  assert.ok(content.includes("w-[72px]' : 'w-64'"), 'Sidebar must toggle between w-[72px] and w-64');
  assert.ok(
    content.includes("localStorage.getItem('cpms_officer_sidebar_collapsed')"),
    'Must read collapsed preference from localStorage'
  );
  assert.ok(
    content.includes("localStorage.setItem('cpms_officer_sidebar_collapsed'"),
    'Must persist collapsed preference to localStorage'
  );
  assert.ok(
    content.includes('toggleSidebarCollapse'),
    'Must provide collapse toggle handler'
  );
});

test('5. Branding & Visual System: Placelyft Nexus Officer Green Theme', () => {
  assert.ok(content.includes('PlacelyftLogo'), 'Must import and render PlacelyftLogo');
  assert.ok(content.includes('Placelyft Nexus'), 'Must display Placelyft Nexus brand name');
  assert.ok(content.includes('Officer Portal'), 'Must display Officer Portal pill badge');
  assert.ok(
    content.includes('from-emerald-800 to-emerald-600'),
    'Must use Officer emerald-green brand gradient'
  );
  assert.ok(
    content.includes('border-l-emerald-600') && content.includes('text-emerald-800'),
    'Must use emerald green palette for active navigation states'
  );
  assert.ok(
    !/indigo|violet|purple/i.test(content),
    'OfficerLayout must have zero violet/indigo theme classes'
  );
});

test('6. Sidebar Navigation Items: Complete Information Architecture', () => {
  assert.ok(content.includes("label: 'Dashboard'"), 'Must include Dashboard nav item');
  assert.ok(content.includes("path: '/officer/dashboard'"), 'Must link Dashboard to /officer/dashboard');

  assert.ok(content.includes("label: 'Placement Drives'"), 'Must include Placement Drives nav item');
  assert.ok(content.includes("label: 'Applicants'"), 'Must include Applicants nav item');
  assert.ok(content.includes("label: 'Attendance'"), 'Must include Attendance nav item');
  assert.ok(content.includes("label: 'Departments'"), 'Must include Departments nav item');
  assert.ok(content.includes("label: 'Placement Outcomes'"), 'Must include Placement Outcomes nav item');
});

test('7. Route Integrity: Non-Implemented Routes Disabled with Soon Badges', () => {
  // Verifies that unbuilt pages are not exposed as broken links
  assert.ok(
    content.includes("badge: 'Soon'"),
    'Must render Soon badge on upcoming independent routes'
  );
  assert.ok(
    content.includes('aria-disabled="true"'),
    'Disabled items must have aria-disabled="true"'
  );
  assert.ok(
    content.includes('cursor-not-allowed'),
    'Disabled items must indicate not-allowed cursor'
  );
});

test('8. Drive Attendance Route Detection', () => {
  assert.ok(
    content.includes("location.pathname.includes('/attendance')"),
    'Must detect active attendance route from URL'
  );
  assert.ok(
    content.includes('isAttendanceRoute'),
    'Must highlight attendance item when on attendance route'
  );
});

test('9. Top Navigation Bar: Dynamic Header, Profile Identity & Institution', () => {
  assert.ok(
    content.includes('headerInfo.title'),
    'Top bar must render dynamic page title'
  );
  assert.ok(
    content.includes('headerInfo.breadcrumb'),
    'Top bar must render breadcrumb hierarchy'
  );
  assert.ok(
    content.includes('Placement Officer'),
    'Top bar must show Placement Officer role badge'
  );
  assert.ok(
    content.includes('institutionName'),
    'Top bar must render institution name only when available'
  );
  assert.ok(
    content.includes('profileMenuOpen'),
    'Top bar must support interactive profile popover menu'
  );
});

test('10. Mobile Drawer: Hamburger, Slide-Over, Focus Trap & Touch Targets', () => {
  assert.ok(
    content.includes('mobileDrawerOpen'),
    'Must manage mobile drawer open/close state'
  );
  assert.ok(
    content.includes('lg:hidden'),
    'Mobile drawer and toggle must be hidden on desktop (lg:hidden)'
  );
  assert.ok(
    content.includes('min-h-[44px]'),
    'Interactive elements must enforce 44px minimum touch target height'
  );
  assert.ok(
    content.includes("e.key === 'Escape'"),
    'Mobile drawer must close on Escape key'
  );
  assert.ok(
    content.includes('role="dialog"'),
    'Mobile drawer must have role="dialog"'
  );
});

test('11. Authentication & Sign-Out Integration', () => {
  assert.ok(
    content.includes('logout()'),
    'Sign-out action must invoke authContext logout()'
  );
  assert.ok(
    content.includes("navigate('/placement-officer/login')"),
    'Sign-out must redirect directly to /placement-officer/login'
  );
});

test('12. Content Layout & Outlet', () => {
  assert.ok(
    content.includes('<Outlet />'),
    'Layout must render child routes through <Outlet />'
  );
  assert.ok(
    content.includes('href="#main-content"'),
    'Must provide skip-to-content accessibility link'
  );
  assert.ok(
    content.includes('id="main-content"'),
    'Main container must have id="main-content"'
  );
});

test('13. App.jsx Route Integration', () => {
  assert.ok(
    appContent.includes("import OfficerLayout from './layouts/OfficerLayout';"),
    'App.jsx must import OfficerLayout'
  );
  assert.ok(
    appContent.includes('<Route element={<OfficerLayout />}>'),
    'App.jsx must wrap officer routes in <OfficerLayout />'
  );
  assert.ok(
    appContent.includes("allowedRoles={['placement_officer']}"),
    'App.jsx must preserve placement_officer role protection'
  );
  assert.ok(
    appContent.includes('loginPath="/placement-officer/login"'),
    'App.jsx must preserve loginPath="/placement-officer/login"'
  );
  assert.ok(
    appContent.includes('path="dashboard" element={<OfficerDashboardPage />}'),
    'App.jsx must preserve dashboard route'
  );
  assert.ok(
    appContent.includes('path="drives/:id/attendance" element={<DriveAttendancePage />}'),
    'App.jsx must preserve drives/:id/attendance route'
  );
});

