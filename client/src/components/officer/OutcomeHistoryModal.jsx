import { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  IndianRupee,
  FileText,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import { formatCtc } from '../../utils/placementMetrics';

/**
 * CPMS Phase 4D Stage C - Outcome History Modal Dialog
 * 
 * Strict specifications:
 * - Read-only chronological audit log of actions: verified, revoked, reverified.
 * - Shows timestamp, officer name, reason (for revocations only), and package ("Not specified" when null).
 * - No edit or delete controls.
 * - Focus trap and Escape handling.
 */
const OutcomeHistoryModal = ({ item, isOpen, onClose }) => {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    if (isOpen && item?.applicationId) {
      setLoading(true);
      setError('');
      setHistoryList([]);

      officerService
        .getOutcomeHistory(item.applicationId)
        .then((res) => {
          if (!isCurrent) return;
          if (res.success && Array.isArray(res.data?.history)) {
            setHistoryList(res.data.history);
          } else if (Array.isArray(res.history)) {
            setHistoryList(res.history);
          } else {
            setError(res.message || 'Unable to retrieve outcome audit history.');
          }
        })
        .catch((err) => {
          if (!isCurrent) return;
          setError(
            err.response?.data?.message ||
              'Server error loading outcome history. Please retry.'
          );
        })
        .finally(() => {
          if (isCurrent) {
            setLoading(false);
          }
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [isOpen, item]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Verified</span>
          </span>
        );
      case 'reverified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <RotateCcw className="w-3 h-3 text-teal-600" />
            <span>Re-verified</span>
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Revoked</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span>{action}</span>
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <History className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="history-modal-title" className="text-base font-bold text-white leading-tight">
                Placement Outcome Audit History
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Read-only verification and revocation event log
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Candidate & Drive Context Header */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-400">Candidate: </span>
              <span className="font-bold text-slate-900">{item.studentName}</span>
              {item.rollNumber && (
                <span className="ml-1.5 font-mono text-slate-600">({item.rollNumber})</span>
              )}
            </div>
            <div className="text-slate-300">|</div>
            <div>
              <span className="text-slate-400">Dept: </span>
              <span className="font-medium text-slate-700">{item.departmentName}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Drive: </span>
            <span className="font-semibold text-slate-900">
              {item.company} — {item.role}
            </span>
          </div>
        </div>

        {/* Modal Body / History Timeline */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-xs text-slate-500 font-medium">Loading audit history...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <p className="font-semibold text-slate-700">No History Records Available</p>
              <p className="mt-1 text-slate-400">
                No past verification or revocation events have been recorded for this application.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {historyList.map((entry, index) => {
                const officerName =
                  entry.changedBy?.name || entry.changedByName || 'Placement Officer';
                const isRevocation = entry.action === 'revoked';

                return (
                  <div key={index} className="relative group">
                    {/* Timeline bullet dot */}
                    <div
                      className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                        isRevocation ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />

                    {/* Entry Card */}
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5 hover:bg-slate-50 transition">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action)}
                          <span className="font-semibold text-slate-800">
                            By {officerName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatDate(entry.changedAt)}
                        </span>
                      </div>

                      {/* Package details for verify/reverify */}
                      {!isRevocation && (
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium pt-1 border-t border-slate-200/60">
                          <span className="text-slate-400">Recorded Package:</span>
                          <span className="font-bold text-slate-900">
                            {entry.ctc !== null && entry.ctc !== undefined ? formatCtc(entry.ctc) : 'Not specified'}
                          </span>
                        </div>
                      )}

                      {/* Reason for revocation */}
                      {isRevocation && (
                        <div className="pt-2 border-t border-slate-200/60 space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                            Revocation Reason:
                          </span>
                          <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed font-sans">
                            {entry.reason || 'No specific reason entered.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Read-only audit trail</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutcomeHistoryModal;

