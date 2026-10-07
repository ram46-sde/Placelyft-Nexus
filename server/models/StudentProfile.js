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
    resumeUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

module.exports = StudentProfile;
