import api from './api';

export const officerService = {
  // Fetch all placement drives for the authenticated officer's college
  getDrives: async () => {
    const response = await api.get('/officer/drives');
    return response.data;
  },

  // Create a new placement drive
  createDrive: async (driveData) => {
    const response = await api.post('/officer/drives', driveData);
    return response.data;
  },

  // Fetch applicant roster and academic profiles for a specific drive
  getDriveApplicants: async (driveId) => {
    const response = await api.get(`/officer/drives/${driveId}/applications`);
    return response.data;
  },

  // Update status for a specific application
  updateApplicationStatus: async (applicationId, status) => {
    const response = await api.patch(`/officer/applications/${applicationId}/status`, { status });
    return response.data;
  },

  // Archive a drive (hides from students, marks isActive: false)
  archiveDrive: async (driveId) => {
    const response = await api.patch(`/officer/drives/${driveId}/archive`);
    return response.data;
  },

  // Restore an archived drive
  restoreDrive: async (driveId) => {
    const response = await api.patch(`/officer/drives/${driveId}/restore`);
    return response.data;
  },

  // Permanently delete an archived drive with no dependent records
  deleteDrive: async (driveId) => {
    const response = await api.delete(`/officer/drives/${driveId}`);
    return response.data;
  },

  // Department Management
  getDepartments: async () => {
    const response = await api.get('/officer/departments');
    return response.data;
  },

  updateHodContact: async (deptId, contactData) => {
    const response = await api.put(`/officer/departments/${deptId}/hod-contact`, contactData);
    return response.data;
  },

  updateDepartmentAliases: async (deptId, aliases) => {
    const response = await api.put(`/officer/departments/${deptId}/aliases`, { aliases });
    return response.data;
  },

  // Drive Attendance
  getDriveAttendance: async (driveId, { includeHistory = false } = {}) => {
    const params = includeHistory ? '?includeHistory=true' : '';
    const response = await api.get(`/officer/drives/${driveId}/attendance${params}`);
    return response.data;
  },

  markDriveAttendance: async (driveId, entries) => {
    const response = await api.post(`/officer/drives/${driveId}/attendance/mark`, { entries });
    return response.data;
  },

  // Verified Placement Metrics (Phase 4C)
  getMetrics: async () => {
    const response = await api.get('/officer/metrics');
    return response.data;
  },

  // Placement Outcomes Management (Phase 4D)
  getOutcomesQueue: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.driveId) query.append('driveId', params.driveId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get(`/officer/outcomes/queue${qs}`);
    return response.data;
  },

  getVerifiedOutcomes: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.driveId) query.append('driveId', params.driveId);
    if (params.department) query.append('department', params.department);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get(`/officer/outcomes${qs}`);
    return response.data;
  },

  verifyOutcome: async (applicationId, data = {}) => {
    const response = await api.post(`/officer/outcomes/${applicationId}/verify`, data);
    return response.data;
  },

  revokeOutcome: async (applicationId, data = {}) => {
    const response = await api.post(`/officer/outcomes/${applicationId}/revoke`, data);
    return response.data;
  },

  getOutcomeHistory: async (applicationId) => {
    const response = await api.get(`/officer/outcomes/${applicationId}/history`);
    return response.data;
  },
};
