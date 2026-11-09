const express = require('express');
const router = express.Router();
const {
  createDrive,
  getOfficerDrives,
  getDriveApplicants,
  updateApplicationStatus,
  archiveDrive,
  restoreDrive,
  deleteDrive,
  getPlacementMetrics,
} = require('../controllers/officerController');
const {
  getOfficerDepartments,
  updateDepartmentHodContact,
  updateDepartmentAliases,
} = require('../controllers/departmentController');
const {
  getDriveAttendance,
  markDriveAttendance,
} = require('../controllers/driveAttendanceController');
const {
  verifyOutcome,
  revokeOutcome,
  getOutcomeHistory,
  getOutcomesQueue,
  getVerifiedOutcomes,
} = require('../controllers/placementOutcomeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All officer routes require valid JWT authentication and placement_officer role
router.use(protect);
router.use(authorize('placement_officer'));

// Department Management
router.get('/departments', getOfficerDepartments);
router.put('/departments/:id/hod-contact', updateDepartmentHodContact);
router.put('/departments/:id/aliases', updateDepartmentAliases);

// Placement Drive Management
router.post('/drives', createDrive);
router.get('/drives', getOfficerDrives);
router.get('/drives/:id/applications', getDriveApplicants);
router.patch('/drives/:id/archive', archiveDrive);
router.patch('/drives/:id/restore', restoreDrive);
router.delete('/drives/:id', deleteDrive);

// Drive Attendance Management
router.get('/drives/:id/attendance', getDriveAttendance);
router.post('/drives/:id/attendance/mark', markDriveAttendance);

// Application Status Management
router.patch('/applications/:id/status', updateApplicationStatus);

// Placement Outcome Management
router.get('/metrics', getPlacementMetrics);
router.get('/dashboard/metrics', getPlacementMetrics);
router.get('/outcomes/queue', getOutcomesQueue);
router.get('/outcomes', getVerifiedOutcomes);
router.post('/outcomes/:applicationId/verify', verifyOutcome);
router.post('/outcomes/:applicationId/revoke', revokeOutcome);
router.get('/outcomes/:applicationId/history', getOutcomeHistory);

module.exports = router;

