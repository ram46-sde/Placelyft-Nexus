import api from './api';

export const driveService = {
  // Get all active placement drives
  getAvailableDrives: async () => {
    const response = await api.get('/student/drives');
    return response.data;
  },

  // Get details of a specific drive by ID
  getDriveById: async (driveId) => {
    const response = await api.get(`/student/drives/${driveId}`);
    return response.data;
  },
};
