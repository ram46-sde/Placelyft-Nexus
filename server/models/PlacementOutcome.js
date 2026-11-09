const mongoose = require('mongoose');

const outcomeHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['verified', 'revoked', 'reverified'],
      required: true,
    },
    oldStatus: {
      type: String,
      enum: ['verified', 'revoked', null],
      default: null,
    },
    newStatus: {
      type: String,
      enum: ['verified', 'revoked'],
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
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    ctc: {
      type: Number,
      default: null,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: true }
);

const departmentSnapshotSchema = new mongoose.Schema(
  {
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
    departmentCode: {
      type: String,
      default: null,
      trim: true,
    },
    resolutionStatus: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const offerPackageSchema = new mongoose.Schema(
  {
    ctc: {
      type: Number,
      default: null,
    },
    unit: {
      type: String,
      default: 'LPA',
    },
    currency: {
      type: String,
      default: 'INR',
    },
  },
  { _id: false }
);

const placementOutcomeSchema = new mongoose.Schema(
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
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriveApplication',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['verified', 'revoked'],
      required: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    departmentSnapshot: {
      type: departmentSnapshotSchema,
      required: true,
    },
    offerPackage: {
      type: offerPackageSchema,
      default: () => ({ ctc: null, unit: 'LPA', currency: 'INR' }),
    },
    history: {
      type: [outcomeHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    autoIndex: false, // Prevent auto-building indexes against dev/prod on server start
  }
);

// Defined candidate indexes (autoIndex: false prevents automatic creation against dev/prod):
// 1. Unique outcome per application (ensures 1 outcome per student application)
placementOutcomeSchema.index({ application: 1 }, { unique: true });

// 2. Drive-level scoping for college drives
placementOutcomeSchema.index({ collegeId: 1, placementDrive: 1 });

// 3. Student-level outcome lookups within college
placementOutcomeSchema.index({ collegeId: 1, student: 1 });

// 4. Status queries (e.g. verified vs revoked) scoped by college
placementOutcomeSchema.index({ collegeId: 1, status: 1 });

const PlacementOutcome = mongoose.model('PlacementOutcome', placementOutcomeSchema);

module.exports = PlacementOutcome;
