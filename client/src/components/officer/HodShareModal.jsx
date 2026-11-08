import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Share2,
  Mail,
  Copy,
  Check,
  Building2,
  User,
  Phone,
  FileText,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  Users,
} from 'lucide-react';

/**
 * Format a phone number for WhatsApp wa.me link.
 * Removes all non-digit characters. If 10 digits, prepends 91 (India).
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const HodShareModal = ({
  isOpen,
  onClose,
  departments = [],
  initialDepartment = '__ALL__',
  collegeDepartments = [],
  driveInfo = {},
  driveDate,
  officerName = 'Placement Officer',
  onOpenHodSettings,
  onNotify,
}) => {
  // Target department to share
  const [selectedDeptName, setSelectedDeptName] = useState('__ALL__');
  const [includeRoster, setIncludeRoster] = useState(true);
  const [includeAbsentOnly, setIncludeAbsentOnly] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync initial department when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialDepartment && initialDepartment !== '__ALL__') {
        setSelectedDeptName(initialDepartment);
      } else if (departments.length > 0) {
        // Default to first department with applicants, or '__ALL__'
        const firstWithApps = departments.find((d) => d.applicants?.length > 0);
        setSelectedDeptName(firstWithApps ? firstWithApps.departmentName : '__ALL__');
      } else {
        setSelectedDeptName('__ALL__');
      }
      setCopied(false);
    }
  }, [isOpen, initialDepartment, departments]);

  // Selected department attendance group
  const targetGroup = useMemo(() => {
    if (selectedDeptName === '__ALL__') {
      const allApplicants = departments.flatMap((d) => d.applicants || []);
      const total = allApplicants.length;
      const present = allApplicants.filter((a) => a.status === 'Present').length;
      const absent = allApplicants.filter((a) => a.status === 'Absent').length;
      const pending = allApplicants.filter((a) => a.status === 'Pending').length;
      return {
        departmentName: 'All Departments',
        totals: { total, present, absent, pending },
        applicants: allApplicants,
      };
    }
    return departments.find((d) => d.departmentName === selectedDeptName) || {
      departmentName: selectedDeptName,
      totals: { total: 0, present: 0, absent: 0, pending: 0 },
      applicants: [],
    };
  }, [departments, selectedDeptName]);

  // Find HOD contact from collegeDepartments
  const matchedCollegeDept = useMemo(() => {
    if (selectedDeptName === '__ALL__') return null;
    return collegeDepartments.find(
      (cd) =>
        cd.name?.trim().toLowerCase() === selectedDeptName?.trim().toLowerCase() ||
        cd.code?.trim().toLowerCase() === targetGroup.departmentCode?.trim().toLowerCase()
    );
  }, [collegeDepartments, selectedDeptName, targetGroup]);

  const hodContact = matchedCollegeDept?.hodContact;

  // Sync phone and email when department changes
  useEffect(() => {
    if (hodContact?.phone) {
      setCustomPhone(hodContact.phone);
    } else {
      setCustomPhone('');
    }
    if (hodContact?.email) {
      setCustomEmail(hodContact.email);
    } else {
      setCustomEmail('');
    }
  }, [hodContact, selectedDeptName]);

  // Formatted date string
  const formattedDriveDate = useMemo(() => {
    if (!driveDate) return 'N/A';
    try {
      return new Date(driveDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  }, [driveDate]);

  // Generate share message
  const shareMessage = useMemo(() => {
    const lines = [];
    const comp = driveInfo.company || 'Placement Drive';
    const role = driveInfo.jobRole || 'Recruitment';
    const dept = targetGroup.departmentName;
    const totals = targetGroup.totals || { total: 0, present: 0, absent: 0, pending: 0 };
    const apps = targetGroup.applicants || [];

    lines.push(`*CAMPUS PLACEMENT ATTENDANCE REPORT*`);
    lines.push(`----------------------------------------`);
    lines.push(`🏢 *Company:* ${comp}`);
    lines.push(`💼 *Role:* ${role}`);
    lines.push(`📅 *Drive Date:* ${formattedDriveDate}`);
    lines.push(`🎓 *Department:* ${dept}`);
    lines.push(``);
    lines.push(`📊 *Attendance Summary:*`);
    lines.push(`• Total Registered: ${totals.total}`);
    lines.push(`• Present: ${totals.present}`);
    lines.push(`• Absent: ${totals.absent}`);
    lines.push(`• Pending: ${totals.pending}`);

    if (includeRoster && apps.length > 0) {
      const presentApps = apps.filter((a) => a.status === 'Present');
      const absentApps = apps.filter((a) => a.status === 'Absent');
      const pendingApps = apps.filter((a) => a.status === 'Pending');

      if (!includeAbsentOnly && presentApps.length > 0) {
        lines.push(``);
        lines.push(`✅ *Present Students (${presentApps.length}):*`);
        presentApps.forEach((a, idx) => {
          const roll = a.rollNumber ? `[${a.rollNumber}] ` : '';
          lines.push(`${idx + 1}. ${roll}${a.studentName}`);
        });
      }

      if (absentApps.length > 0) {
        lines.push(``);
        lines.push(`❌ *Absent Students (${absentApps.length}):*`);
        absentApps.forEach((a, idx) => {
          const roll = a.rollNumber ? `[${a.rollNumber}] ` : '';
          lines.push(`${idx + 1}. ${roll}${a.studentName}`);
        });
      }

      if (!includeAbsentOnly && pendingApps.length > 0) {
        lines.push(``);
        lines.push(`⏳ *Pending Attendance (${pendingApps.length}):*`);
        pendingApps.forEach((a, idx) => {
          const roll = a.rollNumber ? `[${a.rollNumber}] ` : '';
          lines.push(`${idx + 1}. ${roll}${a.studentName}`);
        });
      }
    }

    lines.push(``);
    lines.push(`----------------------------------------`);
    const nowStr = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    lines.push(`Generated by Placement Officer ${officerName} on ${nowStr} via CPMS.`);

    return lines.join('\n');
  }, [
    driveInfo,
    formattedDriveDate,
    targetGroup,
    includeRoster,
    includeAbsentOnly,
    officerName,
  ]);

  if (!isOpen) return null;

  // Handlers
  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareMessage;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      onNotify?.('success', 'Attendance summary copied to clipboard.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      onNotify?.('error', 'Failed to copy to clipboard.');
    }
  };

  const handleWhatsApp = () => {
    const cleaned = cleanPhoneNumber(customPhone);
    let waUrl = '';
    if (cleaned) {
      waUrl = `https://wa.me/${cleaned}?text=${encodeURIComponent(shareMessage)}`;
    } else {
      // Direct share link if no phone specified
      waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    // Mandated exact copy: "WhatsApp opened. Review and send there."
    onNotify?.('info', 'WhatsApp opened. Review and send there.');
  };

  const handleEmail = () => {
    const emailTo = customEmail?.trim() || '';
    const subject = `[CPMS] Drive Attendance Report: ${driveInfo.company || 'Placement Drive'} - ${targetGroup.departmentName}`;
    const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;

    window.location.href = mailtoUrl;
    onNotify?.('info', 'Email client opened. Review and send there.');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Share Attendance with HOD</h2>
              <p className="text-xs text-slate-300">
                Generate formatted reports for WhatsApp, Email, or Clipboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close share modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Department Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Department to Share
            </label>
            <select
              value={selectedDeptName}
              onChange={(e) => setSelectedDeptName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none cursor-pointer"
            >
              <option value="__ALL__">All Departments (Overall Summary)</option>
              {departments.map((d) => (
                <option key={d.departmentName} value={d.departmentName}>
                  {d.departmentName} ({d.totals?.total || 0} applicants)
                </option>
              ))}
            </select>
          </div>

          {/* HOD Contact Information Card */}
          {selectedDeptName !== '__ALL__' && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  HOD Contact Info
                </span>
                {matchedCollegeDept ? (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenHodSettings?.(matchedCollegeDept._id);
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                  >
                    Edit Contact in Settings
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">Department unconfigured</span>
                )}
              </div>

              {hodContact?.name ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">HOD Name</span>
                    <span className="font-semibold text-slate-900">{hodContact.name}</span>
                  </div>
                  {hodContact.officeLocation && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Office Location</span>
                      <span className="text-slate-700">{hodContact.officeLocation}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">No HOD contact recorded for this department.</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      You can enter a phone number and email manually below, or configure it in{' '}
                      <button
                        onClick={() => {
                          onClose();
                          onOpenHodSettings?.();
                        }}
                        className="underline font-semibold hover:text-amber-900 cursor-pointer"
                      >
                        HOD Contact Settings
                      </button>
                      .
                    </p>
                  </div>
                </div>
              )}

              {/* Editable overrides */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    WhatsApp Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="hod@college.edu"
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
              Content Options:
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={includeRoster}
                onChange={(e) => setIncludeRoster(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
              />
              <span>Include Student Roster</span>
            </label>

            {includeRoster && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={includeAbsentOnly}
                  onChange={(e) => setIncludeAbsentOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500/30 cursor-pointer"
                />
                <span>Absent List Only (Compact)</span>
              </label>
            )}
          </div>

          {/* Live Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Message Preview
              </label>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Preview'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800 shadow-inner">
              {shareMessage}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500">
            Clicking a channel opens the app with message prefilled.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>Copy Text</span>
            </button>

            <button
              onClick={handleEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Share via Email</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodShareModal;
