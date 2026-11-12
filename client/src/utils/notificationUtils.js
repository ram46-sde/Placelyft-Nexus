/**
 * Utility helpers for notification timeline grouping, date formatting,
 * and category metadata resolution in the Placelyft Nexus Student Portal.
 */

/**
 * Groups notifications into Today, Yesterday, and Earlier based on local calendar dates.
 *
 * @param {Array<Object>} items - Array of notification objects
 * @param {Date} [referenceDate=new Date()] - Reference timestamp for deterministic testing
 * @returns {Array<{ title: string, items: Array<Object> }>}
 */
export const groupNotificationsByTimeline = (items = [], referenceDate = new Date()) => {
  if (!Array.isArray(items)) return [];

  const today = [];
  const yesterday = [];
  const earlier = [];

  const now =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000; // 24 hours prior

  items.forEach((item) => {
    if (!item?.createdAt) {
      earlier.push(item);
      return;
    }
    const itemTime = new Date(item.createdAt).getTime();
    if (isNaN(itemTime)) {
      earlier.push(item);
    } else if (itemTime >= todayStart) {
      today.push(item);
    } else if (itemTime >= yesterdayStart) {
      yesterday.push(item);
    } else {
      earlier.push(item);
    }
  });

  const groups = [];
  if (today.length > 0) groups.push({ title: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ title: 'Yesterday', items: yesterday });
  if (earlier.length > 0) groups.push({ title: 'Earlier', items: earlier });

  return groups;
};

/**
 * Human-readable timestamp formatter with local date awareness.
 *
 * @param {string|Date} dateString - Notification timestamp
 * @param {Date} [referenceDate=new Date()] - Reference timestamp for deterministic testing
 * @returns {string} Formatted timestamp
 */
export const formatNotificationDate = (dateString, referenceDate = new Date()) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const now =
    referenceDate instanceof Date && !isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const dTime = d.getTime();

  if (dTime >= todayStart) {
    return `Today at ${timeStr}`;
  }
  if (dTime >= yesterdayStart) {
    return `Yesterday at ${timeStr}`;
  }
  return `${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${timeStr}`;
};

/**
 * Resolves notification metadata based strictly on actual backend types.
 *
 * @param {Object} item - Notification object
 * @returns {Object} Metadata including category, badgeVariant, link, linkText, iconKey
 */
export const getNotificationMetadata = (item = {}) => {
  const driveId = item?.placementDrive
    ? typeof item.placementDrive === 'object'
      ? item.placementDrive._id
      : item.placementDrive
    : null;

  switch (item?.type) {
    case 'OUTCOME_VERIFIED':
      return {
        category: 'Verified Outcome',
        iconKey: 'Award',
        iconBoxStyle: 'bg-teal-50 text-teal-700 border border-teal-200/80',
        badgeVariant: 'teal',
        badgeIconKey: 'CheckCircle2',
        link: driveId ? `/student/drives/${driveId}` : '/student/applications',
        linkText: 'View Outcome',
      };
    case 'STATUS_UPDATE':
      return {
        category: 'Application Update',
        iconKey: 'FileCheck2',
        iconBoxStyle: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
        badgeVariant: 'indigo',
        badgeIconKey: 'FileCheck2',
        link: driveId ? `/student/drives/${driveId}` : '/student/applications',
        linkText: 'View Application',
      };
    case 'DRIVE_ANNOUNCEMENT':
      return {
        category: 'Placement Drive',
        iconKey: 'Briefcase',
        iconBoxStyle: 'bg-violet-50 text-violet-700 border border-violet-200/80',
        badgeVariant: 'indigo',
        badgeIconKey: 'Sparkles',
        link: driveId ? `/student/drives/${driveId}` : '/student/drives',
        linkText: 'Explore Drive',
      };
    case 'SYSTEM':
      return {
        category: 'Announcement',
        iconKey: 'Bell',
        iconBoxStyle: 'bg-sky-50 text-sky-700 border border-sky-200/80',
        badgeVariant: 'sky',
        badgeIconKey: 'Bell',
        link: '/student/dashboard',
        linkText: 'View Dashboard',
      };
    default:
      return {
        category: 'Notice',
        iconKey: 'Bell',
        iconBoxStyle: 'bg-slate-100 text-slate-700 border border-slate-200',
        badgeVariant: 'slate',
        badgeIconKey: 'Bell',
        link: '/student/dashboard',
        linkText: 'View Dashboard',
      };
  }
};

