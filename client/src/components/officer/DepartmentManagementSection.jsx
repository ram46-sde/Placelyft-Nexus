import { useState, useEffect, useCallback } from 'react';
import { officerService } from '../../services/officerService';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Tag,
  Edit2,
  Save,
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
} from 'lucide-react';

/**
 * Normalizes an alias client-side matching server normalizeDepartmentKey logic.
 */
const normalizeAlias = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
};

const DepartmentManagementSection = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing HOD state: deptId | null
  const [editingHodId, setEditingHodId] = useState(null);
  const [hodFormData, setHodFormData] = useState({
    name: '',
    email: '',
    phone: '',
    officeLocation: '',
  });
  const [hodErrors, setHodErrors] = useState({});
  const [savingHod, setSavingHod] = useState(false);

  // Editing Aliases state: deptId | null
  const [editingAliasId, setEditingAliasId] = useState(null);
  const [aliasList, setAliasList] = useState([]);
  const [newAliasInput, setNewAliasInput] = useState('');
  const [aliasError, setAliasError] = useState('');
  const [savingAliases, setSavingAliases] = useState(false);

  // Fetch departments for current officer's college
  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError('');
      const data = await officerService.getDepartments();
      if (data.success) {
        setDepartments(data.departments || []);
      } else {
        setFetchError(data.message || 'Failed to fetch departments.');
      }
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Server error loading departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // Toast auto-clear
  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // --- HOD Contact Handlers ---
  const startEditHod = (dept) => {
    setEditingHodId(dept._id);
    setHodFormData({
      name: dept.hodContact?.name || '',
      email: dept.hodContact?.email || '',
      phone: dept.hodContact?.phone || '',
      officeLocation: dept.hodContact?.officeLocation || '',
    });
    setHodErrors({});
  };

  const cancelEditHod = () => {
    setEditingHodId(null);
    setHodFormData({ name: '', email: '', phone: '', officeLocation: '' });
    setHodErrors({});
  };

  const validateHodForm = () => {
    const errors = {};
    const name = hodFormData.name.trim();
    const email = hodFormData.email.trim();
    const phone = hodFormData.phone.trim();
    const officeLocation = hodFormData.officeLocation.trim();

    if (name && (name.length < 2 || name.length > 100)) {
      errors.name = 'Name must be between 2 and 100 characters.';
    }

    if (email) {
      if (email.length > 254) {
        errors.email = 'Email cannot exceed 254 characters.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        errors.phone = 'Phone number must contain between 7 and 15 digits.';
      } else if (!/^(\+?[0-9\s\-()]+)$/.test(phone)) {
        errors.phone = 'Phone contains invalid characters (allowed: +, digits, spaces, -, ()).';
      }
    }

    if (officeLocation && officeLocation.length > 100) {
      errors.officeLocation = 'Office location cannot exceed 100 characters.';
    }

    return errors;
  };

  const handleSaveHod = async (deptId) => {
    const errors = validateHodForm();
    if (Object.keys(errors).length > 0) {
      setHodErrors(errors);
      return;
    }

    try {
      setSavingHod(true);
      setHodErrors({});
      const payload = {
        name: hodFormData.name.trim(),
        email: hodFormData.email.trim(),
        phone: hodFormData.phone.trim(),
        officeLocation: hodFormData.officeLocation.trim(),
      };

      const res = await officerService.updateHodContact(deptId, payload);
      if (res.success && res.department) {
        setDepartments((prev) =>
          prev.map((d) => (d._id === deptId ? { ...d, hodContact: res.department.hodContact } : d))
        );
        showSuccess(`HOD contact for "${res.department.name}" updated successfully.`);
        cancelEditHod();
      } else {
        setHodErrors({ general: res.message || 'Failed to update HOD contact.' });
      }
    } catch (err) {
      setHodErrors({
        general: err.response?.data?.message || 'Server error updating HOD contact.',
      });
    } finally {
      setSavingHod(false);
    }
  };

  // --- Aliases Handlers ---
  const startEditAliases = (dept) => {
    setEditingAliasId(dept._id);
    setAliasList(Array.isArray(dept.aliases) ? [...dept.aliases] : []);
    setNewAliasInput('');
    setAliasError('');
  };

  const cancelEditAliases = () => {
    setEditingAliasId(null);
    setAliasList([]);
    setNewAliasInput('');
    setAliasError('');
  };

  const handleAddAlias = () => {
    setAliasError('');
    const raw = newAliasInput.trim();
    if (!raw) return;

    if (aliasList.length >= 10) {
      setAliasError('Maximum 10 aliases allowed per department.');
      return;
    }

    if (raw.length < 2 || raw.length > 40) {
      setAliasError('Alias must be between 2 and 40 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9\s&.\-/()]+$/.test(raw)) {
      setAliasError('Allowed characters: letters, digits, spaces, and & . - / ( ).');
      return;
    }

    const normalized = normalizeAlias(raw);
    const hasDuplicate = aliasList.some((existing) => normalizeAlias(existing) === normalized);
    if (hasDuplicate) {
      setAliasError(`Alias "${raw}" already exists in this department.`);
      return;
    }

    setAliasList((prev) => [...prev, raw]);
    setNewAliasInput('');
  };

  const handleRemoveAlias = (indexToRemove) => {
    setAliasList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setAliasError('');
  };

  const handleSaveAliases = async (deptId) => {
    try {
      setSavingAliases(true);
      setAliasError('');
      const res = await officerService.updateDepartmentAliases(deptId, aliasList);
      if (res.success && res.department) {
        setDepartments((prev) =>
          prev.map((d) => (d._id === deptId ? { ...d, aliases: res.department.aliases } : d))
        );
        showSuccess(`Aliases for "${res.department.name}" updated successfully.`);
        cancelEditAliases();
      } else {
        setAliasError(res.message || 'Failed to update aliases.');
      }
    } catch (err) {
      setAliasError(err.response?.data?.message || 'Server error updating aliases.');
    } finally {
      setSavingAliases(false);
    }
  };

  // Filtered department list by search term
  const filteredDepartments = departments.filter((dept) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchName = dept.name?.toLowerCase().includes(term);
    const matchCode = dept.code?.toLowerCase().includes(term);
    const matchAlias = (dept.aliases || []).some((a) => a.toLowerCase().includes(term));
    const matchHod = dept.hodContact?.name?.toLowerCase().includes(term);
    return matchName || matchCode || matchAlias || matchHod;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Department Directory</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your college departments, Head of Department contacts, and alias mappings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDepartments}
            disabled={loading}
            title="Refresh Departments"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Success Toast Banner */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess('')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Fetch Error Banner */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Failed to Load Departments</span>
              <span className="text-xs text-rose-700 mt-0.5 block">{fetchError}</span>
            </div>
          </div>
          <button
            onClick={loadDepartments}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by department name, code, alias, or HOD..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
        </div>
        <span className="text-xs text-slate-400">
          {filteredDepartments.length} {filteredDepartments.length === 1 ? 'department' : 'departments'}
        </span>
      </div>

      {/* Loading Skeleton */}
      {loading && departments.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-white rounded-2xl border border-slate-200 animate-pulse space-y-3">
              <div className="h-5 bg-slate-200 rounded w-1/2"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              <div className="h-16 bg-slate-50 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDepartments.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No departments found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'No departments match your search criteria.' : 'No active departments configured for this college.'}
          </p>
        </div>
      )}

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredDepartments.map((dept) => {
          const isEditingHod = editingHodId === dept._id;
          const isEditingAliases = editingAliasId === dept._id;

          return (
            <div
              key={dept._id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition flex flex-col justify-between p-5 space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {dept.code}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    ID: {dept._id}
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Active
                </span>
              </div>

              {/* HOD Contact Section */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Head of Department</span>
                  </div>
                  {!isEditingHod && (
                    <button
                      onClick={() => startEditHod(dept)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{dept.hodContact?.name ? 'Edit' : 'Add HOD'}</span>
                    </button>
                  )}
                </div>

                {isEditingHod ? (
                  /* Inline HOD Edit Form */
                  <div className="space-y-3 pt-2">
                    {hodErrors.general && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{hodErrors.general}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          HOD Name
                        </label>
                        <input
                          type="text"
                          value={hodFormData.name}
                          onChange={(e) =>
                            setHodFormData((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder="Dr. John Doe"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {hodErrors.name && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {hodErrors.name}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={hodFormData.email}
                          onChange={(e) =>
                            setHodFormData((p) => ({ ...p, email: e.target.value }))
                          }
                          placeholder="hod.cse@college.edu"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {hodErrors.email && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {hodErrors.email}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={hodFormData.phone}
                          onChange={(e) =>
                            setHodFormData((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder="+91 9876543210"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {hodErrors.phone && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {hodErrors.phone}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Office Location
                        </label>
                        <input
                          type="text"
                          value={hodFormData.officeLocation}
                          onChange={(e) =>
                            setHodFormData((p) => ({ ...p, officeLocation: e.target.value }))
                          }
                          placeholder="Block A, Room 302"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {hodErrors.officeLocation && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {hodErrors.officeLocation}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        Leave fields empty to clear them.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditHod}
                          disabled={savingHod}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveHod(dept._id)}
                          disabled={savingHod}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          {savingHod ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Save HOD</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display HOD details (plain text only) */
                  <div className="space-y-1 text-xs text-slate-700 pt-1">
                    {dept.hodContact &&
                    (dept.hodContact.name ||
                      dept.hodContact.email ||
                      dept.hodContact.phone ||
                      dept.hodContact.officeLocation) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-3">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold truncate">
                            {dept.hodContact.name || 'Name not set'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{dept.hodContact.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{dept.hodContact.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{dept.hodContact.officeLocation || '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs italic">
                        No HOD contact assigned yet.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Aliases Section */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Aliases (Student Mapping)</span>
                  </div>
                  {!isEditingAliases && (
                    <button
                      onClick={() => startEditAliases(dept)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Manage Aliases</span>
                    </button>
                  )}
                </div>

                {isEditingAliases ? (
                  /* Inline Aliases Edit Form */
                  <div className="space-y-3 pt-2">
                    {aliasError && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{aliasError}</span>
                      </div>
                    )}

                    {/* Current Tag Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white border border-slate-200 rounded-lg">
                      {aliasList.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          No aliases added yet. Add aliases below.
                        </span>
                      ) : (
                        aliasList.map((alias, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 font-medium"
                          >
                            <span>{alias}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAlias(idx)}
                              className="text-emerald-700 hover:text-rose-600 transition cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add Alias Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newAliasInput}
                        onChange={(e) => setNewAliasInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAlias();
                          }
                        }}
                        disabled={aliasList.length >= 10}
                        placeholder={aliasList.length >= 10 ? 'Limit reached (10 max)' : 'Add alias (e.g. "CS", "CSE")'}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleAddAlias}
                        disabled={aliasList.length >= 10 || !newAliasInput.trim()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        {aliasList.length}/10 aliases. Alphanumeric & symbols (& . - / ()).
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditAliases}
                          disabled={savingAliases}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAliases(dept._id)}
                          disabled={savingAliases}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          {savingAliases ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Save Aliases</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display Aliases Pills (plain text only) */
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {dept.aliases && dept.aliases.length > 0 ? (
                      dept.aliases.map((alias, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs"
                        >
                          {alias}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs italic">
                        No aliases assigned yet.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentManagementSection;
