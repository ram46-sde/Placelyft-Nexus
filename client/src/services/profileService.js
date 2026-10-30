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

  // Upload student profile photo
  uploadProfilePhoto: async (formData) => {
    const response = await api.post('/student/profile/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
