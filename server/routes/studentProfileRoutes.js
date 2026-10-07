const express = require('express');
const router = express.Router();
const { getProfile, upsertProfile } = require('../controllers/studentProfileController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All profile routes require authentication and 'student' role
router.use(protect);
router.use(authorize('student'));

router.route('/')
  .get(getProfile)
  .put(upsertProfile);

module.exports = router;
