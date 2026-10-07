const mongoose = require('mongoose');

const placementDriveSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      // Enforced by business logic for backward compatibility
    },
    jobRole: {
      type: String,
      required: true,
      trim: true,
    },
    jobDescription: {
      type: String,
      required: true,
    },
    packageDetails: {
      type: String,
      trim: true,
    },
    driveDate: {
      type: Date,
      required: true,
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    eligibilityCriteria: {
      minCgpa: {
        type: Number,
        default: 0,
      },
      maxBacklogs: {
        type: Number,
        default: 0, // 0 means no active backlogs allowed, higher means allowed up to that number
      },
      requiredCourses: [
        {
          type: String,
          trim: true,
        },
      ],
      requiredSkills: [
        {
          type: String,
          trim: true,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

const PlacementDrive = mongoose.model('PlacementDrive', placementDriveSchema);

module.exports = PlacementDrive;
