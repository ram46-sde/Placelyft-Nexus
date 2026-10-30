const fs = require('fs');
const StudentProfile = require('../models/StudentProfile');
const { deletePhotoFile } = require('../middleware/photoUploadMiddleware');

/**
 * Strictly parses and validates an academic number (percentages or CGPA).
 * - undefined => { shouldSet: false }
 * - null or "" => { shouldSet: true, value: null }
 * - valid number in [min, max] => { shouldSet: true, value: number }
 * - invalid (out of bounds, non-numeric, NaN, Infinity, non-numeric string) => throws 400
 */
const parseAcademicNumber = (rawVal, fieldName, min, max, allowFloat = true) => {
  if (rawVal === undefined) {
    return { shouldSet: false };
  }
  if (rawVal === null || (typeof rawVal === 'string' && rawVal.trim() === '')) {
    return { shouldSet: true, value: null };
  }
  if (typeof rawVal === 'boolean' || typeof rawVal === 'object') {
    const error = new Error(`${fieldName} must be a valid number between ${min} and ${max}.`);
    error.statusCode = 400;
    throw error;
  }

  let num;
  if (typeof rawVal === 'number') {
    num = rawVal;
  } else if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    // Reject exponential notation (e.g. 1e1), whitespace gaps, hex, or alphanumeric
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const error = new Error(`${fieldName} must be a valid number between ${min} and ${max}.`);
      error.statusCode = 400;
      throw error;
    }
    num = allowFloat ? parseFloat(trimmed) : parseInt(trimmed, 10);
  } else {
    const error = new Error(`${fieldName} must be a valid number between ${min} and ${max}.`);
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(num) || isNaN(num) || num < min || num > max) {
    const error = new Error(`${fieldName} must be a valid number between ${min} and ${max}.`);
    error.statusCode = 400;
    throw error;
  }

  return { shouldSet: true, value: num };
};

// @desc    Get current student's profile
// @route   GET /api/student/profile
// @access  Private (Student)
const getProfile = async (req, res, next) => {
  try {
    // 1. Enforce student is associated with an institution
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    // 2. Enforce student's college assignment is verified
    if (req.user.collegeAssignmentStatus !== 'VERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    // 3. Query profile scoped strictly to authenticated user
    const profile = await StudentProfile.findOne({ user: req.user._id });

    // 4. Ensure no cross-tenant exposure: reject if profile belongs to a different college
    if (profile && profile.collegeId && profile.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student profile belongs to a different institution.',
      });
    }

    // If profile doesn't exist yet, return a successful response with null profile
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
    // 1. Enforce student is associated with an institution
    if (!req.user || !req.user.collegeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    // 2. Enforce student's college assignment is verified
    if (req.user.collegeAssignmentStatus !== 'VERIFIED') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    // 3. Disallow client from supplying or overriding collegeId
    if (req.body.collegeId && req.body.collegeId.toString() !== req.user.collegeId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: Cannot specify or override college assignment. College is derived from authenticated user.',
      });
    }

    const {
      rollNumber,
      department,
      course,
      batch,
      cgpa,
      backlogs,
      tenthPercentage,
      twelfthPercentage,
      ugPercentage,
      skills,
      projects,
      certifications,
      achievements,
      profilePhotoUrl,
      resumeUrl,
    } = req.body;

    // Validate academic percentages and scores
    const parsedTenth = parseAcademicNumber(tenthPercentage, '10th Standard percentage', 0, 100);
    const parsedTwelfth = parseAcademicNumber(twelfthPercentage, '12th Standard / Diploma percentage', 0, 100);
    const parsedUg = parseAcademicNumber(ugPercentage, 'Undergraduate percentage', 0, 100);
    const parsedCgpa = parseAcademicNumber(cgpa, 'CGPA', 0, 10);
    const parsedBacklogs = parseAcademicNumber(backlogs, 'Backlogs', 0, 100, false);

    // Validate projects if provided
    if (projects !== undefined) {
      if (!Array.isArray(projects)) {
        return res.status(400).json({
          success: false,
          message: 'Projects must be an array.',
        });
      }
      for (let i = 0; i < projects.length; i++) {
        const proj = projects[i];
        if (!proj || typeof proj !== 'object' || !proj.title || typeof proj.title !== 'string' || !proj.title.trim()) {
          return res.status(400).json({
            success: false,
            message: `Project at index ${i} must have a valid title.`,
          });
        }
      }
    }

    // Validate certifications if provided
    if (certifications !== undefined) {
      if (!Array.isArray(certifications)) {
        return res.status(400).json({
          success: false,
          message: 'Certifications must be an array.',
        });
      }
      for (let i = 0; i < certifications.length; i++) {
        const cert = certifications[i];
        if (!cert || typeof cert !== 'object' || !cert.name || typeof cert.name !== 'string' || !cert.name.trim()) {
          return res.status(400).json({
            success: false,
            message: `Certification at index ${i} must have a valid name.`,
          });
        }
      }
    }

    // Validate achievements if provided
    if (achievements !== undefined) {
      if (!Array.isArray(achievements)) {
        return res.status(400).json({
          success: false,
          message: 'Achievements must be an array.',
        });
      }
      for (let i = 0; i < achievements.length; i++) {
        const ach = achievements[i];
        if (!ach || typeof ach !== 'object' || !ach.title || typeof ach.title !== 'string' || !ach.title.trim()) {
          return res.status(400).json({
            success: false,
            message: `Achievement at index ${i} must have a valid title.`,
          });
        }
      }
    }

    // 4. Handle roll number normalization and validation consistently with the planned partial unique index
    let normalizedRoll;
    let shouldCheckDuplicate = false;

    if (rollNumber !== undefined) {
      if (rollNumber === null) {
        normalizedRoll = null;
      } else if (typeof rollNumber === 'string') {
        const trimmed = rollNumber.trim();
        normalizedRoll = trimmed;
        if (trimmed.length > 0) {
          shouldCheckDuplicate = true;
        }
      } else {
        const strVal = String(rollNumber).trim();
        normalizedRoll = strVal;
        if (strVal.length > 0) {
          shouldCheckDuplicate = true;
        }
      }
    }

    // 5. College-scoped, case-insensitive duplicate check (consistent with index collation { locale: 'en', strength: 2 })
    if (shouldCheckDuplicate) {
      const existingRoll = await StudentProfile.findOne({
        collegeId: req.user.collegeId,
        rollNumber: normalizedRoll,
        user: { $ne: req.user._id },
      }).collation({ locale: 'en', strength: 2 });

      if (existingRoll) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already in use by another student in this college.',
        });
      }
    }

    // 6. Build profile fields — tenant collegeId is derived exclusively from authenticated user
    const profileFields = {
      user: req.user._id,
      collegeId: req.user.collegeId,
      ...(rollNumber !== undefined && { rollNumber: normalizedRoll }),
      ...(department !== undefined && { department }),
      ...(course !== undefined && { course }),
      ...(batch !== undefined && { batch }),
      ...(parsedCgpa.shouldSet && { cgpa: parsedCgpa.value }),
      ...(parsedBacklogs.shouldSet && { backlogs: parsedBacklogs.value ?? 0 }),
      ...(parsedTenth.shouldSet && { tenthPercentage: parsedTenth.value }),
      ...(parsedTwelfth.shouldSet && { twelfthPercentage: parsedTwelfth.value }),
      ...(parsedUg.shouldSet && { ugPercentage: parsedUg.value }),
      ...(skills !== undefined && { skills }),
      ...(projects !== undefined && { projects }),
      ...(certifications !== undefined && { certifications }),
      ...(achievements !== undefined && { achievements }),
      ...(profilePhotoUrl !== undefined && { profilePhotoUrl }),
      ...(resumeUrl !== undefined && { resumeUrl }),
    };

    // 7. Check existing profile and prevent cross-tenant modification
    let existingProfile = await StudentProfile.findOne({ user: req.user._id });

    if (existingProfile) {
      if (existingProfile.collegeId && existingProfile.collegeId.toString() !== req.user.collegeId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Student profile belongs to a different institution.',
        });
      }

      // If profile photo is being explicitly replaced or cleared via upsert, cleanup old file
      if (
        profileFields.profilePhotoUrl !== undefined &&
        existingProfile.profilePhotoUrl &&
        existingProfile.profilePhotoUrl !== profileFields.profilePhotoUrl
      ) {
        deletePhotoFile(existingProfile.profilePhotoUrl);
      }

      const updatedProfile = await StudentProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: profileFields },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        profile: updatedProfile,
      });
    }

    // Create new profile
    const newProfile = await StudentProfile.create(profileFields);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: newProfile,
    });
  } catch (error) {
    if (error.code === 11000) {
      const isRollNumberConflict = Boolean(
        (error.keyPattern && error.keyPattern.rollNumber) ||
        (error.keyValue && error.keyValue.rollNumber !== undefined) ||
        (error.message && (error.message.includes('collegeId_1_rollNumber_1') || error.message.includes('rollNumber_1')))
      );

      if (isRollNumberConflict) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already in use by another student in this college.',
        });
      }

      const isUserConflict = Boolean(
        (error.keyPattern && error.keyPattern.user) ||
        (error.keyValue && error.keyValue.user !== undefined) ||
        (error.message && error.message.includes('user_1'))
      );

      if (isUserConflict) {
        return res.status(400).json({
          success: false,
          message: 'A student profile already exists for this user account.',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Duplicate key conflict on student profile.',
      });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

// @desc    Upload or replace student profile photo
// @route   POST /api/student/profile/photo
// @access  Private (Student)
const uploadProfilePhoto = async (req, res, next) => {
  try {
    // 1. Enforce student is associated with an institution
    if (!req.user || !req.user.collegeId) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account is not associated with an institution.',
      });
    }

    // 2. Enforce student's college assignment is verified
    if (req.user.collegeAssignmentStatus !== 'VERIFIED') {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student account college assignment is not verified.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded. Please attach an image file.',
      });
    }

    const photoUrl = `/uploads/profile-photos/${req.file.filename}`;

    // 3. Find or create profile strictly bound to authenticated user
    let profile = await StudentProfile.findOne({ user: req.user._id });

    if (profile) {
      // Cross-tenant verification
      if (profile.collegeId && profile.collegeId.toString() !== req.user.collegeId.toString()) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Student profile belongs to a different institution.',
        });
      }

      // Cleanup previously uploaded photo on disk if replacing
      if (profile.profilePhotoUrl && profile.profilePhotoUrl !== photoUrl) {
        deletePhotoFile(profile.profilePhotoUrl);
      }

      profile.profilePhotoUrl = photoUrl;
      await profile.save();

      return res.status(200).json({
        success: true,
        message: 'Profile photo uploaded successfully',
        photoUrl,
        profile,
      });
    }

    // Create new profile with photo
    profile = await StudentProfile.create({
      user: req.user._id,
      collegeId: req.user.collegeId,
      profilePhotoUrl: photoUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl,
      profile,
    });
  } catch (error) {
    // If DB save or other error occurs, clean up the written file to avoid orphans
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        // Ignore file cleanup error
      }
    }
    next(error);
  }
};

module.exports = {
  getProfile,
  upsertProfile,
  uploadProfilePhoto,
};
