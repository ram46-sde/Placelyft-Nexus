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
  Trash2,
  AlertTriangle,
  Info,
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

  // --- Add Department Modal State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    name: '',
    code: '',
    aliases: [],
    hodContact: {
      name: '',
      email: '',
      phone: '',
      officeLocation: '',
    },
  });
  const [addAliasInput, setAddAliasInput] = useState('');
  const [addErrors, setAddErrors] = useState({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // --- Edit Department Modal State ---
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    aliases: [],
    hodContact: {
      name: '',
      email: '',
      phone: '',
      officeLocation: '',
    },
  });
  const [editAliasInput, setEditAliasInput] = useState('');
  const [editErrors, setEditErrors] = useState({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // --- Delete Department Modal State ---
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // --- Inline HOD quick edit state: deptId | null ---
  const [editingHodId, setEditingHodId] = useState(null);
  const [hodFormData, setHodFormData] = useState({
    name: '',
    email: '',
    phone: '',
    officeLocation: '',
  });
  const [hodErrors, setHodErrors] = useState({});
  const [savingHod, setSavingHod] = useState(false);

  // --- Inline Aliases quick edit state: deptId | null ---
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

  // Toast auto-clear helper
  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4500);
  };

  // --- Validation Helpers ---
  const validateDeptFields = (formData) => {
    const errors = {};
    const name = formData.name.trim();
    const code = formData.code.trim();

    if (!name) {
      errors.name = 'Department name is required.';
    } else if (name.length < 2 || name.length > 100) {
      errors.name = 'Department name must be between 2 and 100 characters.';
    }

    if (!code) {
      errors.code = 'Department code is required.';
    } else if (code.length < 2 || code.length > 20) {
      errors.code = 'Department code must be between 2 and 20 characters.';
    } else if (!/^[a-zA-Z0-9\-_]+$/.test(code)) {
      errors.code = 'Code must contain only letters, numbers, hyphens, and underscores.';
    }

    const hodName = formData.hodContact?.name?.trim();
    const hodEmail = formData.hodContact?.email?.trim();
    const hodPhone = formData.hodContact?.phone?.trim();
    const hodLoc = formData.hodContact?.officeLocation?.trim();

    if (hodName && (hodName.length < 2 || hodName.length > 100)) {
      errors.hodName = 'HOD name must be between 2 and 100 characters.';
    }

    if (hodEmail) {
      if (hodEmail.length > 254) {
        errors.hodEmail = 'HOD email cannot exceed 254 characters.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hodEmail)) {
        errors.hodEmail = 'Please enter a valid email address.';
      }
    }

    if (hodPhone) {
      const digits = hodPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        errors.hodPhone = 'Phone number must contain between 7 and 15 digits.';
      } else if (!/^(\+?[0-9\s\-()]+)$/.test(hodPhone)) {
        errors.hodPhone = 'Phone contains invalid characters (allowed: +, digits, spaces, -, ()).';
      }
    }

    if (hodLoc && hodLoc.length > 100) {
      errors.hodOfficeLocation = 'Office location cannot exceed 100 characters.';
    }

    return errors;
  };

  // --- Add Department Handlers ---
  const openAddModal = () => {
    setAddFormData({
      name: '',
      code: '',
      aliases: [],
      hodContact: {
        name: '',
        email: '',
        phone: '',
        officeLocation: '',
      },
    });
    setAddAliasInput('');
    setAddErrors({});
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (submittingAdd) return;
    setIsAddModalOpen(false);
    setAddErrors({});
  };

  const handleAddAliasToAddForm = () => {
    const raw = addAliasInput.trim();
    if (!raw) return;

    if (addFormData.aliases.length >= 10) {
      setAddErrors((p) => ({ ...p, aliases: 'Maximum 10 aliases allowed per department.' }));
      return;
    }

    if (raw.length < 2 || raw.length > 40) {
      setAddErrors((p) => ({ ...p, aliases: 'Alias must be between 2 and 40 characters.' }));
      return;
    }

    if (!/^[a-zA-Z0-9\s&.\-/()]+$/.test(raw)) {
      setAddErrors((p) => ({ ...p, aliases: 'Allowed characters: letters, digits, spaces, & . - / ( )' }));
      return;
    }

    const norm = normalizeAlias(raw);
    if (addFormData.aliases.some((a) => normalizeAlias(a) === norm)) {
      setAddErrors((p) => ({ ...p, aliases: `Alias "${raw}" is already added.` }));
      return;
    }

    setAddFormData((p) => ({ ...p, aliases: [...p.aliases, raw] }));
    setAddAliasInput('');
    setAddErrors((p) => {
      const next = { ...p };
      delete next.aliases;
      return next;
    });
  };

  const handleRemoveAliasFromAddForm = (index) => {
    setAddFormData((p) => ({
      ...p,
      aliases: p.aliases.filter((_, i) => i !== index),
    }));
  };

  const handleSaveAddDepartment = async (e) => {
    e.preventDefault();
    const errors = validateDeptFields(addFormData);
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    try {
      setSubmittingAdd(true);
      setAddErrors({});

      const payload = {
        name: addFormData.name.trim(),
        code: addFormData.code.trim().toUpperCase(),
        aliases: addFormData.aliases,
        hodContact: {
          name: addFormData.hodContact.name.trim(),
          email: addFormData.hodContact.email.trim(),
          phone: addFormData.hodContact.phone.trim(),
          officeLocation: addFormData.hodContact.officeLocation.trim(),
        },
      };

      const res = await officerService.createDepartment(payload);
      if (res.success && res.department) {
        setDepartments((prev) => [...prev, res.department]);
        showSuccess(`Department "${res.department.name}" (${res.department.code}) created successfully.`);
        closeAddModal();
      } else {
        setAddErrors({ general: res.message || 'Failed to create department.' });
      }
    } catch (err) {
      setAddErrors({
        general: err.response?.data?.message || 'Server error creating department.',
      });
    } finally {
      setSubmittingAdd(false);
    }
  };

  // --- Edit Department Handlers ---
  const openEditModal = (dept) => {
    setEditingDepartment(dept);
    setEditFormData({
      name: dept.name || '',
      code: dept.code || '',
      aliases: Array.isArray(dept.aliases) ? [...dept.aliases] : [],
      hodContact: {
        name: dept.hodContact?.name || '',
        email: dept.hodContact?.email || '',
        phone: dept.hodContact?.phone || '',
        officeLocation: dept.hodContact?.officeLocation || '',
      },
    });
    setEditAliasInput('');
    setEditErrors({});
  };

  const closeEditModal = () => {
    if (submittingEdit) return;
    setEditingDepartment(null);
    setEditErrors({});
  };

  const handleAddAliasToEditForm = () => {
    const raw = editAliasInput.trim();
    if (!raw) return;

    if (editFormData.aliases.length >= 10) {
      setEditErrors((p) => ({ ...p, aliases: 'Maximum 10 aliases allowed per department.' }));
      return;
    }

    if (raw.length < 2 || raw.length > 40) {
      setEditErrors((p) => ({ ...p, aliases: 'Alias must be between 2 and 40 characters.' }));
      return;
    }

    if (!/^[a-zA-Z0-9\s&.\-/()]+$/.test(raw)) {
      setEditErrors((p) => ({ ...p, aliases: 'Allowed characters: letters, digits, spaces, & . - / ( )' }));
      return;
    }

    const norm = normalizeAlias(raw);
    if (editFormData.aliases.some((a) => normalizeAlias(a) === norm)) {
      setEditErrors((p) => ({ ...p, aliases: `Alias "${raw}" is already added.` }));
      return;
    }

    setEditFormData((p) => ({ ...p, aliases: [...p.aliases, raw] }));
    setEditAliasInput('');
    setEditErrors((p) => {
      const next = { ...p };
      delete next.aliases;
      return next;
    });
  };

  const handleRemoveAliasFromEditForm = (index) => {
    setEditFormData((p) => ({
      ...p,
      aliases: p.aliases.filter((_, i) => i !== index),
    }));
  };

  const handleSaveEditDepartment = async (e) => {
    e.preventDefault();
    if (!editingDepartment) return;

    const errors = validateDeptFields(editFormData);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setSubmittingEdit(true);
      setEditErrors({});

      const payload = {
        name: editFormData.name.trim(),
        code: editFormData.code.trim().toUpperCase(),
        aliases: editFormData.aliases,
        hodContact: {
          name: editFormData.hodContact.name.trim(),
          email: editFormData.hodContact.email.trim(),
          phone: editFormData.hodContact.phone.trim(),
          officeLocation: editFormData.hodContact.officeLocation.trim(),
        },
      };

      const res = await officerService.updateDepartment(editingDepartment._id, payload);
      if (res.success && res.department) {
        setDepartments((prev) =>
          prev.map((d) => (d._id === editingDepartment._id ? res.department : d))
        );
        showSuccess(`Department "${res.department.name}" updated successfully.`);
        closeEditModal();
      } else {
        setEditErrors({ general: res.message || 'Failed to update department.' });
      }
    } catch (err) {
      setEditErrors({
        general: err.response?.data?.message || 'Server error updating department.',
      });
    } finally {
      setSubmittingEdit(false);
    }
  };

  // --- Delete Department Handlers ---
  const openDeleteModal = (dept) => {
    setDeletingDepartment(dept);
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (submittingDelete) return;
    setDeletingDepartment(null);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingDepartment) return;

    try {
      setSubmittingDelete(true);
      setDeleteError('');

      const res = await officerService.deleteDepartment(deletingDepartment._id);

      if (res.success) {
        setDepartments((prev) => prev.filter((d) => d._id !== deletingDepartment._id));
        showSuccess(`Department "${deletingDepartment.name}" permanently deleted.`);
        closeDeleteModal();
      } else {
        setDeleteError(res.message || 'Failed to delete department.');
      }
    } catch (err) {
      setDeleteError(
        err.response?.data?.message || 'Server error while deleting department.'
      );
    } finally {
      setSubmittingDelete(false);
    }
  };

  // --- Existing Inline HOD Handlers ---
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

  // --- Existing Inline Aliases Handlers ---
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
    const matchEmail = dept.hodContact?.email?.toLowerCase().includes(term);
    return matchName || matchCode || matchAlias || matchHod || matchEmail;
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
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>

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

      {/* Search Input & Count */}
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
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {searchTerm ? 'No departments match your search' : 'No active departments configured yet'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {searchTerm
              ? 'Try adjusting your search terms or clear the filter to see all departments.'
              : 'Add your college departments so that applicant student branches are accurately resolved and attendance can be shared with HODs.'}
          </p>
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Clear Search</span>
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Department</span>
            </button>
          )}
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 truncate">{dept.name}</h3>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {dept.code}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {dept.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                    ID: {dept._id}
                  </span>
                </div>

                {/* Card Header Actions: Edit & Deactivate */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openEditModal(dept)}
                    title="Edit Department Details"
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-transparent hover:border-emerald-200 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(dept)}
                    title="Delete Department"
                    className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                      <span>{dept.hodContact?.name ? 'Quick Edit' : 'Add HOD'}</span>
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
                          placeholder="Room 302, CS Block"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {hodErrors.officeLocation && (
                          <span className="text-[10px] text-rose-600 block mt-0.5">
                            {hodErrors.officeLocation}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={cancelEditHod}
                        disabled={savingHod}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveHod(dept._id)}
                        disabled={savingHod}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {savingHod ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        <span>Save HOD</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display HOD details */
                  <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                    {dept.hodContact?.name ? (
                      <>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{dept.hodContact.name}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          {dept.hodContact?.email ? (
                            <div className="flex items-center gap-1.5 text-slate-500 truncate">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${dept.hodContact.email}`}
                                className="hover:text-emerald-700 hover:underline truncate"
                              >
                                {dept.hodContact.email}
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No email</span>
                          )}

                          {dept.hodContact?.phone ? (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <a
                                href={`tel:${dept.hodContact.phone}`}
                                className="hover:text-emerald-700 hover:underline"
                              >
                                {dept.hodContact.phone}
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                        </div>

                        {dept.hodContact?.officeLocation && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{dept.hodContact.officeLocation}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400 italic text-[11px] py-1">
                        No HOD contact configured. Click &quot;Add HOD&quot; to configure contact information.
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
                    <span>Aliases ({dept.aliases?.length || 0})</span>
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

                    {/* Chips list */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white rounded-lg border border-slate-200">
                      {aliasList.length === 0 && (
                        <span className="text-[11px] text-slate-400 italic">No aliases added yet.</span>
                      )}
                      {aliasList.map((alias, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs"
                        >
                          <span>{alias}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAlias(idx)}
                            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Input to add new alias */}
                    <div className="flex items-center gap-1.5">
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
                        placeholder="Add alias (e.g. CS, Comp Sci)"
                        disabled={aliasList.length >= 10}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleAddAlias}
                        disabled={!newAliasInput.trim() || aliasList.length >= 10}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Press enter to add. Max 10 aliases. Helps resolve student branch free-text.
                    </span>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={cancelEditAliases}
                        disabled={savingAliases}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveAliases(dept._id)}
                        disabled={savingAliases}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {savingAliases ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        <span>Save Aliases</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Aliases */
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {dept.aliases && dept.aliases.length > 0 ? (
                      dept.aliases.map((alias, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium shadow-2xs"
                        >
                          {alias}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        No aliases configured. Add aliases to help resolve student branch variations.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          ADD DEPARTMENT MODAL
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Department</h3>
                  <p className="text-xs text-slate-500">
                    Configure a new academic department, aliases, and HOD contact.
                  </p>
                </div>
              </div>
              <button
                onClick={closeAddModal}
                disabled={submittingAdd}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAddDepartment} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {addErrors.general && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addErrors.general}</span>
                </div>
              )}

              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Computer Science and Engineering"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  {addErrors.name && (
                    <span className="text-[11px] text-rose-600 block mt-1">{addErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addFormData.code}
                    onChange={(e) =>
                      setAddFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g. CSE"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 uppercase"
                  />
                  {addErrors.code && (
                    <span className="text-[11px] text-rose-600 block mt-1">{addErrors.code}</span>
                  )}
                </div>
              </div>

              {/* Aliases Builder */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Aliases ({addFormData.aliases.length}/10)
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {addFormData.aliases.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-0.5">
                      No aliases added. Add short forms (e.g. CS, Comp Sci).
                    </span>
                  )}
                  {addFormData.aliases.map((alias, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium shadow-2xs"
                    >
                      <span>{alias}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAliasFromAddForm(idx)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addAliasInput}
                    onChange={(e) => setAddAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAliasToAddForm();
                      }
                    }}
                    placeholder="Type alias and press Enter..."
                    disabled={addFormData.aliases.length >= 10}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddAliasToAddForm}
                    disabled={!addAliasInput.trim() || addFormData.aliases.length >= 10}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Add Alias
                  </button>
                </div>
                {addErrors.aliases && (
                  <span className="text-[11px] text-rose-600 block">{addErrors.aliases}</span>
                )}
              </div>

              {/* HOD Contact Section */}
              <div className="pt-2 border-t border-slate-200/80 space-y-3">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Head of Department (Optional)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">HOD Name</label>
                    <input
                      type="text"
                      value={addFormData.hodContact.name}
                      onChange={(e) =>
                        setAddFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, name: e.target.value },
                        }))
                      }
                      placeholder="Dr. Jane Smith"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {addErrors.hodName && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{addErrors.hodName}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      value={addFormData.hodContact.email}
                      onChange={(e) =>
                        setAddFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, email: e.target.value },
                        }))
                      }
                      placeholder="hod.cse@college.edu"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {addErrors.hodEmail && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{addErrors.hodEmail}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                    <input
                      type="text"
                      value={addFormData.hodContact.phone}
                      onChange={(e) =>
                        setAddFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, phone: e.target.value },
                        }))
                      }
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {addErrors.hodPhone && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{addErrors.hodPhone}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Office Location</label>
                    <input
                      type="text"
                      value={addFormData.hodContact.officeLocation}
                      onChange={(e) =>
                        setAddFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, officeLocation: e.target.value },
                        }))
                      }
                      placeholder="Block A, Room 405"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {addErrors.hodOfficeLocation && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">
                        {addErrors.hodOfficeLocation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={submittingAdd}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingAdd ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Department</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT DEPARTMENT MODAL
          ========================================================================= */}
      {editingDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Department</h3>
                  <p className="text-xs text-slate-500">
                    Update department name, code, aliases, or HOD details.
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                disabled={submittingEdit}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEditDepartment} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {editErrors.general && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editErrors.general}</span>
                </div>
              )}

              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Computer Science and Engineering"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  {editErrors.name && (
                    <span className="text-[11px] text-rose-600 block mt-1">{editErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.code}
                    onChange={(e) =>
                      setEditFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g. CSE"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 uppercase"
                  />
                  {editErrors.code && (
                    <span className="text-[11px] text-rose-600 block mt-1">{editErrors.code}</span>
                  )}
                </div>
              </div>

              {/* Aliases Builder */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Aliases ({editFormData.aliases.length}/10)
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {editFormData.aliases.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-0.5">
                      No aliases configured.
                    </span>
                  )}
                  {editFormData.aliases.map((alias, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium shadow-2xs"
                    >
                      <span>{alias}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAliasFromEditForm(idx)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editAliasInput}
                    onChange={(e) => setEditAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAliasToEditForm();
                      }
                    }}
                    placeholder="Type alias and press Enter..."
                    disabled={editFormData.aliases.length >= 10}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddAliasToEditForm}
                    disabled={!editAliasInput.trim() || editFormData.aliases.length >= 10}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Add Alias
                  </button>
                </div>
                {editErrors.aliases && (
                  <span className="text-[11px] text-rose-600 block">{editErrors.aliases}</span>
                )}
              </div>

              {/* HOD Contact Section */}
              <div className="pt-2 border-t border-slate-200/80 space-y-3">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Head of Department
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">HOD Name</label>
                    <input
                      type="text"
                      value={editFormData.hodContact.name}
                      onChange={(e) =>
                        setEditFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, name: e.target.value },
                        }))
                      }
                      placeholder="Dr. Jane Smith"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {editErrors.hodName && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{editErrors.hodName}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.hodContact.email}
                      onChange={(e) =>
                        setEditFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, email: e.target.value },
                        }))
                      }
                      placeholder="hod.cse@college.edu"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {editErrors.hodEmail && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{editErrors.hodEmail}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                    <input
                      type="text"
                      value={editFormData.hodContact.phone}
                      onChange={(e) =>
                        setEditFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, phone: e.target.value },
                        }))
                      }
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {editErrors.hodPhone && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">{editErrors.hodPhone}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Office Location</label>
                    <input
                      type="text"
                      value={editFormData.hodContact.officeLocation}
                      onChange={(e) =>
                        setEditFormData((p) => ({
                          ...p,
                          hodContact: { ...p.hodContact, officeLocation: e.target.value },
                        }))
                      }
                      placeholder="Block A, Room 405"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {editErrors.hodOfficeLocation && (
                      <span className="text-[11px] text-rose-600 block mt-0.5">
                        {editErrors.hodOfficeLocation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={submittingEdit}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE DEPARTMENT CONFIRMATION MODAL
          ========================================================================= */}
      {deletingDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete Department?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deletingDepartment.name} ({deletingDepartment.code})
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Deletion Blocked</span>
                    <span className="mt-0.5 block text-rose-700 leading-relaxed">{deleteError}</span>
                  </div>
                </div>
              )}

              {/* Explanatory Info Card */}
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Permanent Deletion Policy</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                  <li>This action will <strong>permanently delete</strong> the department from your institution.</li>
                  <li>Permanent deletion is permitted <strong>only when no dependent records exist</strong> (such as historical attendance, student profiles, or placement outcomes).</li>
                  <li><strong>Historical attendance will never be deleted</strong> or modified. If dependent records reference this department, deletion will be safely blocked.</li>
                  <li>Once permanently deleted, the department name, code, and aliases can be reused.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={submittingDelete}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={submittingDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingDelete ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Department</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagementSection;
