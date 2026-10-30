const express = require('express');
const router = express.Router();
const {
  getStudentNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All student notification routes require authentication and 'student' role
router.use(protect);
router.use(authorize('student'));

router.get('/', getStudentNotifications);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

module.exports = router;
