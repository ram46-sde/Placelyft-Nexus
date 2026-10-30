import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';
import {
  Mail,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  FileText,
  Loader2,
  Save,
  AlertCircle,
  Plus,
  Trash2,
  Camera,
  Award,
  Upload,
  X,
} from 'lucide-react';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ProfilePage = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Photo upload local state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState({
    rollNumber: '',
    department: '',
    course: '',
    batch: '',
    cgpa: '',
    tenthPercentage: '',
    twelfthPercentage: '',
    ugPercentage: '',
    backlogs: 0,
    skills: '',
    resumeUrl: '',
    profilePhotoUrl: '',
    projects: [],
    certifications: [],
    achievements: [],
  });

  useEffect(() => {
    fetchProfile();
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await profileService.getProfile();
      if (res.success && res.profile) {
        const p = res.profile;
        setFormData({
          rollNumber: p.rollNumber || '',
          department: p.department || '',
          course: p.course || '',
          batch: p.batch || '',
          cgpa: p.cgpa !== undefined && p.cgpa !== null ? p.cgpa : '',
          tenthPercentage: p.tenthPercentage !== undefined && p.tenthPercentage !== null ? p.tenthPercentage : '',
          twelfthPercentage: p.twelfthPercentage !== undefined && p.twelfthPercentage !== null ? p.twelfthPercentage : '',
          ugPercentage: p.ugPercentage !== undefined && p.ugPercentage !== null ? p.ugPercentage : '',
          backlogs: p.backlogs || 0,
          skills: p.skills ? p.skills.join(', ') : '',
          resumeUrl: p.resumeUrl || '',
          profilePhotoUrl: p.profilePhotoUrl || '',
          projects: p.projects || [],
          certifications: p.certifications || [],
          achievements: p.achievements || [],
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      const errorText = error.response?.data?.message || 'Failed to load profile data.';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- Photo Upload Handlers ---
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setMessage({
        type: 'error',
        text: 'Unsupported image format. Please select a JPEG, PNG, or WebP image.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMessage({
        type: 'error',
        text: 'File size exceeds the 5 MB limit. Please select a smaller image.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clear previous object URL if any
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
    setMessage({ type: '', text: '' });
  };

  const handleCancelPhotoSelection = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;

    try {
      setUploadingPhoto(true);
      setMessage({ type: '', text: '' });

      const uploadPayload = new FormData();
      uploadPayload.append('photo', photoFile);

      const res = await profileService.uploadProfilePhoto(uploadPayload);
      if (res.success) {
        const newPhotoUrl = res.photoUrl || res.profile?.profilePhotoUrl;
        setFormData((prev) => ({ ...prev, profilePhotoUrl: newPhotoUrl }));
        handleCancelPhotoSelection();
        setMessage({ type: 'success', text: 'Profile photo uploaded successfully!' });
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to upload photo.' });
      }
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      const errorMsg =
        error.response?.data?.message || 'Failed to upload photo. Please try again.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // --- Project Handlers ---
  const handleProjectChange = (index, field, value) => {
    const updatedProjects = [...formData.projects];
    updatedProjects[index][field] = value;
    setFormData((prev) => ({ ...prev, projects: updatedProjects }));
  };

  const addProject = () => {
    setFormData((prev) => ({
      ...prev,
      projects: [...prev.projects, { title: '', description: '', link: '' }],
    }));
  };

  const removeProject = (index) => {
    const updatedProjects = formData.projects.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, projects: updatedProjects }));
  };

  // --- Certification Handlers ---
  const handleCertificationChange = (index, field, value) => {
    const updatedCerts = [...formData.certifications];
    updatedCerts[index][field] = value;
    setFormData((prev) => ({ ...prev, certifications: updatedCerts }));
  };

  const addCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [...prev.certifications, { name: '', issuer: '', date: '', url: '' }],
    }));
  };

  const removeCertification = (index) => {
    const updatedCerts = formData.certifications.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, certifications: updatedCerts }));
  };

  // --- Achievement Handlers ---
  const handleAchievementChange = (index, field, value) => {
    const updatedAchievements = [...formData.achievements];
    updatedAchievements[index][field] = value;
    setFormData((prev) => ({ ...prev, achievements: updatedAchievements }));
  };

  const addAchievement = () => {
    setFormData((prev) => ({
      ...prev,
      achievements: [
        ...prev.achievements,
        { title: '', description: '', date: '', issuer: '', certificateUrl: '' },
      ],
    }));
  };

  const removeAchievement = (index) => {
    const updatedAchievements = formData.achievements.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, achievements: updatedAchievements }));
  };

  // --- Overall Profile Save Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const parseAcademicField = (val, max, label) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > max) {
        throw new Error(`${label} must be a number between 0 and ${max}.`);
      }
      return num;
    };

    let parsedCgpa = null;
    let parsedTenth = null;
    let parsedTwelfth = null;
    let parsedUgPct = null;

    try {
      parsedCgpa = parseAcademicField(formData.cgpa, 10, 'Undergraduate CGPA');
      parsedTenth = parseAcademicField(formData.tenthPercentage, 100, '10th Standard percentage');
      parsedTwelfth = parseAcademicField(formData.twelfthPercentage, 100, '12th Standard / Diploma percentage');
      parsedUgPct = parseAcademicField(formData.ugPercentage, 100, 'Undergraduate percentage');
    } catch (validationErr) {
      setMessage({ type: 'error', text: validationErr.message });
      setSaving(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        cgpa: parsedCgpa,
        tenthPercentage: parsedTenth,
        twelfthPercentage: parsedTwelfth,
        ugPercentage: parsedUgPct,
        backlogs: parseInt(formData.backlogs) || 0,
        skills: formData.skills.split(',').map((s) => s.trim()).filter((s) => s),
      };

      const res = await profileService.updateProfile(submitData);
      if (res.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (error) {
      const errorText = error.response?.data?.message || 'Failed to update profile.';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setSaving(false);
      setTimeout(() => {
        setMessage((prev) => (prev.type === 'success' ? { type: '', text: '' } : prev));
      }, 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const activePhotoSrc = photoPreview || formData.profilePhotoUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your photo, academic details, skills, certifications, and portfolio
        </p>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 shrink-0 ${
              message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'
            }`}
          />
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Account Info & Profile Photo Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Circular Profile Photo Preview */}
            <div className="relative group">
              {activePhotoSrc ? (
                <img
                  src={activePhotoSrc}
                  alt={user?.name || 'Profile'}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-100 shadow-md border border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-600/20 ring-4 ring-indigo-100">
                  {user?.name?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
              {photoPreview && (
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow">
                  Preview
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> {user?.email}
                </span>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                </div>
              </div>
            </div>
          </div>

          {/* Profile Photo Actions */}
          <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
              id="student-photo-input"
            />

            {photoPreview ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUploadPhoto}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition shadow-xs cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingPhoto ? 'Uploading...' : 'Confirm Upload'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPhotoSelection}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition cursor-pointer"
                  title="Cancel selection"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>{formData.profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
            )}

            <span className="text-[11px] text-slate-400">
              Supported: JPEG, PNG, WebP (Max 5 MB)
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Academic Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Academic Details</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Roll Number / Scholar No.
              </label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 21BCS001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. Computer Science"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Course / Degree
              </label>
              <input
                type="text"
                name="course"
                value={formData.course}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. B.Tech"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Graduation Batch (Year)
              </label>
              <input
                type="text"
                name="batch"
                value={formData.batch}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 2025"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                10th Standard Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="tenthPercentage"
                id="tenthPercentage"
                value={formData.tenthPercentage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 85.5"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Required by drives with a 10th standard cutoff</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                12th Standard / Diploma Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="twelfthPercentage"
                id="twelfthPercentage"
                value={formData.twelfthPercentage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 88.0"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Required by drives with a 12th/Diploma cutoff</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current UG CGPA (0 - 10)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                name="cgpa"
                id="cgpa"
                value={formData.cgpa}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 8.5"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Evaluated when a drive requires CGPA basis</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current UG Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="ugPercentage"
                id="ugPercentage"
                value={formData.ugPercentage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 78.5"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Evaluated when a drive requires Percentage basis</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Active Backlogs
              </label>
              <input
                type="number"
                min="0"
                name="backlogs"
                id="backlogs"
                value={formData.backlogs}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Skills & Resume */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Professional Profile</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Skills (comma separated)
              </label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. React, Node.js, Python, MongoDB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resume Link (URL)
              </label>
              <div className="flex items-center relative">
                <FileText className="w-4 h-4 absolute left-3 text-slate-400" />
                <input
                  type="url"
                  name="resumeUrl"
                  value={formData.resumeUrl}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Provide a link to your hosted resume (Google Drive, Dropbox, etc.)
              </p>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Projects</h3>
            </div>
            <button
              type="button"
              onClick={addProject}
              className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Project
            </button>
          </div>
          <div className="p-6 space-y-6">
            {formData.projects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No projects added yet. Adding projects improves your profile visibility.
              </p>
            ) : (
              formData.projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeProject(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Remove Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid gap-4 mr-6">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Project Title *
                      </label>
                      <input
                        type="text"
                        value={proj.title}
                        onChange={(e) => handleProjectChange(idx, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Project Link (GitHub/Live)
                      </label>
                      <input
                        type="url"
                        value={proj.link || ''}
                        onChange={(e) => handleProjectChange(idx, 'link', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="https://"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Description
                      </label>
                      <textarea
                        value={proj.description || ''}
                        onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Briefly describe the project..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Certifications Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Certifications</h3>
            </div>
            <button
              type="button"
              onClick={addCertification}
              className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Certification
            </button>
          </div>
          <div className="p-6 space-y-6">
            {formData.certifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No certifications added yet. Showcase your professional credentials and courses.
              </p>
            ) : (
              formData.certifications.map((cert, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Remove Certification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid gap-4 mr-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Certification Name *
                      </label>
                      <input
                        type="text"
                        value={cert.name}
                        onChange={(e) => handleCertificationChange(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. AWS Certified Solutions Architect"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Issuer
                      </label>
                      <input
                        type="text"
                        value={cert.issuer || ''}
                        onChange={(e) => handleCertificationChange(idx, 'issuer', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. Amazon Web Services"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Date / Year
                      </label>
                      <input
                        type="text"
                        value={cert.date || ''}
                        onChange={(e) => handleCertificationChange(idx, 'date', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. 2024"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Credential URL
                      </label>
                      <input
                        type="url"
                        value={cert.url || ''}
                        onChange={(e) => handleCertificationChange(idx, 'url', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Achievements</h3>
            </div>
            <button
              type="button"
              onClick={addAchievement}
              className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Achievement
            </button>
          </div>
          <div className="p-6 space-y-6">
            {formData.achievements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No achievements added yet. Highlight your awards, hackathons, and honors.
              </p>
            ) : (
              formData.achievements.map((ach, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeAchievement(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Remove Achievement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid gap-4 mr-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Achievement Title *
                      </label>
                      <input
                        type="text"
                        value={ach.title}
                        onChange={(e) => handleAchievementChange(idx, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. 1st Place - Smart India Hackathon"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Issuer / Organization
                      </label>
                      <input
                        type="text"
                        value={ach.issuer || ''}
                        onChange={(e) => handleAchievementChange(idx, 'issuer', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. Ministry of Education"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Date / Year
                      </label>
                      <input
                        type="text"
                        value={ach.date || ''}
                        onChange={(e) => handleAchievementChange(idx, 'date', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. March 2024"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Certificate / Evidence URL
                      </label>
                      <input
                        type="url"
                        value={ach.certificateUrl || ''}
                        onChange={(e) =>
                          handleAchievementChange(idx, 'certificateUrl', e.target.value)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="https://"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Description
                      </label>
                      <textarea
                        value={ach.description || ''}
                        onChange={(e) =>
                          handleAchievementChange(idx, 'description', e.target.value)
                        }
                        rows="2"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Briefly describe what you achieved..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-70 transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
