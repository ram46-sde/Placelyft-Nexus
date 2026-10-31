const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College ownership is required for a department'],
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional HOD contact information
    hodContact: {
      type: {
        name: {
          type: String,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },
        phone: {
          type: String,
          trim: true,
        },
        officeLocation: {
          type: String,
          trim: true,
        },
      },
      default: undefined,
    },
    // Optional aliases for robust department resolution
    aliases: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    // Explicitly disable automatic index creation at runtime.
    // This protects live development and production environments from unintended index modification during startup.
    // Index builds must be executed explicitly in migrations or test setups.
    autoIndex: false,
  }
);

// Indexes:
// 1. Same-college case-insensitive uniqueness on department name
departmentSchema.index(
  { collegeId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// 2. Same-college case-insensitive uniqueness on department code
departmentSchema.index(
  { collegeId: 1, code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// 3. College-scoped query performance for active department listings
departmentSchema.index({ collegeId: 1, isActive: 1 });

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;
