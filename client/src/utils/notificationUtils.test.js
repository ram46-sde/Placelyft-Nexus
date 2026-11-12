import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupNotificationsByTimeline,
  formatNotificationDate,
  getNotificationMetadata,
} from './notificationUtils.js';

test('1. groupNotificationsByTimeline - handles null, undefined and empty array', () => {
  assert.deepEqual(groupNotificationsByTimeline(null), []);
  assert.deepEqual(groupNotificationsByTimeline(undefined), []);
  assert.deepEqual(groupNotificationsByTimeline([]), []);
  assert.deepEqual(groupNotificationsByTimeline('not an array'), []);
});

test('2. groupNotificationsByTimeline - groups into Today, Yesterday, and Earlier correctly', () => {
  // Use a fixed reference point: 2026-11-12 14:00:00 local time
  const refDate = new Date(2026, 10, 12, 14, 0, 0); // Month is 0-indexed: 10 = Nov
  const todayItem = {
    _id: 'n1',
    title: 'Drive Started',
    createdAt: new Date(2026, 10, 12, 9, 30, 0).toISOString(),
  };
  const yesterdayItem = {
    _id: 'n2',
    title: 'Status Updated',
    createdAt: new Date(2026, 10, 11, 16, 0, 0).toISOString(),
  };
  const earlierItem = {
    _id: 'n3',
    title: 'System Notice',
    createdAt: new Date(2026, 10, 5, 11, 0, 0).toISOString(),
  };
  const noDateItem = {
    _id: 'n4',
    title: 'No Date Notice',
  };

  const groups = groupNotificationsByTimeline(
    [todayItem, yesterdayItem, earlierItem, noDateItem],
    refDate
  );

  assert.equal(groups.length, 3);
  assert.equal(groups[0].title, 'Today');
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].items[0]._id, 'n1');

  assert.equal(groups[1].title, 'Yesterday');
  assert.equal(groups[1].items.length, 1);
  assert.equal(groups[1].items[0]._id, 'n2');

  assert.equal(groups[2].title, 'Earlier');
  assert.equal(groups[2].items.length, 2);
  assert.equal(groups[2].items[0]._id, 'n3');
  assert.equal(groups[2].items[1]._id, 'n4');
});

test('3. groupNotificationsByTimeline - omits empty groups', () => {
  const refDate = new Date(2026, 10, 12, 14, 0, 0);
  const onlyToday = [
    {
      _id: 'n1',
      title: 'Drive Today',
      createdAt: new Date(2026, 10, 12, 10, 0, 0).toISOString(),
    },
  ];

  const groups = groupNotificationsByTimeline(onlyToday, refDate);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Today');
});

test('4. formatNotificationDate - handles falsy or invalid dates', () => {
  assert.equal(formatNotificationDate(null), '');
  assert.equal(formatNotificationDate(undefined), '');
  assert.equal(formatNotificationDate(''), '');
  assert.equal(formatNotificationDate('invalid-date-string'), '');
});

test('5. formatNotificationDate - formats Today, Yesterday, and Earlier dates', () => {
  const refDate = new Date(2026, 10, 12, 14, 0, 0);

  const todayDate = new Date(2026, 10, 12, 9, 30, 0);
  const formattedToday = formatNotificationDate(todayDate.toISOString(), refDate);
  assert.ok(formattedToday.startsWith('Today at '), `Expected 'Today at ...', got: ${formattedToday}`);

  const yesterdayDate = new Date(2026, 10, 11, 15, 45, 0);
  const formattedYesterday = formatNotificationDate(yesterdayDate.toISOString(), refDate);
  assert.ok(
    formattedYesterday.startsWith('Yesterday at '),
    `Expected 'Yesterday at ...', got: ${formattedYesterday}`
  );

  const earlierDate = new Date(2026, 9, 15, 11, 0, 0);
  const formattedEarlier = formatNotificationDate(earlierDate.toISOString(), refDate);
  assert.ok(
    formattedEarlier.includes('Oct 15, 2026 at '),
    `Expected 'Oct 15, 2026 at ...', got: ${formattedEarlier}`
  );
});

test('6. getNotificationMetadata - OUTCOME_VERIFIED mapping', () => {
  const metaWithId = getNotificationMetadata({
    type: 'OUTCOME_VERIFIED',
    placementDrive: 'drive123',
  });
  assert.equal(metaWithId.category, 'Verified Outcome');
  assert.equal(metaWithId.badgeVariant, 'teal');
  assert.equal(metaWithId.iconKey, 'Award');
  assert.equal(metaWithId.badgeIconKey, 'CheckCircle2');
  assert.equal(metaWithId.link, '/student/drives/drive123');
  assert.equal(metaWithId.linkText, 'View Outcome');

  const metaPopulated = getNotificationMetadata({
    type: 'OUTCOME_VERIFIED',
    placementDrive: { _id: 'drive456', companyName: 'Acme Corp' },
  });
  assert.equal(metaPopulated.link, '/student/drives/drive456');

  const metaNoDrive = getNotificationMetadata({
    type: 'OUTCOME_VERIFIED',
  });
  assert.equal(metaNoDrive.link, '/student/applications');
});

test('7. getNotificationMetadata - STATUS_UPDATE mapping', () => {
  const meta = getNotificationMetadata({
    type: 'STATUS_UPDATE',
    placementDrive: 'drive789',
  });
  assert.equal(meta.category, 'Application Update');
  assert.equal(meta.badgeVariant, 'indigo');
  assert.equal(meta.iconKey, 'FileCheck2');
  assert.equal(meta.link, '/student/drives/drive789');
  assert.equal(meta.linkText, 'View Application');
});

test('8. getNotificationMetadata - DRIVE_ANNOUNCEMENT mapping', () => {
  const metaWithDrive = getNotificationMetadata({
    type: 'DRIVE_ANNOUNCEMENT',
    placementDrive: 'drive999',
  });
  assert.equal(metaWithDrive.category, 'Placement Drive');
  assert.equal(metaWithDrive.badgeVariant, 'indigo');
  assert.equal(metaWithDrive.iconKey, 'Briefcase');
  assert.equal(metaWithDrive.link, '/student/drives/drive999');
  assert.equal(metaWithDrive.linkText, 'Explore Drive');

  const metaNoDrive = getNotificationMetadata({
    type: 'DRIVE_ANNOUNCEMENT',
  });
  assert.equal(metaNoDrive.link, '/student/drives');
});

test('9. getNotificationMetadata - SYSTEM announcement mapping', () => {
  const meta = getNotificationMetadata({
    type: 'SYSTEM',
  });
  assert.equal(meta.category, 'Announcement');
  assert.equal(meta.badgeVariant, 'sky');
  assert.equal(meta.iconKey, 'Bell');
  assert.equal(meta.link, '/student/dashboard');
  assert.equal(meta.linkText, 'View Dashboard');
});

test('10. getNotificationMetadata - Unknown or undefined type defaults to Notice', () => {
  const meta = getNotificationMetadata({});
  assert.equal(meta.category, 'Notice');
  assert.equal(meta.badgeVariant, 'slate');
  assert.equal(meta.iconKey, 'Bell');
  assert.equal(meta.link, '/student/dashboard');
});

