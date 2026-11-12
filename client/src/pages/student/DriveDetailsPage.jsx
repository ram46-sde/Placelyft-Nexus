import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { driveService } from '../../services/driveService';
import { applicationService } from '../../services/applicationService';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Archive,
  ExternalLink,
  FileText,
  CheckSquare,
  Layers,
  AlertCircle,
  X,
  IndianRupee,
  MapPin,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import SectionHeader from '../../components/common/SectionHeader';
import Skeleton from '../../components/common/Skeleton';
import CompanyLocation from '../../components/common/CompanyLocation';

/**
 * Evaluates registration deadline status and urgency.
 */
const getDeadlineInfo = (deadlineString) => {
  if (!deadlineString) return null;
  const deadline = new Date(deadlineString);
  if (Number.isNaN(deadline.getTime())) return null;

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isPassed: true,
      isUrgent: false,
      label: 'Registration Closed',
      variant: 'rose',
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    return {
      isPassed: false,
      isUrgent: true,
      label: diffHours <= 1 ? 'Closes in 1 hour' : `Closes in ${diffHours}h`,
      variant: 'amber',
    };
  }

  if (diffDays <= 2) {
    return {
      isPassed: false,
      isUrgent: true,
      label: diffDays === 1 ? 'Closes today' : 'Closes in 2 days',
      variant: 'amber',
    };
  }

  return {
    isPassed: false,
    isUrgent: false,
    label: `Closes in ${diffDays} days`,
    variant: 'slate',
  };
};

const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', options);
};

const DriveDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drive, setDrive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Application states
  const [applying, setApplying] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchDriveDetails();
  }, [id]);

  const fetchDriveDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await driveService.getDriveById(id);
      if (res.success) {
        setDrive(res.drive);
      } else {
        setError(res.message || 'Failed to load drive details.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drive details.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    try {
      setApplying(true);
      setApplyMessage({ type: '', text: '' });
      const res = await applicationService.applyForDrive(id);
      if (res.success) {
        setApplyMessage({ type: 'success', text: 'Application submitted successfully!' });
        setDrive((prev) => (prev ? { ...prev, hasApplied: true } : prev));
        setApplyModalOpen(false);
      } else {
        setApplyMessage({
          type: 'error',
          text: res.message || 'Failed to apply for the drive.',
        });
      }
    } catch (err) {
      setApplyMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to apply for the drive.',
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Back navigation skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-36" />
        </div>

        {/* Hero Card Skeleton */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-28" />
          </div>
        </Card>

        {/* Two-Column Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
            <Card className="p-6 space-y-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </Card>
            <Card className="p-6 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !drive) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Card className="p-8 sm:p-10 space-y-4">
          <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <XCircle className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Unable to Load Placement Drive</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{error || 'Placement drive not found'}</p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/student/drives')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition min-h-[44px] shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Placement Drives</span>
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const { eligibility, company, eligibilityCriteria } = drive;
  const isEligible = Boolean(eligibility?.isEligible);
  const ineligibilityReasons = eligibility?.reasons || [];
  const deadlineInfo = getDeadlineInfo(drive.registrationDeadline);
  const isDeadlinePassed = Boolean(deadlineInfo?.isPassed);

  const ugBasis =
    drive.effectiveUgCriteriaType ||
    eligibilityCriteria?.effectiveUgCriteriaType ||
    eligibilityCriteria?.ugCriteriaType ||
    (Number(eligibilityCriteria?.minCgpa) > 0 ? 'CGPA' : 'NONE');

  const rounds = drive.selectionProcess || drive.rounds || drive.recruitmentRounds;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/student/drives"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Placement Drives</span>
        </Link>
      </div>

      {/* Archived Read-Only Banner */}
      {drive.isArchived && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
          <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm">Placement Drive Archived (Read-Only)</h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              This recruitment drive has been archived by the placement cell. Since you have already applied,
              your application history and drive details are preserved here in read-only mode. New applications
              are closed.
            </p>
          </div>
        </div>
      )}

      {/* Notification Banner */}
      {applyMessage.text && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs text-sm ${
            applyMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {applyMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium truncate">{applyMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setApplyMessage({ type: '', text: '' })}
            aria-label="Dismiss message"
            className="p-1 rounded hover:bg-slate-200/50 min-h-[36px] min-w-[36px] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Company and Drive Overview Hero Card */}
      <Card className="overflow-hidden border-slate-200 p-0 shadow-sm">
        {/* Subtle Brand Accent Header */}
        <div className="h-20 sm:h-24 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 w-full" />

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          {/* Header Row with Monogram, Company Identity & Titles */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-1">
              {/* Company Logo Monogram - pulls up into banner */}
              <div
                className="-mt-10 sm:-mt-12 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0"
                aria-hidden="true"
              >
                {company?.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-slate-400" />
                )}
              </div>

              {/* Company Name & Job Role Heading - fully below banner in white area */}
              <div className="min-w-0 flex-1 pt-2 sm:pt-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="text-lg sm:text-xl font-semibold text-slate-800 truncate"
                    title={company?.name}
                  >
                    {company?.name || 'Company Name'}
                  </span>
                  {company?.industry && (
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md border border-slate-200">
                      {company.industry}
                    </span>
                  )}
                </div>
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate mt-1"
                  title={drive.jobRole}
                >
                  {drive.jobRole}
                </h1>
              </div>
            </div>

            {/* Badges Container */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-center shrink-0">
              {drive.hasApplied && (
                <Badge variant="sky" icon={CheckCircle2}>
                  Applied
                </Badge>
              )}

              {isEligible ? (
                <Badge variant="emerald" icon={CheckCircle2}>
                  Eligible
                </Badge>
              ) : (
                <Badge variant="rose" icon={XCircle}>
                  Not Eligible
                </Badge>
              )}

              {deadlineInfo && (
                <Badge variant={deadlineInfo.variant} icon={Clock}>
                  {deadlineInfo.label}
                </Badge>
              )}

              {drive.isArchived && (
                <Badge variant="amber" icon={Archive}>
                  Archived
                </Badge>
              )}
            </div>
          </div>

          {/* Metadata Quick Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-5 border-t border-slate-100 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                  Drive Date
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {formatDate(drive.driveDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                  Deadline
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {formatDate(drive.registrationDeadline)}
                </span>
              </div>
            </div>

            {drive.packageDetails && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                  <IndianRupee className="w-4 h-4 text-slate-500" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                    Package
                  </span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {drive.packageDetails}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                <MapPin className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                  Location
                </span>
                <CompanyLocation
                  location={drive.companyLocation}
                  className="font-semibold text-slate-800 min-w-0 block truncate text-xs sm:text-sm"
                  iconClassName="hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Primary Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Description Card */}
          <Card className="space-y-4">
            <SectionHeader
              title="Job Description"
              description="Role scope, objectives, and responsibilities"
              icon={FileText}
            />
            <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed whitespace-pre-wrap pt-2">
              {drive.jobDescription || 'No detailed description provided for this placement drive.'}
            </div>
          </Card>

          {/* Required Skills Card */}
          {Array.isArray(eligibilityCriteria?.requiredSkills) &&
            eligibilityCriteria.requiredSkills.length > 0 && (
              <Card className="space-y-4">
                <SectionHeader
                  title="Required Technical Skills"
                  description="Competencies specified for this recruitment profile"
                  icon={Briefcase}
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  {eligibilityCriteria.requiredSkills.map((skill, sIdx) => (
                    <span
                      key={`skill-${sIdx}`}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Card>
            )}

          {/* Selection Process / Recruitment Rounds Card (preserved if present in data) */}
          {Array.isArray(rounds) && rounds.length > 0 && (
            <Card className="space-y-4">
              <SectionHeader
                title="Selection Process"
                description="Recruitment rounds scheduled for this drive"
                icon={Layers}
              />
              <div className="space-y-3 pt-2">
                {rounds.map((round, idx) => (
                  <div
                    key={round._id || `round-${idx}`}
                    className="flex items-start gap-3.5 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {round.name || round.title || `Round ${idx + 1}`}
                      </h4>
                      {round.description && (
                        <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">
                          {round.description}
                        </p>
                      )}
                      {round.date && (
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
                          <span>{formatDate(round.date)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Company Overview Card */}
          <Card className="space-y-4">
            <SectionHeader
              title={`About ${company?.name || 'Company'}`}
              description="Organization background and sector details"
              icon={Building2}
            />
            <div className="space-y-3 text-sm text-slate-600 pt-2">
              <p className="leading-relaxed">
                {company?.description || 'No detailed organization overview provided.'}
              </p>
              {company?.industry && (
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Industry:</span>{' '}
                  <span className="text-slate-600">{company.industry}</span>
                </div>
              )}
              {company?.website && (
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Website:</span>{' '}
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                  >
                    <span>{company.website}</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right / Sidebar Column */}
        <div className="space-y-6">
          {/* Application & Eligibility Action Card */}
          <Card
            className={`space-y-5 border ${
              isEligible
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-slate-200 bg-slate-50/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isEligible
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isEligible ? (
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <XCircle className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {isEligible ? 'You are Eligible' : 'Eligibility Status'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEligible
                    ? 'Your academic profile satisfies all drive criteria.'
                    : 'Profile does not meet all criteria.'}
                </p>
              </div>
            </div>

            {/* When Eligible: Positive confirmation (never render red unmet-criteria) */}
            {isEligible ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-emerald-900">
                  Profile Status
                </span>
                <p className="leading-snug">
                  {ineligibilityReasons.length > 0 && ineligibilityReasons[0].includes('meet')
                    ? ineligibilityReasons[0]
                    : 'You meet all eligibility criteria for this drive.'}
                </p>
              </div>
            ) : (
              /* When Ineligible: Genuine unmet criteria or neutral explanation */
              <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-800 space-y-2">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-rose-900">
                  Unmet Criteria
                </span>
                {ineligibilityReasons.length > 0 ? (
                  <div className="space-y-1.5">
                    {ineligibilityReasons.map((reason, idx) => (
                      <p key={`ineligibility-${idx}`} className="leading-snug">
                        &bull; {reason}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="leading-snug text-slate-700">
                    Your profile does not satisfy one or more requirements for this placement drive.
                  </p>
                )}
              </div>
            )}

            {/* Application CTA Button */}
            <div className="pt-2">
              {drive.isArchived ? (
                <button
                  type="button"
                  disabled
                  aria-label="Drive is archived and in read-only mode"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 cursor-not-allowed min-h-[44px]"
                >
                  <Archive className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>Applied & Archived (Read-Only)</span>
                </button>
              ) : drive.hasApplied ? (
                <button
                  type="button"
                  disabled
                  aria-label="Application already submitted"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 opacity-90 cursor-not-allowed min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  <span>Application Submitted</span>
                </button>
              ) : isDeadlinePassed ? (
                <button
                  type="button"
                  disabled
                  aria-label="Registration deadline has passed"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed min-h-[44px]"
                >
                  <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>Registration Closed</span>
                </button>
              ) : isEligible ? (
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(true)}
                  aria-label={`Apply for ${drive.jobRole} at ${company?.name || 'Company'}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <Briefcase className="w-4 h-4" aria-hidden="true" />
                  <span>Apply Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="Not eligible to apply for this drive"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed min-h-[44px]"
                >
                  <span>Not Eligible to Apply</span>
                </button>
              )}
            </div>

            {/* Profile Update Link if Ineligible */}
            {!drive.isArchived && !isEligible && !drive.hasApplied && (
              <p className="text-[11px] text-center text-slate-500">
                Believe your academic records are outdated?{' '}
                <Link
                  to="/student/profile"
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  Update Student Profile
                </Link>
              </p>
            )}
          </Card>

          {/* Detailed Criteria Summary Card */}
          <Card className="space-y-4">
            <SectionHeader
              title="Eligibility Criteria"
              description="Minimum academic benchmarks required"
              icon={CheckSquare}
            />

            <ul className="space-y-3 text-xs text-slate-600 pt-1">
              {/* 10th Standard */}
              <li className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span className="font-medium text-slate-700">10th Standard %</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {eligibilityCriteria?.minTenthPercentage && eligibilityCriteria.minTenthPercentage > 0
                    ? `${eligibilityCriteria.minTenthPercentage}%`
                    : 'No minimum'}
                </span>
              </li>

              {/* 12th / Diploma */}
              <li className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span className="font-medium text-slate-700">12th / Diploma %</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {eligibilityCriteria?.minTwelfthPercentage && eligibilityCriteria.minTwelfthPercentage > 0
                    ? `${eligibilityCriteria.minTwelfthPercentage}%`
                    : 'No minimum'}
                </span>
              </li>

              {/* Undergraduate Criteria */}
              <li className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span className="font-medium text-slate-700">Undergraduate (UG)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {ugBasis === 'CGPA'
                    ? `Min CGPA: ${eligibilityCriteria?.minCgpa || 0}`
                    : ugBasis === 'PERCENTAGE'
                    ? `Min Percentage: ${eligibilityCriteria?.minUgPercentage || 0}%`
                    : 'No UG minimum'}
                </span>
              </li>

              {/* Backlogs */}
              <li className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span className="font-medium text-slate-700">Max Active Backlogs</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {eligibilityCriteria?.maxBacklogs ?? 'Any'}
                </span>
              </li>

              {/* Eligible Courses */}
              {Array.isArray(eligibilityCriteria?.requiredCourses) &&
                eligibilityCriteria.requiredCourses.length > 0 && (
                  <li className="space-y-1.5 pt-1">
                    <span className="font-medium text-slate-700 block">Eligible Courses</span>
                    <div className="flex flex-wrap gap-1">
                      {eligibilityCriteria.requiredCourses.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </li>
                )}
            </ul>
          </Card>
        </div>
      </div>

      {/* Confirmation Quick Apply Modal */}
      {applyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-apply-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 id="drive-apply-title" className="text-lg font-bold text-slate-900">
                Confirm Application
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Are you sure you want to apply for{' '}
                <strong className="text-slate-900">{drive.jobRole}</strong> at{' '}
                <strong className="text-slate-900">{company?.name || 'Company'}</strong>?
              </p>
              <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Your verified student profile credentials will be submitted to the college placement cell for
                this recruitment drive.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => setApplyModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={applying}
                  onClick={handleApply}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  {applying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Confirm Application</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriveDetailsPage;
