import { useState, useEffect, useRef } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  IndianRupee,
  Building2,
  Briefcase,
  GraduationCap,
  Info,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import { validateAndParseCtcInput, mapOutcomeResult } from '../../utils/placementMetrics';

/**
 * CPMS Phase 4D - Verify Outcome Modal Dialog
 * 
 * Strict specifications:
 * - Shows student and application details.
 * - Required explanation: "Verification confirms a selected placement outcome. It does not confirm that the student accepted the offer or joined."
 * - Strict CTC parsing: positive number > 0 and <= 200, up to 2 decimals, unit "LPA", sent as JSON number.
 * - Reject empty-with-no-choice, zero, negative, non-numeric, 1e2, commas.
 * - "Package not available" checkbox with mandatory warning.
 * - Confirmation step before submit.
 * - No automatic retries, no optimistic row removal.
 * - Accessible: focus trap, Escape key handling, labelled inputs, aria-live.
 */
const VerifyOutcomeModal = ({ item, isOpen, onClose, onSuccess }) => {
  const [ctcInput, setCtcInput] = useState('');
  const [packageNotAvailable, setPackageNotAvailable] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef(null);
  const ctcInputRef = useRef(null);

  // Reset form when modal opens with new item
  useEffect(() => {
    if (isOpen) {
      setCtcInput('');
      setPackageNotAvailable(false);
      setIsConfirming(false);
      setValidationError('');
      setSubmitError('');
      setIsSubmitting(false);

      // Focus first actionable input
      setTimeout(() => {
        if (ctcInputRef.current) {
          ctcInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, item]);

  // Escape key handler (disabled while submitting)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !item) return null;

  const handleInitialProceed = (e) => {
    e.preventDefault();
    setValidationError('');
    setSubmitError('');

    const validation = validateAndParseCtcInput(ctcInput, packageNotAvailable);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setIsConfirming(true);
  };

  const handleConfirmedSubmit = async () => {
    if (isSubmitting) return;

    const validation = validateAndParseCtcInput(ctcInput, packageNotAvailable);
    if (!validation.valid) {
      setValidationError(validation.error);
      setIsConfirming(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = validation.ctc !== null ? { ctc: validation.ctc } : {};
      const res = await officerService.verifyOutcome(item.applicationId, payload);

      const mapped = mapOutcomeResult(200, res);

      if (onSuccess) {
        onSuccess({
          kind: mapped.kind,
          message: mapped.message,
          applicationId: item.applicationId,
        });
      }
      onClose();
    } catch (err) {
      const status = err.response?.status || 500;
      const data = err.response?.data || {};
      const mapped = mapOutcomeResult(status, data);

      setSubmitError(mapped.message);
      setIsConfirming(false); // return to edit mode on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-modal-title"
      ref={modalRef}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id="verify-modal-title" className="text-base font-bold text-white leading-tight">
                Verify Placement Outcome
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Confirm institutional selection record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Mandatory institutional disclaimer */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Verification confirms a selected placement outcome. It does not confirm that the student accepted the offer or joined.
            </p>
          </div>

          {/* Student & Drive Details Card */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Candidate:</span>
              <span className="font-bold text-slate-900">{item.studentName}</span>
            </div>
            {item.rollNumber && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Roll Number:</span>
                <span className="font-mono font-semibold text-slate-700">{item.rollNumber}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Department:</span>
              <span className="font-semibold text-slate-800">{item.departmentName}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-400 font-medium">Placement Drive:</span>
              <span className="font-semibold text-slate-900">{item.company}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Role:</span>
              <span className="text-slate-700">{item.role}</span>
            </div>
            {item.driveLifecycleState === 'archived' && (
              <div className="pt-1 flex items-center justify-end">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Archived Drive (Verifiable)
                </span>
              </div>
            )}
          </div>

          {/* Error Announcements */}
          {(validationError || submitError) && (
            <div
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{validationError || submitError}</span>
            </div>
          )}

          {/* Step 1: Input Form */}
          {!isConfirming ? (
            <form onSubmit={handleInitialProceed} className="space-y-4">
              <div>
                <label
                  htmlFor="ctc-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Offer Package (CTC) in LPA
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm flex items-center">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <input
                    id="ctc-input"
                    ref={ctcInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 14.5"
                    value={ctcInput}
                    disabled={packageNotAvailable || isSubmitting}
                    onChange={(e) => {
                      setCtcInput(e.target.value);
                      setValidationError('');
                    }}
                    className={`w-full pl-8 pr-16 py-2.5 text-sm rounded-xl border transition outline-none font-medium ${
                      packageNotAvailable
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                    aria-describedby="ctc-help-text"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    LPA
                  </div>
                </div>
                <p id="ctc-help-text" className="text-[11px] text-slate-400 mt-1">
                  Must be between 0.01 and 200.00 LPA with at most 2 decimal places.
                </p>
              </div>

              {/* Checkbox: Package not available */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={packageNotAvailable}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setPackageNotAvailable(e.target.checked);
                      if (e.target.checked) {
                        setCtcInput('');
                      }
                      setValidationError('');
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Package not available
                    </span>
                    {packageNotAvailable && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1.5 leading-relaxed">
                        Adding a package later requires revoking and re-verifying, which sends the student another notification.
                      </p>
                    )}
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  <span>Review & Verify</span>
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Confirmation Step */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-slate-800 text-xs space-y-2">
                <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Confirm Verification Details</span>
                </div>
                <p className="text-slate-600 text-xs">
                  Please review the verified record before submitting. A point-in-time notification will be dispatched to the candidate.
                </p>
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">Package to Record:</span>
                  <span className="font-bold text-slate-900">
                    {packageNotAvailable ? 'Not Specified' : `₹ ${ctcInput} LPA`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handleConfirmedSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Record Verification</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyOutcomeModal;

