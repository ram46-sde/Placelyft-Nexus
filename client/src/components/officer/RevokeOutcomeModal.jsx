import { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Building2,
  Briefcase,
  GraduationCap,
  Calendar,
  User,
  Info,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import {
  validateRevokeReasonInput,
  mapOutcomeResult,
  formatCtc,
} from '../../utils/placementMetrics';

/**
 * CPMS Phase 4D Stage C - Revoke Outcome Modal Dialog
 * 
 * Strict specifications:
 * - Shows outcome details (student, roll no, department, company, role, package, verified date, officer).
 * - Reason input: textarea, trimmed 10 to 500 characters.
 * - Live character counter showing current count and minimum required (10).
 * - Submit disabled while invalid or in-flight.
 * - Mandatory warning: "The application stays Selected and returns to Needs Verification. The student is not notified of revocations."
 * - Maps backend response with mapOutcomeResult.
 * - Accessible: focus trap, Escape key handling, labelled inputs, aria-live.
 * - Never edits status or database directly from UI.
 */
const RevokeOutcomeModal = ({ item, isOpen, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef(null);
  const textareaRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setValidationError('');
      setSubmitError('');
      setIsSubmitting(false);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
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

  const trimmedLength = reason.trim().length;
  const isLengthValid = trimmedLength >= 10 && trimmedLength <= 500;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setValidationError('');
    setSubmitError('');

    const validation = validateRevokeReasonInput(reason);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await officerService.revokeOutcome(item.applicationId, {
        reason: validation.trimmedReason,
      });

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
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-modal-title"
      ref={modalRef}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-800 to-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <AlertTriangle className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 id="revoke-modal-title" className="text-base font-bold text-white leading-tight">
                Revoke Placement Outcome
              </h2>
              <p className="text-xs text-rose-100 mt-0.5">
                Revoke previously verified institutional selection
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Mandatory Policy Warning */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              The application stays Selected and returns to Needs Verification. The student is not notified of revocations.
            </p>
          </div>

          {/* Outcome Details Summary Card */}
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
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Recorded Package:</span>
              <span className="font-semibold text-slate-900">
                {item.ctc !== null && item.ctc !== undefined ? formatCtc(item.ctc) : 'Not specified'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Verified On:</span>
              <span className="text-slate-600">{formatDate(item.verifiedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Verified By:</span>
              <span className="text-slate-700 font-medium">
                {item.verifiedBy?.name || 'Placement Officer'}
              </span>
            </div>
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

          {/* Revocation Reason Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="revoke-reason-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                Reason for Revocation <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  trimmedLength < 10
                    ? 'text-amber-600 font-semibold'
                    : trimmedLength > 500
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-400'
                }`}
              >
                {trimmedLength} / 500 characters (min 10)
              </span>
            </div>

            <textarea
              id="revoke-reason-input"
              ref={textareaRef}
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setValidationError('');
              }}
              placeholder="Provide a detailed administrative reason for revoking this verified outcome (minimum 10 characters)..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition resize-none disabled:bg-slate-100 disabled:text-slate-400"
              aria-describedby="reason-help-text"
            />
            <p id="reason-help-text" className="text-[11px] text-slate-400">
              The reason will be permanently recorded in the outcome audit history.
            </p>
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
              disabled={!isLengthValid || isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Revoking...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm Revocation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RevokeOutcomeModal;

