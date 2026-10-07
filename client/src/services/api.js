import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically inject JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cpms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token expired or invalid, clear stored credentials
      localStorage.removeItem('cpms_token');
      localStorage.removeItem('cpms_user');
    }
    return Promise.reject(error);
  }
);

export default api;
