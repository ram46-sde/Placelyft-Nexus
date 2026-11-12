import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  ExternalLink,
  CheckCircle2,
  User,
  Code2,
  FolderGit2,
  Trophy,
  Sparkles,
  Lock,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { getDepartmentLabel } from '../../utils/studentProfileUtils';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ProfilePage = () => {
  const { user, setStudentProfile } = useAuth();
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
    section: '',
    academicYear: '',
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
    // Guard: only students are authorized to load student profile endpoints
    if (user && user.role !== 'student') {
      setLoading(false);
      return;
    }

    fetchProfile();
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [user]);

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
          section: p.section || '',
          academicYear: p.academicYear || '',
          cgpa: p.cgpa !== undefined && p.cgpa !== null ? p.cgpa : '',
          tenthPercentage:
            p.tenthPercentage !== undefined && p.tenthPercentage !== null ? p.tenthPercentage : '',
          twelfthPercentage:
            p.twelfthPercentage !== undefined && p.twelfthPercentage !== null
              ? p.twelfthPercentage
              : '',
          ugPercentage:
            p.ugPercentage !== undefined && p.ugPercentage !== null ? p.ugPercentage : '',
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
    if (!photoFile || uploadingPhoto) return;

    try {
      setUploadingPhoto(true);
      setMessage({ type: '', text: '' });

      const uploadPayload = new FormData();
      uploadPayload.append('photo', photoFile);

      const res = await profileService.uploadProfilePhoto(uploadPayload);
      if (res.success) {
        const newPhotoUrl = res.photoUrl || res.profile?.profilePhotoUrl;
        setFormData((prev) => ({ ...prev, profilePhotoUrl: newPhotoUrl }));
        if (setStudentProfile && res.profile) {
          setStudentProfile(res.profile);
        }
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
      parsedTwelfth = parseAcademicField(
        formData.twelfthPercentage,
        100,
        '12th Standard / Diploma percentage'
      );
      parsedUgPct = parseAcademicField(formData.ugPercentage, 100, 'Undergraduate percentage');
    } catch (validationErr) {
      setMessage({ type: 'error', text: validationErr.message });
      setSaving(false);
      return;
    }

    const trimmedSection = typeof formData.section === 'string' ? formData.section.trim() : '';
    const selectedYear =
      typeof formData.academicYear === 'string' ? formData.academicYear.trim() : '';

    if (selectedYear && !['I', 'II', 'III', 'IV'].includes(selectedYear)) {
      setMessage({ type: 'error', text: 'Academic year must be one of: I, II, III, IV.' });
      setSaving(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        section: trimmedSection.length > 0 ? trimmedSection : null,
        academicYear: selectedYear.length > 0 ? selectedYear : null,
        cgpa: parsedCgpa,
        tenthPercentage: parsedTenth,
        twelfthPercentage: parsedTwelfth,
        ugPercentage: parsedUgPct,
        backlogs: parseInt(formData.backlogs) || 0,
        skills: formData.skills
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s),
      };

      const res = await profileService.updateProfile(submitData);
      if (res.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        if (res.profile) {
          setFormData((prev) => ({
            ...prev,
            section: res.profile.section || '',
            academicYear: res.profile.academicYear || '',
          }));
          if (setStudentProfile) {
            setStudentProfile(res.profile);
          }
        }
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

  // Derive live skills tags from comma-separated input
  const parsedSkills = useMemo(() => {
    if (!formData.skills || typeof formData.skills !== 'string') return [];
    return formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [formData.skills]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (user && user.role !== 'student') {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="text-center p-8">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Officer Portal Account Active</h2>
          <p className="text-sm text-slate-600 mb-6">
            You are currently signed in with an institutional officer account (<span className="font-semibold text-slate-800">{user?.email}</span>). Student portfolio profiles are managed exclusively by student accounts.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/officer/dashboard"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
            >
              Go to Officer Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const activePhotoSrc = photoPreview || formData.profilePhotoUrl;
  const departmentLabel = getDepartmentLabel(formData);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Page Title & Breadcrumb Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Student Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your personal identity, academic credentials, verified skills, and portfolio.
          </p>
        </div>

        {/* Header Save Shortcut Button */}
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow transition disabled:opacity-60 cursor-pointer min-h-[44px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {message.text && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* 1. Profile Header & Portfolio Identity Card */}
      <Card padding="p-0" className="overflow-hidden border border-slate-200/80 shadow-xs">
        {/* Decorative Top Gradient Banner */}
        <div className="h-32 sm:h-36 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute -bottom-8 -right-8 w-44 h-44 bg-white/10 rounded-full blur-xl" />
        </div>

        {/* Profile Identity Content Area */}
        <div className="px-6 pb-6 pt-0">
          {/* Top Row: Avatar overlapping banner on left, Photo controls on right */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
            {/* Circular Avatar */}
            <div className="relative group shrink-0 self-start sm:self-auto">
              {activePhotoSrc ? (
                <img
                  src={activePhotoSrc}
                  alt={user?.name || 'Profile photo'}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white shadow-md bg-white border border-slate-200"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-md ring-4 ring-white">
                  {user?.name?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
              {photoPreview && (
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                  Preview
                </span>
              )}
            </div>

            {/* Profile Photo Controls */}
            <div className="flex flex-col sm:items-end gap-1.5 pt-2 sm:pt-0">
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 transition shadow-xs cursor-pointer min-h-[38px]"
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
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer min-h-[38px]"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition border border-slate-300 hover:border-slate-400 cursor-pointer shadow-2xs min-h-[38px]"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formData.profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                </button>
              )}

              <span className="text-[11px] text-slate-400">Supported: JPEG, PNG, WebP (Max 5 MB)</span>
            </div>
          </div>

          {/* Dedicated Student Identity Section (Fully on white card surface, zero banner overlap) */}
          <div className="space-y-2 pt-1 border-t border-slate-100 sm:border-0 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{user?.name}</h2>
              <Badge variant="indigo">Student</Badge>
              {user?.collegeAssignmentStatus === 'VERIFIED' && (
                <Badge variant="emerald" icon={ShieldCheck}>
                  Verified Student
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{departmentLabel}</span>
              {formData.academicYear && (
                <>
                  <span aria-hidden="true">&bull;</span>
                  <span className="font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.5 text-xs">
                    Year {formData.academicYear}
                  </span>
                </>
              )}
              {formData.section && (
                <>
                  <span aria-hidden="true">&bull;</span>
                  <span className="text-slate-600">Section {formData.section}</span>
                </>
              )}
              {formData.rollNumber && (
                <>
                  <span aria-hidden="true">&bull;</span>
                  <span className="text-slate-600">Roll: {formData.rollNumber}</span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 pt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user?.email}</span>
            </p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2. Personal Information Section */}
        <Card padding="p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Personal Information</h3>
              <p className="text-xs text-slate-500">
                Official student identity details registered with your institution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={user?.name || ''}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 font-medium sm:text-sm cursor-not-allowed"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Official institutional name
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 font-medium sm:text-sm cursor-not-allowed"
                />
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 absolute right-3 top-3" />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Primary placement contact
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Account Role
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="Student"
                  disabled
                  className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 font-medium sm:text-sm cursor-not-allowed"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Campus placement candidate
              </span>
            </div>
          </div>
        </Card>

        {/* 3. Academic Details Section */}
        <Card padding="p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Academic Details</h3>
              <p className="text-xs text-slate-500">
                Official degree criteria evaluated for company eligibility cutoffs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="rollNumber" className="block text-sm font-medium text-slate-700 mb-1">
                Roll Number / Scholar No.
              </label>
              <input
                type="text"
                name="rollNumber"
                id="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 21BCS001"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                id="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. Computer Science"
              />
            </div>

            <div>
              <label htmlFor="course" className="block text-sm font-medium text-slate-700 mb-1">
                Course / Degree
              </label>
              <input
                type="text"
                name="course"
                id="course"
                value={formData.course}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. B.Tech"
              />
            </div>

            <div>
              <label htmlFor="batch" className="block text-sm font-medium text-slate-700 mb-1">
                Graduation Batch (Year)
              </label>
              <input
                type="text"
                name="batch"
                id="batch"
                value={formData.batch}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. 2025"
              />
            </div>

            <div>
              <label
                htmlFor="academicYear"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Academic Year
              </label>
              <select
                name="academicYear"
                id="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              >
                <option value="">Select Academic Year</option>
                <option value="I">I Year</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
            </div>

            <div>
              <label htmlFor="section" className="block text-sm font-medium text-slate-700 mb-1">
                Section
              </label>
              <input
                type="text"
                name="section"
                id="section"
                value={formData.section}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. A, B, C"
              />
            </div>

            <div>
              <label
                htmlFor="tenthPercentage"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
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
              <span className="text-[11px] text-slate-400 mt-1 block">
                Required by drives with a 10th standard cutoff
              </span>
            </div>

            <div>
              <label
                htmlFor="twelfthPercentage"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
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
              <span className="text-[11px] text-slate-400 mt-1 block">
                Required by drives with a 12th/Diploma cutoff
              </span>
            </div>

            <div>
              <label htmlFor="cgpa" className="block text-sm font-medium text-slate-700 mb-1">
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
              <span className="text-[11px] text-slate-400 mt-1 block">
                Evaluated when a drive requires CGPA basis
              </span>
            </div>

            <div>
              <label htmlFor="ugPercentage" className="block text-sm font-medium text-slate-700 mb-1">
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
              <span className="text-[11px] text-slate-400 mt-1 block">
                Evaluated when a drive requires Percentage basis
              </span>
            </div>

            <div>
              <label htmlFor="backlogs" className="block text-sm font-medium text-slate-700 mb-1">
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
              <span className="text-[11px] text-slate-400 mt-1 block">
                Number of currently active standing backlogs
              </span>
            </div>
          </div>
        </Card>

        {/* 4. Technical Skills Section */}
        <Card padding="p-6">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Technical Skills</h3>
                <p className="text-xs text-slate-500">
                  Languages, frameworks, developer tools, and technical competencies.
                </p>
              </div>
            </div>

            {parsedSkills.length > 0 && (
              <Badge variant="indigo" size="sm">
                {parsedSkills.length} {parsedSkills.length === 1 ? 'Skill' : 'Skills'}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {/* Live Skill Badges Preview Cloud */}
            {parsedSkills.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-wrap gap-2">
                {parsedSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 text-indigo-800 rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" aria-hidden="true" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Code2}
                title="No skills added yet"
                description="Type your skills in the field below separated by commas to generate verified tags."
              />
            )}

            <div>
              <label htmlFor="skills" className="block text-sm font-medium text-slate-700 mb-1">
                Skills (comma separated)
              </label>
              <input
                type="text"
                name="skills"
                id="skills"
                value={formData.skills}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g. React, Node.js, Python, MongoDB, Docker, Git"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Separate skills with commas. Each entry generates a distinct portfolio badge.
              </span>
            </div>
          </div>
        </Card>

        {/* 5. Resume Management Section */}
        <Card padding="p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Resume Management</h3>
              <p className="text-xs text-slate-500">
                Link to your verified resume document reviewed during company applications.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Resume Availability Card */}
            {formData.resumeUrl ? (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Resume Attached</span>
                      <Badge variant="emerald" icon={CheckCircle2} size="sm">
                        Available
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 truncate max-w-sm sm:max-w-md mt-0.5">
                      {formData.resumeUrl}
                    </p>
                  </div>
                </div>

                <a
                  href={formData.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View current hosted resume in new tab"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs transition min-h-[38px] shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Resume</span>
                </a>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No resume attached"
                description="Provide a public cloud link to your hosted resume (Google Drive, Dropbox, OneDrive) so hiring teams can review your CV."
              />
            )}

            <div>
              <label htmlFor="resumeUrl" className="block text-sm font-medium text-slate-700 mb-1">
                Resume Link (URL)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="url"
                  name="resumeUrl"
                  id="resumeUrl"
                  value={formData.resumeUrl}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://drive.google.com/file/d/..."
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Ensure sharing permissions on your hosted document are set to &ldquo;Anyone with the
                link can view&rdquo;.
              </p>
            </div>
          </div>
        </Card>

        {/* 6. Projects Section */}
        <Card padding="p-6">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Projects & Portfolio</h3>
                <p className="text-xs text-slate-500">
                  Highlight significant software, research, or engineering projects.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>

          <div className="space-y-4">
            {formData.projects.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No projects added yet"
                description="Adding projects improves your visibility and showcases practical implementation abilities."
                action={
                  <button
                    type="button"
                    onClick={addProject}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Project</span>
                  </button>
                }
              />
            ) : (
              formData.projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/40 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removeProject(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Remove Project"
                    aria-label={`Remove project ${proj.title || idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid gap-3 mr-8 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Project Title *
                      </label>
                      <input
                        type="text"
                        value={proj.title}
                        onChange={(e) => handleProjectChange(idx, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. Distributed Task Scheduler"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Project Link (GitHub/Live)
                      </label>
                      <input
                        type="url"
                        value={proj.link || ''}
                        onChange={(e) => handleProjectChange(idx, 'link', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="https://github.com/..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={proj.description || ''}
                        onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="Key technical achievements, architectural highlights, and tech stack..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 7. Certifications Section */}
        <Card padding="p-6">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Certifications & Licenses
                </h3>
                <p className="text-xs text-slate-500">
                  Showcase verified courses, cloud certifications, and technical licenses.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addCertification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Certification</span>
            </button>
          </div>

          <div className="space-y-4">
            {formData.certifications.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No certifications added yet"
                description="Credentials from recognized platforms (AWS, Google, Coursera) improve verification credibility."
                action={
                  <button
                    type="button"
                    onClick={addCertification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Certification</span>
                  </button>
                }
              />
            ) : (
              formData.certifications.map((cert, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/40 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Remove Certification"
                    aria-label={`Remove certification ${cert.name || idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid gap-3 mr-8 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Certification Name *
                      </label>
                      <input
                        type="text"
                        value={cert.name}
                        onChange={(e) => handleCertificationChange(idx, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. AWS Certified Solutions Architect"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Issuer
                      </label>
                      <input
                        type="text"
                        value={cert.issuer || ''}
                        onChange={(e) => handleCertificationChange(idx, 'issuer', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. Amazon Web Services"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date / Year
                      </label>
                      <input
                        type="text"
                        value={cert.date || ''}
                        onChange={(e) => handleCertificationChange(idx, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. 2024"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Credential URL
                      </label>
                      <input
                        type="url"
                        value={cert.url || ''}
                        onChange={(e) => handleCertificationChange(idx, 'url', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 8. Achievements Section */}
        <Card padding="p-6">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Honors & Achievements</h3>
                <p className="text-xs text-slate-500">
                  Awards, hackathon placements, scholarships, and academic recognitions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addAchievement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition cursor-pointer min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Achievement</span>
            </button>
          </div>

          <div className="space-y-4">
            {formData.achievements.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No achievements added yet"
                description="Highlight coding competitions, hackathons, and institutional awards."
                action={
                  <button
                    type="button"
                    onClick={addAchievement}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Achievement</span>
                  </button>
                }
              />
            ) : (
              formData.achievements.map((ach, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/40 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removeAchievement(idx)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Remove Achievement"
                    aria-label={`Remove achievement ${ach.title || idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid gap-3 mr-8 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Achievement Title *
                      </label>
                      <input
                        type="text"
                        value={ach.title}
                        onChange={(e) => handleAchievementChange(idx, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. 1st Place - Smart India Hackathon"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Issuer / Organization
                      </label>
                      <input
                        type="text"
                        value={ach.issuer || ''}
                        onChange={(e) => handleAchievementChange(idx, 'issuer', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. Ministry of Education"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date / Year
                      </label>
                      <input
                        type="text"
                        value={ach.date || ''}
                        onChange={(e) => handleAchievementChange(idx, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="e.g. March 2024"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Certificate / Evidence URL
                      </label>
                      <input
                        type="url"
                        value={ach.certificateUrl || ''}
                        onChange={(e) =>
                          handleAchievementChange(idx, 'certificateUrl', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="https://..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={ach.description || ''}
                        onChange={(e) => handleAchievementChange(idx, 'description', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                        placeholder="Briefly describe what you achieved..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 9. Sticky / Prominent Save Bar */}
        <div className="sticky bottom-4 z-20">
          <Card
            padding="p-4"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/95 backdrop-blur-sm border-indigo-100 shadow-lg ring-1 ring-slate-900/5"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Ensure academic marks match official grade sheets before saving.</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-60 transition cursor-pointer min-h-[44px]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
            </button>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
