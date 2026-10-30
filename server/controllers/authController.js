const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const generateToken = require('../utils/generateToken');

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Basic request validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Explicit Single-College Resolution
    // Enforces configured college strictly via process.env.COLLEGE_ID and fails closed.
    // Removes the unsafe College.findOne({ isActive: true }) fallback.
    const configuredCollegeId = process.env.COLLEGE_ID;
    if (
      !configuredCollegeId ||
      typeof configuredCollegeId !== 'string' ||
      !configuredCollegeId.trim() ||
      !mongoose.Types.ObjectId.isValid(configuredCollegeId.trim())
    ) {
      return res.status(500).json({
        success: false,
        message: 'System configuration error: COLLEGE_ID is missing or invalid.',
      });
    }

    const targetCollege = await College.findOne({
      _id: configuredCollegeId.trim(),
      isActive: true,
    });

    if (!targetCollege) {
      return res.status(500).json({
        success: false,
        message: 'System configuration error: Configured college not found or is inactive.',
      });
    }

    // Create user with explicit 'student' role, verified collegeId, and VERIFIED status
    // Client-supplied role or collegeId is strictly ignored.
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'student',
      collegeId: targetCollege._id,
      collegeAssignmentStatus: 'VERIFIED',
    });

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Student account registered successfully.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        collegeAssignmentStatus: user.collegeAssignmentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Check for user (include password field for verification)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check active status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the administrator.',
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        collegeAssignmentStatus: user.collegeAssignmentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private (Bearer Token required)
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        collegeAssignmentStatus: user.collegeAssignmentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerStudent,
  login,
  getMe,
};
