const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One profile per user
    },
    rollNumber: {
      type: String,
      trim: true,
      sparse: true, // Allows nulls while keeping it unique when present
    },
    // Additive tenant and department normalization fields (Milestone 2)
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    legacyDepartment: {
      type: String,
      trim: true,
    },
    // Existing legacy department string preserved for backward compatibility
    department: {
      type: String,
      trim: true,
    },
    course: {
      type: String,
      trim: true,
    },
    batch: {
      type: String,
      trim: true,
    },
    // Additive fields (Feature 01: Enhanced Student Details Panel)
    section: {
      type: String,
      trim: true,
      default: null,
    },
    academicYear: {
      type: String,
      enum: ['I', 'II', 'III', 'IV', null],
      default: null,
    },
    cgpa: {
      type: Number,
      min: 0,
      max: 10,
    },
    backlogs: {
      type: Number,
      default: 0,
      min: 0,
    },
    tenthPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    twelfthPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    ugPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    projects: [
      {
        title: { type: String, required: true },
        description: { type: String },
        link: { type: String },
      },
    ],
    certifications: [
      {
        name: { type: String, required: true },
        issuer: { type: String },
        date: { type: String },
        url: { type: String },
      },
    ],
    achievements: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        date: { type: String, trim: true },
        issuer: { type: String, trim: true },
        certificateUrl: { type: String, trim: true },
      },
    ],
    profilePhotoUrl: {
      type: String,
      trim: true,
    },
    resumeUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Schema-level tenant integrity: A non-empty roll number strictly requires a valid college assignment
studentProfileSchema.pre('validate', async function () {
  if (this.rollNumber && typeof this.rollNumber === 'string' && this.rollNumber.trim().length > 0) {
    if (!this.collegeId && this.user) {
      // Attempt to auto-populate from the associated User account
      const User = mongoose.models.User || mongoose.model('User');
      const userDoc = await User.findById(this.user).select('collegeId');
      if (userDoc && userDoc.collegeId) {
        this.collegeId = userDoc.collegeId;
      }
    }
    if (!this.collegeId) {
      this.invalidate('collegeId', 'A non-empty roll number requires a valid college assignment.');
    }
  }
});

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

module.exports = StudentProfile;
