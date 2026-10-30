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
};
