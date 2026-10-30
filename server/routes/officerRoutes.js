const express = require('express');
const router = express.Router();
const {
  createDrive,
  getOfficerDrives,
  getDriveApplicants,
  updateApplicationStatus,
} = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All officer routes require valid JWT authentication and placement_officer role
router.use(protect);
router.use(authorize('placement_officer'));

// Placement Drive Management
router.post('/drives', createDrive);
router.get('/drives', getOfficerDrives);
router.get('/drives/:id/applications', getDriveApplicants);

// Application Status Management
router.patch('/applications/:id/status', updateApplicationStatus);

module.exports = router;
