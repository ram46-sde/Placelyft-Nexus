const mongoose = require('mongoose');

const attendanceHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    oldStatus: {
      type: String,
      enum: ['Pending', 'Present', 'Absent'],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ['Pending', 'Present', 'Absent'],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    onBehalfOf: {
      type: String,
      required: true,
      default: 'HOD',
    },
    note: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const driveAttendanceSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    placementDrive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveApplication',
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    departmentName: {
      type: String,
      required: true,
      trim: true,
    },
    departmentResolutionStatus: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Present', 'Absent'],
      default: 'Pending',
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    markedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    markedOnBehalfOf: {
      type: String,
      required: true,
      default: 'HOD',
    },
    history: {
      type: [attendanceHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    autoIndex: false, // Prevent auto-building indexes against dev/prod on server start
  }
);

// Indexes (Candidate definitions to be reported; autoIndex: false prevents dev/prod creation on start):
// 1. Exactly one attendance record per application
driveAttendanceSchema.index({ application: 1 }, { unique: true });

// 2. Exactly one attendance record per student per placement drive
driveAttendanceSchema.index({ placementDrive: 1, student: 1 }, { unique: true });

// 3. Optimized compound index for department-wise list queries by college and drive
driveAttendanceSchema.index({ collegeId: 1, placementDrive: 1 });

const DriveAttendance = mongoose.model('DriveAttendance', driveAttendanceSchema);

module.exports = DriveAttendance;
