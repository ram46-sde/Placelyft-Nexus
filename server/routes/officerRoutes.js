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

module.exports = router;
