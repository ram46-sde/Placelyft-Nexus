const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// @desc    Get all notifications for the authenticated student
// @route   GET /api/student/notifications
// @access  Private (Student)
const getStudentNotifications = async (req, res, next) => {
  try {
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    if (req.user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    // Scoped strictly to authenticated student and their college tenant
    const filter = {
      recipient: req.user._id,
      collegeId: req.user.collegeId,
    };

    const notifications = await Notification.find(filter)
      .populate('placementDrive', 'jobRole company driveDate')
      .sort({ createdAt: -1, _id: -1 });

    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a single notification as read
// @route   PATCH /api/student/notifications/:id/read
// @access  Private (Student)
const markNotificationAsRead = async (req, res, next) => {
  try {
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    if (req.user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format.',
      });
    }

    // Must match both recipient and collegeId strictly to prevent IDOR / cross-tenant leakage
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user._id,
        collegeId: req.user.collegeId,
      },
      {
        $set: { isRead: true },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all unread notifications as read for the authenticated student
// @route   PATCH /api/student/notifications/read-all
// @access  Private (Student)
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    if (req.user.collegeAssignmentStatus === 'LEGACY_UNVERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        collegeId: req.user.collegeId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
