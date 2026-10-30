const express = require('express');
const router = express.Router();
const { getStudentDashboardSummary } = require('../controllers/studentDashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All student dashboard routes require authentication and 'student' role
router.use(protect);
router.use(authorize('student'));

router.get('/summary', getStudentDashboardSummary);

module.exports = router;
