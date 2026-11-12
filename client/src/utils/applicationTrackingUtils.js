import { METRIC_LABELS } from '../constants/placementMetrics.js';

/**
 * Pure helper to resolve recruitment tracking stages for an application.
 * Sourced entirely from verified database status and round properties.
 *
 * @param {Object|null|undefined} app - The application record
 * @returns {Array<{ id: string, label: string, description: string, status: 'completed'|'current'|'pending'|'unsuccessful'|'verified', date?: string, reason?: string }>}
 */
export const getApplicationStages = (app) => {
  if (!app || typeof app !== 'object') return [];

  const status = app.status || 'Applied';
  const isOutcomeVerified = Boolean(app.outcomeVerified);
  const appliedDate = app.createdAt
    ? new Date(app.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  // 1. Applied: Initial submission active, screening pending
  if (status === 'Applied') {
    return [
      {
        id: 'applied',
        label: 'Application Submitted',
        description: 'Application registered',
        status: 'current',
        date: appliedDate,
      },
      {
        id: 'shortlisting',
        label: 'Shortlisting',
        description: 'Profile & eligibility review',
        status: 'pending',
      },
      {
        id: 'interviewing',
        label: 'Interview',
        description: 'Technical & HR evaluations',
        status: 'pending',
      },
      {
        id: 'outcome',
        label: 'Final Outcome',
        description: 'Selection decision',
        status: 'pending',
      },
    ];
  }

  // 2. Shortlisted: Screening passed, actively preparing for interview
  if (status === 'Shortlisted') {
    return [
      {
        id: 'applied',
        label: 'Application Submitted',
        description: 'Application registered',
        status: 'completed',
        date: appliedDate,
      },
      {
        id: 'shortlisting',
        label: 'Shortlisting',
        description: 'Profile shortlisted for evaluation',
        status: 'current',
      },
      {
        id: 'interviewing',
        label: 'Interview',
        description: 'Technical & HR evaluations',
        status: 'pending',
      },
      {
        id: 'outcome',
        label: 'Final Outcome',
        description: 'Selection decision',
        status: 'pending',
      },
    ];
  }

  // 3. Interviewing: Screening passed, actively in interview rounds
  if (status === 'Interviewing') {
    return [
      {
        id: 'applied',
        label: 'Application Submitted',
        description: 'Application registered',
        status: 'completed',
        date: appliedDate,
      },
      {
        id: 'shortlisting',
        label: 'Shortlisting',
        description: 'Profile shortlisted',
        status: 'completed',
      },
      {
        id: 'interviewing',
        label: 'Interview',
        description: 'In assessment & interview rounds',
        status: 'current',
      },
      {
        id: 'outcome',
        label: 'Final Outcome',
        description: 'Selection decision',
        status: 'pending',
      },
    ];
  }

  // 4. Selected: All rounds completed; distinguishes verified vs unverified
  if (status === 'Selected') {
    return [
      {
        id: 'applied',
        label: 'Application Submitted',
        description: 'Application registered',
        status: 'completed',
        date: appliedDate,
      },
      {
        id: 'shortlisting',
        label: 'Shortlisting',
        description: 'Profile shortlisted',
        status: 'completed',
      },
      {
        id: 'interviewing',
        label: 'Interview',
        description: 'Evaluations concluded',
        status: 'completed',
      },
      {
        id: 'outcome',
        label: isOutcomeVerified ? 'Verified Placement' : METRIC_LABELS.SELECTED_UNVERIFIED,
        description: isOutcomeVerified
          ? 'Verified by placement officer'
          : 'Awaiting officer verification',
        status: isOutcomeVerified ? 'verified' : 'completed',
      },
    ];
  }

  // 5. Rejected: Pinpoint exact round from authoritative level_name & rejection properties
  if (status === 'Rejected') {
    const rawLevel = (
      app.level_name ||
      app.rejection_level ||
      app.rejected_round ||
      app.levelName ||
      app.rejectionStage ||
      ''
    ).trim();

    const reason = (
      app.rejection_reason ||
      app.rejectionReason ||
      app.reason ||
      app.rejectionNote ||
      ''
    ).trim();

    const lowerLevel = rawLevel.toLowerCase();

    // 5a. Missing stage information: show honest unavailable status without fabricating
    if (!rawLevel) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'evaluation',
          label: 'Evaluation',
          description: 'Stage information unavailable',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5b. Rejected during Shortlisting
    if (lowerLevel.includes('shortlist')) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: rawLevel || 'Shortlisting',
          description: reason || 'Rejected',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'interviewing',
          label: 'Interview',
          description: 'Not reached',
          status: 'pending',
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5c. Rejected during Assessment / Online Test
    if (
      lowerLevel.includes('assessment') ||
      lowerLevel.includes('aptitude') ||
      lowerLevel.includes('test') ||
      lowerLevel.includes('screening') ||
      lowerLevel.includes('exam')
    ) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: 'Shortlisting',
          description: 'Shortlisting cleared',
          status: 'completed',
        },
        {
          id: 'assessment',
          label: rawLevel || 'Assessment',
          description: reason || 'Rejected',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'interviewing',
          label: 'Interview',
          description: 'Not reached',
          status: 'pending',
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5d. Rejected during Technical Interview
    if (lowerLevel.includes('tech')) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: 'Shortlisting',
          description: 'Shortlisting cleared',
          status: 'completed',
        },
        {
          id: 'technical_interview',
          label: rawLevel || 'Technical Interview',
          description: reason || 'Rejected',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'hr_interview',
          label: 'HR Interview',
          description: 'Not reached',
          status: 'pending',
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5e. Rejected during HR Interview
    if (
      lowerLevel.includes('hr') ||
      lowerLevel.includes('manager') ||
      lowerLevel.includes('behavioral') ||
      lowerLevel.includes('fit')
    ) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: 'Shortlisting',
          description: 'Shortlisting cleared',
          status: 'completed',
        },
        {
          id: 'technical_interview',
          label: 'Technical Interview',
          description: 'Technical evaluation cleared',
          status: 'completed',
        },
        {
          id: 'hr_interview',
          label: rawLevel || 'HR Interview',
          description: reason || 'Rejected',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5f. Rejected during General Interview
    if (lowerLevel.includes('interview')) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: 'Shortlisting',
          description: 'Shortlisting cleared',
          status: 'completed',
        },
        {
          id: 'interviewing',
          label: rawLevel || 'Interview',
          description: reason || 'Rejected',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
        {
          id: 'outcome',
          label: 'Final Outcome',
          description: 'Not reached',
          status: 'pending',
        },
      ];
    }

    // 5g. Rejected at Final Outcome
    if (
      lowerLevel.includes('outcome') ||
      lowerLevel.includes('final') ||
      lowerLevel.includes('decision') ||
      lowerLevel.includes('selection')
    ) {
      return [
        {
          id: 'applied',
          label: 'Application Submitted',
          description: 'Application registered',
          status: 'completed',
          date: appliedDate,
        },
        {
          id: 'shortlisting',
          label: 'Shortlisting',
          description: 'Shortlisting cleared',
          status: 'completed',
        },
        {
          id: 'interviewing',
          label: 'Interview',
          description: 'Evaluations concluded',
          status: 'completed',
        },
        {
          id: 'outcome',
          label: 'Not Selected',
          description: reason || 'Application unsuccessful',
          status: 'unsuccessful',
          ...(reason ? { reason } : {}),
        },
      ];
    }

    // 5h. Custom named round rejection
    return [
      {
        id: 'applied',
        label: 'Application Submitted',
        description: 'Application registered',
        status: 'completed',
        date: appliedDate,
      },
      {
        id: 'shortlisting',
        label: 'Shortlisting',
        description: 'Shortlisting cleared',
        status: 'completed',
      },
      {
        id: 'custom_round',
        label: rawLevel,
        description: reason || 'Rejected',
        status: 'unsuccessful',
        ...(reason ? { reason } : {}),
      },
      {
        id: 'outcome',
        label: 'Final Outcome',
        description: 'Not reached',
        status: 'pending',
      },
    ];
  }

  // Generic fallback if custom/unknown status is provided
  return [
    {
      id: 'applied',
      label: 'Application Submitted',
      description: 'Application registered',
      status: 'completed',
      date: appliedDate,
    },
    {
      id: 'status',
      label: String(status),
      description: 'Current recruitment status',
      status: 'current',
    },
  ];
};
