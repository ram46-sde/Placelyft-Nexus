import api from './api';

export const dashboardService = {
  // Fetch aggregated dashboard metrics for the authenticated student
  getSummary: async () => {
    const response = await api.get('/student/dashboard/summary');
    return response.data;
  },
};
