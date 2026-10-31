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
};
