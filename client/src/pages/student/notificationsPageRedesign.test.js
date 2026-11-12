import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notificationsPagePath = path.join(__dirname, 'NotificationsPage.jsx');
const content = fs.readFileSync(notificationsPagePath, 'utf8');

test('1. NotificationsPage File Exists and Exports Default Component', () => {
  assert.ok(fs.existsSync(notificationsPagePath), 'NotificationsPage.jsx must exist');
  assert.ok(
    content.includes('export default NotificationsPage;'),
    'Must export NotificationsPage as default'
  );
});

test('2. Guard Test: Absolute Prohibition of Banned Wording', () => {
  const lines = content.split('\n');
  const bannedRegex = /\b(placed|joined|employed|offers accepted)\b/i;

  lines.forEach((line, idx) => {
    assert.ok(
      !bannedRegex.test(line),
      `Banned wording found in NotificationsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('3. Guard Test: No Hand-Built LPA or Cr Strings', () => {
  const lines = content.split('\n');
  const lpaCrRegex = /['"`][^'"`\n]*\b(?:LPA|Cr)\b[^'"`\n]*['"`]/;

  lines.forEach((line, idx) => {
    assert.ok(
      !lpaCrRegex.test(line),
      `Hand-built LPA/Cr string found in NotificationsPage.jsx:${idx + 1}: ${line.trim()}`
    );
  });
});

test('4. Notification Header: Heading, Subtitle, Dynamic Unread Badge, Refresh & Mark All as Read', () => {
  assert.ok(
    content.includes('<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">\n              Notifications\n            </h1>') ||
      content.includes('Notifications') && content.includes('<h1'),
    'Must render clear Notifications heading'
  );

  // Dynamic unread badge
  assert.ok(
    content.includes('{unreadCount} unread'),
    'Must display dynamic unread count pill badge'
  );

  // Refresh action button
  assert.ok(
    content.includes('RefreshCw'),
    'Must provide RefreshCw icon button'
  );
  assert.ok(
    content.includes('onClick={() => fetchNotifications(false)}'),
    'Must wire refresh button to fetchNotifications'
  );

  // Mark all as read button
  assert.ok(
    content.includes('CheckCheck'),
    'Must use CheckCheck icon for Mark all as read'
  );
  assert.ok(
    content.includes('onClick={handleMarkAllAsRead}'),
    'Must wire Mark all as read button'
  );
  assert.ok(
    content.includes('disabled={markingAllRead}'),
    'Must disable Mark all as read during API call'
  );
});

const utilsPath = path.join(__dirname, '../../utils/notificationUtils.js');
const utilsContent = fs.readFileSync(utilsPath, 'utf8');

test('5. Notification Categories: Mapped to Actual Backend Types', () => {
  const combinedContent = content + '\n' + utilsContent;
  assert.ok(
    combinedContent.includes('OUTCOME_VERIFIED'),
    'Must handle OUTCOME_VERIFIED notifications'
  );
  assert.ok(
    combinedContent.includes('STATUS_UPDATE'),
    'Must handle STATUS_UPDATE notifications'
  );
  assert.ok(
    combinedContent.includes('DRIVE_ANNOUNCEMENT'),
    'Must handle DRIVE_ANNOUNCEMENT notifications'
  );
  assert.ok(
    combinedContent.includes('SYSTEM'),
    'Must handle SYSTEM notifications'
  );
});

test('6. Notification Timeline: Today, Yesterday, and Earlier Grouping', () => {
  assert.ok(
    content.includes('groupNotificationsByTimeline'),
    'Must use groupNotificationsByTimeline helper'
  );
  assert.ok(
    content.includes('timelineGroups'),
    'Must calculate timelineGroups from filtered notifications'
  );
  assert.ok(
    content.includes('{group.title}'),
    'Must render timeline section titles (Today, Yesterday, Earlier)'
  );
  assert.ok(
    content.includes('{group.items.length}'),
    'Must render item counts for each timeline group'
  );
});

test('7. Category & Read Filter Tabs: All, Unread, Drives, Applications, Outcomes', () => {
  assert.ok(content.includes("id: 'ALL'"), 'Must support All filter');
  assert.ok(content.includes("id: 'UNREAD'"), 'Must support Unread filter');
  assert.ok(content.includes("id: 'DRIVES'"), 'Must support Drives filter');
  assert.ok(content.includes("id: 'APPLICATIONS'"), 'Must support Applications filter');
  assert.ok(content.includes("id: 'OUTCOMES'"), 'Must support Outcomes filter');
  assert.ok(content.includes('setActiveFilter'), 'Must manage active filter state');
});

test('8. Unread Visual Differentiation: Left Border Accent, "New" Chip & Mark as Read', () => {
  // Visual accent
  assert.ok(
    content.includes('border-l-4 border-l-indigo-600'),
    'Must apply bold indigo left border accent on unread notifications'
  );

  // "New" badge
  assert.ok(
    content.includes('New'),
    'Must display "New" indicator on unread notifications'
  );

  // Single mark as read handlers
  assert.ok(
    content.includes('handleMarkAsRead(item._id)'),
    'Must support individual mark-as-read action'
  );
});

test('9. Functional Preservation: API Service Methods', () => {
  assert.ok(
    content.includes('notificationService.getNotifications()'),
    'Must call notificationService.getNotifications()'
  );
  assert.ok(
    content.includes('notificationService.markAsRead('),
    'Must call notificationService.markAsRead()'
  );
  assert.ok(
    content.includes('notificationService.markAllAsRead()'),
    'Must call notificationService.markAllAsRead()'
  );
});

test('10. Layout Synchronisation: Dispatches Custom Event', () => {
  assert.ok(
    content.includes("new CustomEvent('cpms_notifications_updated'"),
    'Must dispatch cpms_notifications_updated custom event'
  );
  assert.ok(
    content.includes('unreadCount: count'),
    'Must pass unreadCount in custom event detail'
  );
});

test('11. Background Polling: 30-Second Polling Interval', () => {
  assert.ok(
    content.includes('POLLING_INTERVAL_MS = 30000'),
    'Must configure polling interval to 30,000ms'
  );
  assert.ok(
    content.includes('setInterval'),
    'Must establish background polling interval'
  );
  assert.ok(
    content.includes('clearInterval'),
    'Must clean up interval on unmount'
  );
});

test('12. Accessibility, Touch Targets & Semantic Standards', () => {
  assert.ok(
    content.includes('min-h-[44px]'),
    'Primary touch targets must have at least 44px min height'
  );
  assert.ok(
    content.includes('aria-label="Refresh notifications"'),
    'Refresh button must have descriptive aria-label'
  );
  assert.ok(
    content.includes('role="status"'),
    'Error banner must have role="status"'
  );
});

test('13. Security: Zero dangerouslySetInnerHTML', () => {
  assert.ok(
    !content.includes('dangerouslySetInnerHTML'),
    'Must not use dangerouslySetInnerHTML'
  );
});
