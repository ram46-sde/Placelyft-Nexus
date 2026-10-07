const express = require('express');
const router = express.Router();
const { applyForDrive, getMyApplications } = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Student routes for applications
router.use(protect);
router.use(authorize('student'));

router.get('/', getMyApplications);
router.post('/:driveId', applyForDrive);

module.exports = router;
