import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';
import { User, Mail, ShieldCheck, GraduationCap, Briefcase, FileText, Loader2, Save, AlertCircle, Plus, Trash2 } from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    rollNumber: '',
    department: '',
    course: '',
    batch: '',
    cgpa: '',
    backlogs: 0,
    skills: '',
    resumeUrl: '',
    projects: [],
    certifications: [],
  });

  useEffect(() => {
    fetchProfile();
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
          cgpa: p.cgpa || '',
          backlogs: p.backlogs || 0,
          skills: p.skills ? p.skills.join(', ') : '',
          resumeUrl: p.resumeUrl || '',
          projects: p.projects || [],
          certifications: p.certifications || [],
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const submitData = {
        ...formData,
        cgpa: formData.cgpa ? parseFloat(formData.cgpa) : undefined,
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
      // Auto clear success message
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your academic details, skills, and portfolio</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 ${message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`} />
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Account Info Card (Read-only) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-600/20">
            {user?.name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-500 flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email}</span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </div>
            </div>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number / Scholar No.</label>
              <input type="text" name="rollNumber" value={formData.rollNumber} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. 21BCS001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <input type="text" name="department" value={formData.department} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. Computer Science" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course / Degree</label>
              <input type="text" name="course" value={formData.course} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. B.Tech" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Graduation Batch (Year)</label>
              <input type="text" name="batch" value={formData.batch} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. 2025" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current CGPA</label>
              <input type="number" step="0.01" min="0" max="10" name="cgpa" value={formData.cgpa} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. 8.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Active Backlogs</label>
              <input type="number" min="0" name="backlogs" value={formData.backlogs} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="0" />
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma separated)</label>
              <input type="text" name="skills" value={formData.skills} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. React, Node.js, Python, MongoDB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Resume Link (URL)</label>
              <div className="flex items-center relative">
                <FileText className="w-4 h-4 absolute left-3 text-slate-400" />
                <input type="url" name="resumeUrl" value={formData.resumeUrl} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://drive.google.com/..." />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Provide a link to your hosted resume (Google Drive, Dropbox, etc.)</p>
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
            <button type="button" onClick={addProject} className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800">
              <Plus className="w-4 h-4" /> Add Project
            </button>
          </div>
          <div className="p-6 space-y-6">
            {formData.projects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No projects added yet. Adding projects improves your profile visibility.</p>
            ) : (
              formData.projects.map((proj, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 relative">
                  <button type="button" onClick={() => removeProject(idx)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-600" title="Remove Project">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid gap-4 mr-6">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Project Title *</label>
                      <input type="text" value={proj.title} onChange={(e) => handleProjectChange(idx, 'title', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Project Link (GitHub/Live)</label>
                      <input type="url" value={proj.link} onChange={(e) => handleProjectChange(idx, 'link', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                      <textarea value={proj.description} onChange={(e) => handleProjectChange(idx, 'description', e.target.value)} rows="2" className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Briefly describe the project..." />
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
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-70 transition shadow-md shadow-indigo-600/20"
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
