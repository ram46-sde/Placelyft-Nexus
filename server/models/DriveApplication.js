const mongoose = require('mongoose');

const driveApplicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    placementDrive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: true,
    },
    // Additive tenant isolation field (Milestone 2)
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
    status: {
      type: String,
      enum: ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Rejected'],
      default: 'Applied',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent a student from applying to the same drive multiple times
driveApplicationSchema.index({ student: 1, placementDrive: 1 }, { unique: true });

const DriveApplication = mongoose.model('DriveApplication', driveApplicationSchema);

module.exports = DriveApplication;
