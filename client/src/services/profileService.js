import api from './api';

export const profileService = {
  // Get current student profile
  getProfile: async () => {
    const response = await api.get('/student/profile');
    return response.data;
  },

  // Update or create student profile
  updateProfile: async (profileData) => {
    const response = await api.put('/student/profile', profileData);
    return response.data;
  },
};
