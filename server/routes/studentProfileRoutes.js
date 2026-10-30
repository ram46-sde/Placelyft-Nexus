const express = require('express');
const router = express.Router();
const {
  getProfile,
  upsertProfile,
  uploadProfilePhoto,
} = require('../controllers/studentProfileController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { handlePhotoUpload } = require('../middleware/photoUploadMiddleware');

// All profile routes require authentication and 'student' role
router.use(protect);
router.use(authorize('student'));

router.route('/')
  .get(getProfile)
  .put(upsertProfile);

router.post('/photo', handlePhotoUpload, uploadProfilePhoto);

module.exports = router;
