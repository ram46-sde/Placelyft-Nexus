import { useState } from 'react';
import { officerService } from '../../services/officerService';
import { X, Briefcase, Building2, Calendar, FileText, CheckCircle2, Loader2, AlertCircle, MapPin } from 'lucide-react';

const CreateDriveModal = ({ isOpen, onClose, onDriveCreated }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    website: '',
    companyDescription: '',
    companyLocation: '',
    jobRole: '',
    jobDescription: '',
    packageDetails: '',
    driveDate: '',
    registrationDeadline: '',
    isActive: true,
    minTenthPercentage: '0',
    minTwelfthPercentage: '0',
    ugCriteriaType: '',
    minCgpa: '',
    minUgPercentage: '',
    maxBacklogs: '0',
    requiredCoursesInput: '',
    requiredSkillsInput: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    // 1. Client-side field validations
    if (!formData.companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    if (!formData.companyLocation || !formData.companyLocation.trim()) {
      setError('Company location is required.');
      return;
    }

    const sanitizedLocation = formData.companyLocation.trim().replace(/\s+/g, ' ');
    if (sanitizedLocation.length < 2 || sanitizedLocation.length > 100) {
      setError('Company location must be between 2 and 100 characters.');
      return;
    }

    if (!/^[\p{L}\p{N}\s,.\-()&/]+$/u.test(sanitizedLocation)) {
      setError('Company location contains invalid characters. Allowed: letters, numbers, spaces, and (, . - ( ) & /).');
      return;
    }

    if (!/[\p{L}\p{N}]/u.test(sanitizedLocation)) {
      setError('Company location cannot consist solely of punctuation or whitespace.');
      return;
    }

    if (!formData.jobRole.trim()) {
      setError('Job role is required.');
      return;
    }

    if (!formData.jobDescription.trim()) {
      setError('Job description is required.');
      return;
    }

    if (!formData.driveDate) {
      setError('Drive date is required.');
      return;
    }

    if (!formData.registrationDeadline) {
      setError('Registration deadline is required.');
      return;
    }

    const driveDateObj = new Date(formData.driveDate);
    const deadlineObj = new Date(formData.registrationDeadline);

    if (isNaN(driveDateObj.getTime())) {
      setError('Please provide a valid drive date.');
      return;
    }

    if (isNaN(deadlineObj.getTime())) {
      setError('Please provide a valid registration deadline.');
      return;
    }

    if (deadlineObj > driveDateObj) {
      setError('Registration deadline must be on or before the drive date.');
      return;
    }

    // 10th Standard Percentage validation
    let minTenthNum = 0;
    if (formData.minTenthPercentage && formData.minTenthPercentage.trim() !== '') {
      minTenthNum = parseFloat(formData.minTenthPercentage);
      if (isNaN(minTenthNum) || minTenthNum < 0 || minTenthNum > 100) {
        setError('Minimum 10th percentage must be a number between 0 and 100.');
        return;
      }
    }

    // 12th Standard / Diploma Percentage validation
    let minTwelfthNum = 0;
    if (formData.minTwelfthPercentage && formData.minTwelfthPercentage.trim() !== '') {
      minTwelfthNum = parseFloat(formData.minTwelfthPercentage);
      if (isNaN(minTwelfthNum) || minTwelfthNum < 0 || minTwelfthNum > 100) {
        setError('Minimum 12th / Diploma percentage must be a number between 0 and 100.');
        return;
      }
    }

    // UG Criteria Type validation (MANDATORY explicit selection)
    if (!formData.ugCriteriaType || !['CGPA', 'PERCENTAGE', 'NONE'].includes(formData.ugCriteriaType)) {
      setError('Please select an Undergraduate (UG) eligibility basis (CGPA, Percentage, or None).');
      return;
    }

    let minCgpaNum = 0;
    let minUgPercentageNum = 0;

    if (formData.ugCriteriaType === 'CGPA') {
      if (!formData.minCgpa || formData.minCgpa.trim() === '') {
        setError('Please enter a valid positive Minimum CGPA threshold.');
        return;
      }
      minCgpaNum = parseFloat(formData.minCgpa);
      if (isNaN(minCgpaNum) || minCgpaNum <= 0 || minCgpaNum > 10) {
        setError('Minimum CGPA must be a positive number between 0 and 10.');
        return;
      }
    } else if (formData.ugCriteriaType === 'PERCENTAGE') {
      if (!formData.minUgPercentage || formData.minUgPercentage.trim() === '') {
        setError('Please enter a valid positive Minimum UG Percentage threshold.');
        return;
      }
      minUgPercentageNum = parseFloat(formData.minUgPercentage);
      if (isNaN(minUgPercentageNum) || minUgPercentageNum <= 0 || minUgPercentageNum > 100) {
        setError('Minimum UG percentage must be a positive number between 0 and 100.');
        return;
      }
    } else if (formData.ugCriteriaType === 'NONE') {
      minCgpaNum = 0;
      minUgPercentageNum = 0;
    }

    const maxBacklogsNum = parseInt(formData.maxBacklogs, 10);
    if (isNaN(maxBacklogsNum) || maxBacklogsNum < 0) {
      setError('Maximum backlogs must be a non-negative integer.');
      return;
    }

    // 2. Format payload conforming to backend PlacementDrive API contract
    const payload = {
      companyName: formData.companyName.trim(),
      industry: formData.industry.trim() || undefined,
      website: formData.website.trim() || undefined,
      companyDescription: formData.companyDescription.trim() || undefined,
      companyLocation: sanitizedLocation,
      jobRole: formData.jobRole.trim(),
      jobDescription: formData.jobDescription.trim(),
      packageDetails: formData.packageDetails.trim() || undefined,
      driveDate: driveDateObj.toISOString(),
      registrationDeadline: deadlineObj.toISOString(),
      isActive: Boolean(formData.isActive),
      eligibilityCriteria: {
        minTenthPercentage: minTenthNum,
        minTwelfthPercentage: minTwelfthNum,
        ugCriteriaType: formData.ugCriteriaType,
        minCgpa: minCgpaNum,
        minUgPercentage: minUgPercentageNum,
        maxBacklogs: maxBacklogsNum,
        requiredCourses: formData.requiredCoursesInput
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        requiredSkills: formData.requiredSkillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    };

    try {
      setSubmitting(true);
      const res = await officerService.createDrive(payload);
      if (res.success && res.drive) {
        onDriveCreated(res.drive);
        onClose();
      } else {
        setError(res.message || 'Failed to create placement drive.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error creating placement drive.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Create Placement Drive</h2>
              <p className="text-xs text-slate-300">Publish a new campus recruitment drive for students</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Company Details */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Company Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="e.g. Google, Microsoft, Apex Labs"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  placeholder="e.g. Software, Financial Tech, Cloud"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://company.example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Description</label>
                <input
                  type="text"
                  name="companyDescription"
                  value={formData.companyDescription}
                  onChange={handleChange}
                  placeholder="Brief overview of company operations"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Location <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    name="companyLocation"
                    value={formData.companyLocation}
                    onChange={handleChange}
                    placeholder="e.g. Coimbatore, Tamil Nadu, India"
                    maxLength={100}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Job Role & Compensation */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Job Role & Package</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Role <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="jobRole"
                  value={formData.jobRole}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer, Data Analyst"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Package (CTC Details)</label>
                <input
                  type="text"
                  name="packageDetails"
                  value={formData.packageDetails}
                  onChange={handleChange}
                  placeholder="e.g. 12 LPA or 8-10 LPA"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleChange}
                  rows={3}
                  maxLength={5000}
                  placeholder="Describe key responsibilities, requirements, and candidate expectations..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
                <p className={`text-[11px] mt-0.5 text-right ${formData.jobDescription.length > 4800 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                  {formData.jobDescription.length}/5000
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Important Dates */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Drive Schedule & Deadlines</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Drive Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="driveDate"
                  value={formData.driveDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Deadline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
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

          {/* Section 4: Eligibility Criteria */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Candidate Eligibility</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min 10th Standard % (0 - 100)
                </label>
                <input
                  type="number"
                  name="minTenthPercentage"
                  id="officer-minTenthPercentage"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min 12th / Diploma % (0 - 100)
                </label>
                <input
                  type="number"
                  name="minTwelfthPercentage"
                  id="officer-minTwelfthPercentage"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Undergraduate (UG) Criteria Basis <span className="text-rose-500">*</span>
                </label>
                <select
                  name="ugCriteriaType"
                  id="officer-ugCriteriaType"
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
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Minimum CGPA Threshold (0 - 10) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="minCgpa"
                    id="officer-minCgpa"
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
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Minimum UG Percentage Threshold (0 - 100) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="minUgPercentage"
                    id="officer-minUgPercentage"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Max Active Backlogs Allowed</label>
                <input
                  type="number"
                  name="maxBacklogs"
                  id="officer-maxBacklogs"
                  value={formData.maxBacklogs}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Courses (comma-separated)
                </label>
                <input
                  type="text"
                  name="requiredCoursesInput"
                  id="officer-requiredCoursesInput"
                  value={formData.requiredCoursesInput}
                  onChange={handleChange}
                  placeholder="e.g. B.Tech, MCA, M.Tech"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  type="text"
                  name="requiredSkillsInput"
                  id="officer-requiredSkillsInput"
                  value={formData.requiredSkillsInput}
                  onChange={handleChange}
                  placeholder="e.g. React, Node.js, Python, SQL"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <label htmlFor="isActive" className="text-xs font-medium text-slate-700 cursor-pointer">
              Publish as active drive immediately (visible to students in your college)
            </label>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer"
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
                  <span>Creating Drive...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Placement Drive</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDriveModal;
