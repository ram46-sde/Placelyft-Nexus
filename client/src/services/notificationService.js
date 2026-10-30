import api from './api';

export const notificationService = {
  // Fetch all notifications for the authenticated student
  getNotifications: async () => {
    const response = await api.get('/student/notifications');
    return response.data;
  },

  // Mark a single notification as read
  markAsRead: async (id) => {
    const response = await api.patch(`/student/notifications/${id}/read`);
    return response.data;
  },

  // Mark all unread notifications as read
  markAllAsRead: async () => {
    const response = await api.patch('/student/notifications/read-all');
    return response.data;
  },
};
