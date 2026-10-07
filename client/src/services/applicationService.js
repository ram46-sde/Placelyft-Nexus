import api from './api';

export const applicationService = {
  // Apply for a specific drive
  applyForDrive: async (driveId) => {
    const response = await api.post(`/student/applications/${driveId}`);
    return response.data;
  },

  // Get all applications for the student
  getMyApplications: async () => {
    const response = await api.get('/student/applications');
    return response.data;
  },
};
