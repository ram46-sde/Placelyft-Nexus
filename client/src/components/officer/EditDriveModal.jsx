import { useState, useEffect, useRef, useCallback } from 'react';
import { officerService } from '../../services/officerService';
import {
  X,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Info,
} from 'lucide-react';

/**
 * Formats a Date object or ISO string to 'YYYY-MM-DD' for date input fields without timezone shifting.
 */
export const formatDateForInput = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10);
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

/**
 * Prepopulates the form state from an existing PlacementDrive object.
 */
export const populateFormData = (drive) => {
  if (!drive) return createInitialEditFormData();

  const companyName = drive.company?.name || (typeof drive.company === 'string' ? drive.company : '');
  const elig = drive.eligibilityCriteria || {};

  // Resolve UG criteria basis from drive, respecting effectiveUgCriteriaType fallback
  const ugCriteriaType =
    elig.effectiveUgCriteriaType ||
    elig.ugCriteriaType ||
    (Number(elig.minCgpa) > 0 ? 'CGPA' : Number(elig.minUgPercentage) > 0 ? 'PERCENTAGE' : 'NONE');

  return {
    companyName: companyName || '',
    companyLocation: drive.companyLocation || '',
    jobRole: drive.jobRole || '',
    jobDescription: drive.jobDescription || '',
    packageDetails: drive.packageDetails || '',
    driveDate: formatDateForInput(drive.driveDate),
    registrationDeadline: formatDateForInput(drive.registrationDeadline),
    minTenthPercentage: elig.minTenthPercentage !== undefined ? String(elig.minTenthPercentage) : '0',
    minTwelfthPercentage: elig.minTwelfthPercentage !== undefined ? String(elig.minTwelfthPercentage) : '0',
    ugCriteriaType: ugCriteriaType || '',
    minCgpa: elig.minCgpa !== undefined && elig.minCgpa !== null ? String(elig.minCgpa) : '',
    minUgPercentage: elig.minUgPercentage !== undefined && elig.minUgPercentage !== null ? String(elig.minUgPercentage) : '',
    maxBacklogs: elig.maxBacklogs !== undefined ? String(elig.maxBacklogs) : '0',
    requiredCoursesInput: Array.isArray(elig.requiredCourses) ? elig.requiredCourses.join(', ') : '',
    requiredSkillsInput: Array.isArray(elig.requiredSkills) ? elig.requiredSkills.join(', ') : '',
  };
};

export const createInitialEditFormData = () => ({
  companyName: '',
  companyLocation: '',
  jobRole: '',
  jobDescription: '',
  packageDetails: '',
  driveDate: '',
  registrationDeadline: '',
  minTenthPercentage: '0',
  minTwelfthPercentage: '0',
  ugCriteriaType: '',
  minCgpa: '',
  minUgPercentage: '',
  maxBacklogs: '0',
  requiredCoursesInput: '',
  requiredSkillsInput: '',
});

/**
 * Computes human-readable bullet points comparing original vs updated eligibility criteria.
 */
export const computeChangedCriteria = (originalElig = {}, newElig = {}) => {
  const changes = [];

  const oldTenth = Number(originalElig.minTenthPercentage ?? 0);
  const newTenth = Number(newElig.minTenthPercentage ?? 0);
  if (oldTenth !== newTenth) {
    changes.push(`10th Standard Minimum: changed from ${oldTenth}% to ${newTenth}%`);
  }

  const oldTwelfth = Number(originalElig.minTwelfthPercentage ?? 0);
  const newTwelfth = Number(newElig.minTwelfthPercentage ?? 0);
  if (oldTwelfth !== newTwelfth) {
    changes.push(`12th / Diploma Minimum: changed from ${oldTwelfth}% to ${newTwelfth}%`);
  }

  const oldUgType = originalElig.effectiveUgCriteriaType || originalElig.ugCriteriaType || (Number(originalElig.minCgpa) > 0 ? 'CGPA' : 'NONE');
  const newUgType = newElig.ugCriteriaType;
  if (oldUgType !== newUgType) {
    changes.push(`UG Grading Basis: changed from ${oldUgType || 'None'} to ${newUgType || 'None'}`);
  }

  if (newUgType === 'CGPA') {
    const oldCgpa = Number(originalElig.minCgpa ?? 0);
    const newCgpa = Number(newElig.minCgpa ?? 0);
    if (oldCgpa !== newCgpa) {
      changes.push(`Minimum CGPA: changed from ${oldCgpa} to ${newCgpa}`);
    }
  } else if (newUgType === 'PERCENTAGE') {
    const oldUgPct = Number(originalElig.minUgPercentage ?? 0);
    const newUgPct = Number(newElig.minUgPercentage ?? 0);
    if (oldUgPct !== newUgPct) {
      changes.push(`Minimum UG Percentage: changed from ${oldUgPct}% to ${newUgPct}%`);
    }
  }

  const oldBacklogs = Number(originalElig.maxBacklogs ?? 0);
  const newBacklogs = Number(newElig.maxBacklogs ?? 0);
  if (oldBacklogs !== newBacklogs) {
    changes.push(`Maximum Backlogs: changed from ${oldBacklogs} to ${newBacklogs}`);
  }

  const oldCourses = [...(originalElig.requiredCourses || [])].map((c) => String(c).trim()).filter(Boolean).sort();
  const newCourses = [...(newElig.requiredCourses || [])].sort();
  if (JSON.stringify(oldCourses) !== JSON.stringify(newCourses)) {
    changes.push(`Required Courses: updated to [${newCourses.join(', ') || 'None'}]`);
  }

  const oldSkills = [...(originalElig.requiredSkills || [])].map((s) => String(s).trim()).filter(Boolean).sort();
  const newSkills = [...(newElig.requiredSkills || [])].sort();
  if (JSON.stringify(oldSkills) !== JSON.stringify(newSkills)) {
    changes.push(`Required Skills: updated to [${newSkills.join(', ') || 'None'}]`);
  }

  return changes;
};

const EditDriveModal = ({ isOpen, drive, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(createInitialEditFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Eligibility change confirmation state
  const [confirmationState, setConfirmationState] = useState({
    showConfirmation: false,
    applicantCount: 0,
    pendingPayload: null,
    changedCriteriaSummary: [],
  });

  const submittingRef = useRef(submitting);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // Initialize or reset form state whenever drive or modal open state changes
  useEffect(() => {
    if (isOpen && drive && !submittingRef.current) {
      setFormData(populateFormData(drive));
      setError('');
      setConfirmationState({
        showConfirmation: false,
        applicantCount: 0,
        pendingPayload: null,
        changedCriteriaSummary: [],
      });
    }
  }, [isOpen, drive]);

  // Keyboard accessibility: Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !submitting) {
        if (confirmationState.showConfirmation) {
          // If confirmation dialog is active, cancel confirmation first
          setConfirmationState({
            showConfirmation: false,
            applicantCount: 0,
            pendingPayload: null,
            changedCriteriaSummary: [],
          });
        } else {
          onClose();
        }
      }
    },
    [submitting, confirmationState.showConfirmation, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !drive) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear active error and reset pending confirmation if user modifies form fields
    if (error) setError('');
    if (confirmationState.showConfirmation) {
      setConfirmationState({
        showConfirmation: false,
        applicantCount: 0,
        pendingPayload: null,
        changedCriteriaSummary: [],
      });
    }
  };

  /**
   * Validates form data and builds canonical payload.
   * Excludes all protected fields (_id, collegeId, isArchived, archivedAt, archivedBy, createdAt, updatedAt).
   */
  const buildValidatedPayload = () => {
    if (!formData.companyName.trim()) {
      return { error: 'Company name is required.' };
    }

    if (!formData.companyLocation || !formData.companyLocation.trim()) {
      return { error: 'Company location is required.' };
    }

    const sanitizedLocation = formData.companyLocation.trim().replace(/\s+/g, ' ');
    if (sanitizedLocation.length < 2 || sanitizedLocation.length > 100) {
      return { error: 'Company location must be between 2 and 100 characters.' };
    }

    if (!/^[\p{L}\p{N}\s,.\-()&/]+$/u.test(sanitizedLocation)) {
      return {
        error:
          'Company location contains invalid characters. Allowed: letters, numbers, spaces, and (, . - ( ) & /).',
      };
    }

    if (!/[\p{L}\p{N}]/u.test(sanitizedLocation)) {
      return { error: 'Company location cannot consist solely of punctuation or whitespace.' };
    }

    if (!formData.jobRole.trim()) {
      return { error: 'Job role is required.' };
    }

    if (!formData.jobDescription.trim()) {
      return { error: 'Job description is required.' };
    }

    if (formData.jobDescription.trim().length < 10) {
      return { error: 'Job description must be at least 10 characters long.' };
    }

    if (formData.jobDescription.trim().length > 5000) {
      return { error: 'Job description must not exceed 5000 characters.' };
    }

    if (!formData.driveDate) {
      return { error: 'Drive date is required.' };
    }

    if (!formData.registrationDeadline) {
      return { error: 'Registration deadline is required.' };
    }

    const driveDateObj = new Date(formData.driveDate);
    const deadlineObj = new Date(formData.registrationDeadline);

    if (isNaN(driveDateObj.getTime())) {
      return { error: 'Please provide a valid drive date.' };
    }

    if (isNaN(deadlineObj.getTime())) {
      return { error: 'Please provide a valid registration deadline.' };
    }

    if (deadlineObj > driveDateObj) {
      return { error: 'Registration deadline must be on or before the drive date.' };
    }

    // 10th Standard Percentage validation
    let minTenthNum = 0;
    if (formData.minTenthPercentage && String(formData.minTenthPercentage).trim() !== '') {
      minTenthNum = parseFloat(formData.minTenthPercentage);
      if (isNaN(minTenthNum) || minTenthNum < 0 || minTenthNum > 100) {
        return { error: 'Minimum 10th percentage must be a number between 0 and 100.' };
      }
    }

    // 12th Standard / Diploma Percentage validation
    let minTwelfthNum = 0;
    if (formData.minTwelfthPercentage && String(formData.minTwelfthPercentage).trim() !== '') {
      minTwelfthNum = parseFloat(formData.minTwelfthPercentage);
      if (isNaN(minTwelfthNum) || minTwelfthNum < 0 || minTwelfthNum > 100) {
        return { error: 'Minimum 12th / Diploma percentage must be a number between 0 and 100.' };
      }
    }

    // UG Criteria Type validation
    if (!formData.ugCriteriaType || !['CGPA', 'PERCENTAGE', 'NONE'].includes(formData.ugCriteriaType)) {
      return { error: 'Please select an Undergraduate (UG) eligibility basis (CGPA, Percentage, or None).' };
    }

    let minCgpaNum = 0;
    let minUgPercentageNum = 0;

    if (formData.ugCriteriaType === 'CGPA') {
      if (!formData.minCgpa || String(formData.minCgpa).trim() === '') {
        return { error: 'Please enter a valid positive Minimum CGPA threshold.' };
      }
      minCgpaNum = parseFloat(formData.minCgpa);
      if (isNaN(minCgpaNum) || minCgpaNum <= 0 || minCgpaNum > 10) {
        return { error: 'Minimum CGPA must be a positive number between 0 and 10.' };
      }
    } else if (formData.ugCriteriaType === 'PERCENTAGE') {
      if (!formData.minUgPercentage || String(formData.minUgPercentage).trim() === '') {
        return { error: 'Please enter a valid positive Minimum UG Percentage threshold.' };
      }
      minUgPercentageNum = parseFloat(formData.minUgPercentage);
      if (isNaN(minUgPercentageNum) || minUgPercentageNum <= 0 || minUgPercentageNum > 100) {
        return { error: 'Minimum UG percentage must be a positive number between 0 and 100.' };
      }
    } else if (formData.ugCriteriaType === 'NONE') {
      minCgpaNum = 0;
      minUgPercentageNum = 0;
    }

    const maxBacklogsNum = parseInt(formData.maxBacklogs, 10);
    if (isNaN(maxBacklogsNum) || maxBacklogsNum < 0) {
      return { error: 'Maximum backlogs must be a non-negative integer.' };
    }

    const requiredCourses = formData.requiredCoursesInput
      ? formData.requiredCoursesInput
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    const requiredSkills = formData.requiredSkillsInput
      ? formData.requiredSkillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const payload = {
      companyName: formData.companyName.trim(),
      companyLocation: sanitizedLocation,
      jobRole: formData.jobRole.trim(),
      jobDescription: formData.jobDescription.trim(),
      packageDetails: formData.packageDetails.trim() || null,
      driveDate: driveDateObj.toISOString(),
      registrationDeadline: deadlineObj.toISOString(),
      isActive: drive.isActive !== undefined ? drive.isActive : true,
      eligibilityCriteria: {
        minTenthPercentage: minTenthNum,
        minTwelfthPercentage: minTwelfthNum,
        ugCriteriaType: formData.ugCriteriaType,
        minCgpa: minCgpaNum,
        minUgPercentage: minUgPercentageNum,
        maxBacklogs: maxBacklogsNum,
        requiredCourses,
        requiredSkills,
      },
    };

    return { payload };
  };

  /**
   * Primary form submit handler.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    const validationResult = buildValidatedPayload();
    if (validationResult.error) {
      setError(validationResult.error);
      return;
    }

    const { payload } = validationResult;

    try {
      setSubmitting(true);
      const res = await officerService.updateDrive(drive._id, payload);
      if (res.success && res.drive) {
        if (onSuccess) onSuccess(res.drive);
        onClose();
      } else {
        setError(res.message || 'Failed to update placement drive.');
      }
    } catch (err) {
      // Handle HTTP 409 Eligibility Change Confirmation workflow
      if (
        err.response?.status === 409 &&
        err.response?.data?.code === 'ELIGIBILITY_CHANGE_CONFIRMATION_REQUIRED'
      ) {
        const applicantCount = err.response.data.applicantCount || 0;
        const changedSummary = computeChangedCriteria(drive.eligibilityCriteria, payload.eligibilityCriteria);
        setConfirmationState({
          showConfirmation: true,
          applicantCount,
          pendingPayload: payload,
          changedCriteriaSummary: changedSummary,
        });
      } else {
        setError(err.response?.data?.message || err.message || 'Server error updating placement drive.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Confirms eligibility change impact and resubmits with confirmEligibilityImpact: true.
   */
  const handleConfirmEligibilitySave = async () => {
    if (submitting || !confirmationState.pendingPayload) return;

    const confirmedPayload = {
      ...confirmationState.pendingPayload,
      confirmEligibilityImpact: true,
    };

    try {
      setSubmitting(true);
      setError('');
      const res = await officerService.updateDrive(drive._id, confirmedPayload);
      if (res.success && res.drive) {
        setConfirmationState({
          showConfirmation: false,
          applicantCount: 0,
          pendingPayload: null,
          changedCriteriaSummary: [],
        });
        if (onSuccess) onSuccess(res.drive);
        onClose();
      } else {
        setError(res.message || 'Failed to update placement drive.');
      }
    } catch (err) {
      // On failure, preserve entered form values and report server error
      setConfirmationState((prev) => ({ ...prev, showConfirmation: false }));
      setError(err.response?.data?.message || err.message || 'Server error confirming eligibility criteria update.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Cancels the confirmation modal, returning officer to edit form with entered data preserved.
   */
  const handleCancelConfirmation = () => {
    setConfirmationState({
      showConfirmation: false,
      applicantCount: 0,
      pendingPayload: null,
      changedCriteriaSummary: [],
    });
  };

  const existingCompanyMeta = drive.company && typeof drive.company === 'object' ? drive.company : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-drive-title"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-drive-title" className="text-lg font-bold">
                Edit Placement Drive
              </h2>
              <p className="text-xs text-slate-300">
                Update job details, deadlines, and eligibility criteria for this drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            aria-label="Close edit drive modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Confirmation Dialog */}
        {confirmationState.showConfirmation ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-amber-900">
                  Eligibility Criteria Modification Confirmation
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This placement drive currently has{' '}
                  <span className="font-bold underline decoration-amber-500">
                    {confirmationState.applicantCount} existing applicant(s)
                  </span>
                  . Modifying eligibility criteria affects how dynamically calculated eligibility status is
                  evaluated and displayed to students.
                </p>
                <div className="text-xs text-amber-900 bg-amber-100/70 p-3 rounded-lg border border-amber-200">
                  <p className="font-semibold mb-1">Impact Summary:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Existing applications, attendance, and placement outcomes will NOT be deleted.</li>
                    <li>Dynamically calculated eligibility displayed on student dashboards will update based on the new criteria.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Changed Criteria List */}
            {confirmationState.changedCriteriaSummary.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Detected Criteria Changes:
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {confirmationState.changedCriteriaSummary.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confirmation Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelConfirmation}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel & Review Form
              </button>
              <button
                type="button"
                onClick={handleConfirmEligibilitySave}
                disabled={submitting}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Company Information */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Company Information
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-companyName" className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="e.g. Google, Microsoft, Apex Labs"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Changing the company name will match or create a company record.
                  </p>
                </div>

                <div>
                  <label htmlFor="edit-companyLocation" className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Location <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      id="edit-companyLocation"
                      name="companyLocation"
                      value={formData.companyLocation}
                      onChange={handleChange}
                      placeholder="e.g. Coimbatore, Tamil Nadu, India"
                      maxLength={100}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Between 2 and 100 characters.</p>
                </div>

                {existingCompanyMeta?.industry && (
                  <div className="sm:col-span-2 flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Company Profile: <strong className="text-slate-800">{existingCompanyMeta.industry}</strong>
                      {existingCompanyMeta.website ? ` (${existingCompanyMeta.website})` : ''}. Shared company
                      metadata is centrally managed across all institutional drives.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Job Role & Compensation */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Job Role & Package
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-jobRole" className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-jobRole"
                    name="jobRole"
                    value={formData.jobRole}
                    onChange={handleChange}
                    placeholder="e.g. Software Engineer, Data Analyst"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-packageDetails" className="block text-xs font-semibold text-slate-700 mb-1">
                    Package (CTC Details)
                  </label>
                  <input
                    type="text"
                    id="edit-packageDetails"
                    name="packageDetails"
                    value={formData.packageDetails}
                    onChange={handleChange}
                    placeholder="e.g. 12 LPA or 8-10 LPA"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-jobDescription" className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="edit-jobDescription"
                    name="jobDescription"
                    value={formData.jobDescription}
                    onChange={handleChange}
                    rows={3}
                    maxLength={5000}
                    placeholder="Describe key responsibilities, requirements, and candidate expectations..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                  <p
                    className={`text-[11px] mt-0.5 text-right ${
                      formData.jobDescription.length > 4800 ? 'text-amber-600 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {formData.jobDescription.length}/5000
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Drive Schedule & Deadlines */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Drive Schedule & Deadlines
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-driveDate" className="block text-xs font-semibold text-slate-700 mb-1">
                    Drive Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="edit-driveDate"
                    name="driveDate"
                    value={formData.driveDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-registrationDeadline" className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration Deadline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="edit-registrationDeadline"
                    name="registrationDeadline"
                    value={formData.registrationDeadline}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Must be on or before the drive date.</p>
                </div>
              </div>
            </div>

            {/* Section 4: Candidate Eligibility */}
            <div>
              <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Candidate Eligibility
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-minTenthPercentage" className="block text-xs font-semibold text-slate-700 mb-1">
                    Min 10th Standard % (0 - 100)
                  </label>
                  <input
                    type="number"
                    id="edit-minTenthPercentage"
                    name="minTenthPercentage"
                    value={formData.minTenthPercentage}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0 (No minimum)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">Leave 0 if no 10th minimum is required</p>
                </div>

                <div>
                  <label htmlFor="edit-minTwelfthPercentage" className="block text-xs font-semibold text-slate-700 mb-1">
                    Min 12th / Diploma % (0 - 100)
                  </label>
                  <input
                    type="number"
                    id="edit-minTwelfthPercentage"
                    name="minTwelfthPercentage"
                    value={formData.minTwelfthPercentage}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0 (No minimum)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">Leave 0 if no 12th/Diploma minimum is required</p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-ugCriteriaType" className="block text-xs font-semibold text-slate-700 mb-1">
                    Undergraduate (UG) Criteria Basis <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="edit-ugCriteriaType"
                    name="ugCriteriaType"
                    value={formData.ugCriteriaType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none bg-white font-medium"
                    required
                  >
                    <option value="">-- Select UG Basis (Required) --</option>
                    <option value="CGPA">CGPA (Evaluate student's CGPA)</option>
                    <option value="PERCENTAGE">Percentage (Evaluate student's UG percentage)</option>
                    <option value="NONE">None (No undergraduate minimum requirement)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Choose whether this drive evaluates CGPA or UG percentage. Drives cannot evaluate both.
                  </p>
                </div>

                {formData.ugCriteriaType === 'CGPA' && (
                  <div className="sm:col-span-2 bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-3.5">
                    <label htmlFor="edit-minCgpa" className="block text-xs font-bold text-emerald-900 mb-1">
                      Minimum CGPA Threshold (0 - 10) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="edit-minCgpa"
                      name="minCgpa"
                      value={formData.minCgpa}
                      onChange={handleChange}
                      step="0.01"
                      min="0.01"
                      max="10"
                      placeholder="e.g. 7.5"
                      className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none bg-white"
                      required
                    />
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Must be a positive threshold greater than 0 and at most 10.
                    </p>
                  </div>
                )}

                {formData.ugCriteriaType === 'PERCENTAGE' && (
                  <div className="sm:col-span-2 bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-3.5">
                    <label htmlFor="edit-minUgPercentage" className="block text-xs font-bold text-emerald-900 mb-1">
                      Minimum UG Percentage Threshold (0 - 100) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="edit-minUgPercentage"
                      name="minUgPercentage"
                      value={formData.minUgPercentage}
                      onChange={handleChange}
                      step="0.01"
                      min="0.01"
                      max="100"
                      placeholder="e.g. 70.0"
                      className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none bg-white"
                      required
                    />
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Must be a positive percentage greater than 0 and at most 100.
                    </p>
                  </div>
                )}

                {formData.ugCriteriaType === 'NONE' && (
                  <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    No undergraduate minimum requirement will be enforced for this drive.
                  </div>
                )}

                <div>
                  <label htmlFor="edit-maxBacklogs" className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Active Backlogs Allowed
                  </label>
                  <input
                    type="number"
                    id="edit-maxBacklogs"
                    name="maxBacklogs"
                    value={formData.maxBacklogs}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit-requiredCoursesInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Required Courses (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="edit-requiredCoursesInput"
                    name="requiredCoursesInput"
                    value={formData.requiredCoursesInput}
                    onChange={handleChange}
                    placeholder="e.g. B.Tech, MCA, M.Tech"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-requiredSkillsInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Required Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="edit-requiredSkillsInput"
                    name="requiredSkillsInput"
                    value={formData.requiredSkillsInput}
                    onChange={handleChange}
                    placeholder="e.g. React, Node.js, Python, SQL"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Submit Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditDriveModal;
