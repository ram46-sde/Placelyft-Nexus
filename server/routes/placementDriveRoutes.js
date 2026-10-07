const express = require('express');
const router = express.Router();
const { getAvailableDrives, getDriveById } = require('../controllers/placementDriveController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Student routes for viewing drives
router.use(protect);
router.use(authorize('student'));

router.get('/', getAvailableDrives);
router.get('/:id', getDriveById);

module.exports = router;
