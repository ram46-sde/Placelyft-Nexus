import api from './api';

export const authService = {
  // Student registration
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Student login
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Fetch current user session
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};
