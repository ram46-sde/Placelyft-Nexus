import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { notificationService } from '../../services/notificationService';
import { normalizeStudentOutcomes } from '../../utils/placementMetrics';
import WelcomeBanner from '../../components/student/dashboard/WelcomeBanner';
import DashboardKpiSection from '../../components/student/dashboard/DashboardKpiSection';
import VerifiedPlacementSection from '../../components/student/dashboard/VerifiedPlacementSection';
import ApplicationProgressSection from '../../components/student/dashboard/ApplicationProgressSection';
import LatestDrivesSection from '../../components/student/dashboard/LatestDrivesSection';
import RecentActivitySection from '../../components/student/dashboard/RecentActivitySection';

/**
 * Student Dashboard container component.
 * Responsible strictly for data orchestration, per-section error handling and retry callbacks.
 * Delegates all visual presentation to modular presentational sections.
 */
const DashboardPage = () => {
  const { user } = useAuth();

  // Metrics summary state
  const [summary, setSummary] = useState({
    totalEligibleDrives: 0,
    registeredApplications: 0,
    inProgressApplications: 0,
    selectedApplications: 0,
  });
  const [latestDrives, setLatestDrives] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  // Student verified outcomes state
  const [studentOutcomes, setStudentOutcomes] = useState({
    verifiedOutcomes: [],
    pendingSelections: [],
    pendingSelectionsCount: 0,
  });
  const [outcomesLoading, setOutcomesLoading] = useState(true);
  const [outcomesError, setOutcomesError] = useState(null);

  // Recent notifications state
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState(null);

  // 1. Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const data = await dashboardService.getSummary();
      if (data && data.success) {
        setSummary({
          totalEligibleDrives: data.totalEligibleDrives ?? data.summary?.totalEligibleDrives ?? 0,
          registeredApplications: data.registeredApplications ?? data.summary?.registeredApplications ?? 0,
          inProgressApplications: data.inProgressApplications ?? data.summary?.inProgressApplications ?? 0,
          selectedApplications: data.selectedApplications ?? data.summary?.selectedApplications ?? 0,
        });
        setLatestDrives(data.latestDrives || []);

        // Fallback for outcomes if outcomes endpoint has not loaded yet
        if (data.verifiedOutcomes || data.pendingSelections) {
          setStudentOutcomes((prev) =>
            prev.verifiedOutcomes.length === 0 ? normalizeStudentOutcomes(data) : prev
          );
        }
      } else {
        setSummaryError(data?.message || 'Unable to load dashboard summary metrics.');
      }
    } catch (err) {
      setSummaryError(
        err.response?.data?.message ||
          'Unable to load dashboard summary metrics. Please retry.'
      );
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // 2. Fetch Outcomes
  const fetchOutcomes = useCallback(async () => {
    try {
      setOutcomesLoading(true);
      setOutcomesError(null);
      const data = await dashboardService.getOutcomes();
      if (data && data.success) {
        setStudentOutcomes(normalizeStudentOutcomes(data));
      } else {
        setOutcomesError(data?.message || 'Unable to load verified placement outcomes.');
      }
    } catch (err) {
      setOutcomesError(
        err.response?.data?.message ||
          'Unable to load verified placement outcomes. Please retry.'
      );
    } finally {
      setOutcomesLoading(false);
    }
  }, []);

  // 3. Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const data = await notificationService.getNotifications();
      if (data && data.success) {
        const notifs = data.notifications || [];
        setRecentNotifications(notifs.slice(0, 3));
      } else {
        setNotificationsError(data?.message || 'Unable to load notifications.');
      }
    } catch (err) {
      setNotificationsError(
        err.response?.data?.message ||
          'Unable to load recent activity updates.'
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchOutcomes();
    fetchNotifications();
  }, [fetchSummary, fetchOutcomes, fetchNotifications]);

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner */}
      <WelcomeBanner userName={user?.name} />

      {/* 2. Key Performance Indicators (Eligible, Registered, In Progress, Selected (Unverified)) */}
      <DashboardKpiSection
        summary={summary}
        pendingSelectionsCount={studentOutcomes.pendingSelectionsCount}
        loading={summaryLoading}
        error={summaryError}
        onRetry={fetchSummary}
      />

      {/* 3. Verified Placement Section */}
      <VerifiedPlacementSection
        verifiedOutcomes={studentOutcomes.verifiedOutcomes}
        loading={outcomesLoading}
        error={outcomesError}
        onRetry={fetchOutcomes}
      />

      {/* 4. Application Progress (Recruitment Funnel) */}
      <ApplicationProgressSection
        registered={summary.registeredApplications}
        inProgress={summary.inProgressApplications}
        selectedUnverified={studentOutcomes.pendingSelectionsCount}
        verified={studentOutcomes.verifiedOutcomes.length}
        loading={summaryLoading || outcomesLoading}
      />

      {/* 5. Main Grid: Latest Placement Drives & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LatestDrivesSection
            drives={latestDrives}
            loading={summaryLoading}
          />
        </div>
        <div className="lg:col-span-1">
          <RecentActivitySection
            notifications={recentNotifications}
            loading={notificationsLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
