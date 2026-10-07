const StudentProfile = require('../models/StudentProfile');

// @desc    Get current student's profile
// @route   GET /api/student/profile
// @access  Private (Student)
const getProfile = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    
    // If profile doesn't exist yet, return a successful response with null profile
    // The frontend can handle this as an empty state ready to be filled
    res.status(200).json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update student profile
// @route   PUT /api/student/profile
// @access  Private (Student)
const upsertProfile = async (req, res, next) => {
  try {
    const {
      rollNumber,
      department,
      course,
      batch,
      cgpa,
      backlogs,
      skills,
      projects,
      certifications,
      resumeUrl,
    } = req.body;

    // Build profile object
    const profileFields = {
      user: req.user._id,
      ...(rollNumber !== undefined && { rollNumber }),
      ...(department !== undefined && { department }),
      ...(course !== undefined && { course }),
      ...(batch !== undefined && { batch }),
      ...(cgpa !== undefined && { cgpa }),
      ...(backlogs !== undefined && { backlogs }),
      ...(skills !== undefined && { skills }),
      ...(projects !== undefined && { projects }),
      ...(certifications !== undefined && { certifications }),
      ...(resumeUrl !== undefined && { resumeUrl }),
    };

    // Update if exists, otherwise create
    let profile = await StudentProfile.findOne({ user: req.user._id });

    if (profile) {
      // Check if trying to use a rollNumber that belongs to someone else
      if (rollNumber) {
         const existingRoll = await StudentProfile.findOne({ rollNumber, user: { $ne: req.user._id } });
         if (existingRoll) {
           return res.status(400).json({ success: false, message: 'Roll number already in use by another student' });
         }
      }

      profile = await StudentProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: profileFields },
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      if (rollNumber) {
        const existingRoll = await StudentProfile.findOne({ rollNumber });
        if (existingRoll) {
          return res.status(400).json({ success: false, message: 'Roll number already in use' });
        }
      }
      profile = await StudentProfile.create(profileFields);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  upsertProfile,
};
