const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['STATUS_UPDATE', 'DRIVE_ANNOUNCEMENT', 'SYSTEM'],
      default: 'STATUS_UPDATE',
    },
    placementDrive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveApplication',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for retrieving a recipient's notifications sorted newest first
notificationSchema.index({ recipient: 1, collegeId: 1, createdAt: -1 });

// Compound index for fast unread count and bulk read updates
notificationSchema.index({ recipient: 1, collegeId: 1, isRead: 1 });

// Partial unique compound index to ensure idempotent DRIVE_ANNOUNCEMENT delivery
notificationSchema.index(
  { recipient: 1, type: 1, placementDrive: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'DRIVE_ANNOUNCEMENT',
      placementDrive: { $exists: true },
    },
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
