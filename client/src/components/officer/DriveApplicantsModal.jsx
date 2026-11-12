import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { officerService } from '../../services/officerService';
import {
  X,
  Users,
  Search,
  FileText,
  ExternalLink,
  GraduationCap,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  Filter,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react';
import CompanyLocation from '../common/CompanyLocation';

const ALLOWED_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'];

const formatAcademicYear = (year) => {
  if (!year || typeof year !== 'string' || !year.trim()) return 'N/A';
  const trimmed = year.trim();
  if (/year$/i.test(trimmed)) return trimmed;
  return `${trimmed} Year`;
};

const formatAppliedDate = (dateString) => {
  if (!dateString) return 'Date unavailable';
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'Applied':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Shortlisted':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Interviewing':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Selected':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const DriveApplicantsModal = ({ isOpen, onClose, drive, onStatusUpdated }) => {
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadApplicants = useCallback(async (driveId) => {
    try {
      setLoading(true);
      setFetchError('');
      const res = await officerService.getDriveApplicants(driveId);
      if (res.success) {
        setApplicants(res.applications || res.applicants || []);
      } else {
        setFetchError(res.message || 'Failed to load applicants.');
      }
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Server error loading drive applicants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && drive?._id) {
      loadApplicants(drive._id);
    }
  }, [isOpen, drive?._id, loadApplicants]);

  const handleClose = () => {
    setApplicants([]);
    setFetchError('');
    setActionError('');
    setActionSuccess('');
    setSearchTerm('');
    setStatusFilter('ALL');
    onClose();
  };

  const handleStatusChange = async (applicationId, currentStatus, newStatus) => {
    if (currentStatus === newStatus || updatingId) return;

    setActionError('');
    setActionSuccess('');
    setUpdatingId(applicationId);

    try {
      const res = await officerService.updateApplicationStatus(applicationId, newStatus);
      if (res.success) {
        // Update local applicant state
        setApplicants((prev) =>
          prev.map((app) => (app._id === applicationId ? { ...app, status: newStatus } : app))
        );
        setActionSuccess(`Status updated to "${newStatus}".`);
        // Notify parent dashboard to update live summary metrics (such as Selected applications)
        if (onStatusUpdated) {
          onStatusUpdated({
            driveId: drive._id,
            applicationId,
            oldStatus: currentStatus,
            newStatus,
          });
        }
        setTimeout(() => setActionSuccess(''), 3000);
      } else {
        if (res.code === 'VERIFIED_OUTCOME_EXISTS' || (res.message && res.message.includes('verified placement outcome'))) {
          setActionError('This application has a verified placement outcome. Revoke it before changing the status.');
        } else {
          setActionError(res.message || 'Failed to update applicant status.');
        }
      }
    } catch (err) {
      if (err.response?.data?.code === 'VERIFIED_OUTCOME_EXISTS' || (err.response?.data?.message && err.response.data.message.includes('verified placement outcome'))) {
        setActionError('This application has a verified placement outcome. Revoke it before changing the status.');
      } else {
        setActionError(
          err.response?.data?.message || 'Error occurred while updating application status.'
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredApplicants = useMemo(() => {
    return applicants.filter((app) => {
      const studentName = app.student?.name || '';
      const studentEmail = app.student?.email || '';
      const roll = app.academicProfile?.rollNumber || '';
      const dept = app.academicProfile?.department || '';
      const course = app.academicProfile?.course || '';
      const section = app.academicProfile?.section || '';
      const academicYear = app.academicProfile?.academicYear || '';
      const skills = (app.academicProfile?.skills || []).join(' ');

      const query = searchTerm.toLowerCase();
      const matchesSearch =
        !query ||
        studentName.toLowerCase().includes(query) ||
        studentEmail.toLowerCase().includes(query) ||
        roll.toLowerCase().includes(query) ||
        dept.toLowerCase().includes(query) ||
        course.toLowerCase().includes(query) ||
        section.toLowerCase().includes(query) ||
        academicYear.toLowerCase().includes(query) ||
        skills.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applicants, searchTerm, statusFilter]);

  if (!isOpen || !drive) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">{drive.jobRole}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-medium">
                  {drive.company?.name || 'Company'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  {drive.company?.industry || 'Campus Recruitment'}
                </span>
                <CompanyLocation
                  location={drive.companyLocation}
                  className="inline-flex items-center gap-1 text-xs text-slate-300 min-w-0"
                  iconClassName="w-3.5 h-3.5 text-emerald-400 shrink-0"
                />
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Drive:{' '}
                  {drive.driveDate
                    ? new Date(drive.driveDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
                <span className="bg-white/10 px-2 py-0.2 rounded-md font-semibold text-emerald-200">
                  {applicants.length} Total Applicants
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleClose();
                navigate(`/officer/drives/${drive._id}/attendance`, { state: { drive } });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Open Drive Attendance Roster"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Attendance</span>
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action feedback notifications */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll no, department, section, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none text-slate-700 font-medium"
            >
              <option value="ALL">All Statuses ({applicants.length})</option>
              {ALLOWED_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st} ({applicants.filter((a) => a.status === st).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium">Loading applicant roster...</p>
            </div>
          ) : fetchError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load applicants</p>
                <p className="text-xs text-rose-600 mt-1">{fetchError}</p>
                <button
                  onClick={() => loadApplicants(drive._id)}
                  className="mt-3 px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-medium hover:bg-rose-700 transition cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            </div>
          ) : applicants.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Applications Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Students eligible for this placement drive will appear here once they register.
              </p>
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-semibold text-slate-700">No applicants match your filters</p>
              <p className="text-xs text-slate-500 mt-1">
                Try searching with a different term or reset the status filter.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                }}
                className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredApplicants.map((app) => {
                const profile = app.academicProfile || {};
                const isRowUpdating = updatingId === app._id;

                return (
                  <div
                    key={app._id}
                    className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left: Student Identity & Academic Profile */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* 1. Student Identity */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {app.student?.name || 'Student Candidate'}
                          </h4>
                          {profile.rollNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-medium border border-slate-200 shrink-0">
                              {profile.rollNumber}
                            </span>
                          )}
                          {app.student?.email && (
                            <span className="text-xs text-slate-500 truncate">{app.student.email}</span>
                          )}
                        </div>

                        {/* 2. Academic Information: Department, Section, Academic Year, Course/Batch */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Department */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-500">Dept:</span>
                            <span className="font-semibold text-slate-800">
                              {profile.department || 'N/A'}
                            </span>
                            {profile.course && <span className="text-slate-400">• {profile.course}</span>}
                            {profile.batch && <span className="text-slate-400">({profile.batch})</span>}
                          </div>

                          {/* Section */}
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                            <span className="font-medium text-slate-500">Section:</span>
                            <span className="font-semibold text-slate-800 font-mono">
                              {profile.section || 'N/A'}
                            </span>
                          </div>

                          {/* Academic Year */}
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                            <span className="font-medium text-slate-500">Academic Year:</span>
                            <span className="font-semibold text-slate-800">
                              {formatAcademicYear(profile.academicYear)}
                            </span>
                          </div>
                        </div>

                        {/* 3 & 4. Academic Performance & Application Info */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 pt-0.5">
                          {/* Current CGPA */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium">Current CGPA:</span>
                            <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                              {profile.cgpa !== null && profile.cgpa !== undefined
                                ? profile.cgpa
                                : 'N/A'}
                            </span>
                          </div>

                          {/* Backlogs */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium">Backlogs:</span>
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded ${
                                profile.backlogs > 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'text-slate-800'
                              }`}
                            >
                              {profile.backlogs !== null && profile.backlogs !== undefined
                                ? profile.backlogs
                                : '0'}
                            </span>
                          </div>

                          {/* Applied On */}
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-500 font-medium">Applied On:</span>
                            <span className="text-slate-800 font-medium">
                              {formatAppliedDate(app.appliedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Skills */}
                        {profile.skills && profile.skills.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-slate-400 font-medium">Skills:</span>
                            {profile.skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Resume Link & Status Management Dropdown */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                        {/* 5. Resume Action */}
                        <div>
                          {profile.resumeUrl ? (
                            <a
                              href={profile.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200/80 transition cursor-pointer"
                              title="Open student resume in new tab"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>View Resume</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No resume attached</span>
                          )}
                        </div>

                        {/* 6. Status selector & outcome verification */}
                        <div className="flex items-center gap-2">
                          {isRowUpdating ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                              <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                              <span>Updating...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {app.outcomeVerified && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title="Placement outcome confirmed"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Verified</span>
                                </span>
                              )}
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                                  app.status
                                )}`}
                              >
                                {app.status}
                              </span>
                              <select
                                value={app.status}
                                onChange={(e) =>
                                  handleStatusChange(app._id, app.status, e.target.value)
                                }
                                disabled={isRowUpdating}
                                className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none text-slate-700 font-medium cursor-pointer"
                                aria-label={`Change status for ${app.student?.name || 'student'}`}
                              >
                                {ALLOWED_STATUSES.map((statusOption) => (
                                  <option key={statusOption} value={statusOption}>
                                    Mark as {statusOption}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Showing {filteredApplicants.length} of {applicants.length} registered applicant(s)
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveApplicantsModal;
