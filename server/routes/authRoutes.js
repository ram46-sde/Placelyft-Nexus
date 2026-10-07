const express = require('express');
const router = express.Router();
const {
  registerStudent,
  login,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public endpoints
router.post('/register', registerStudent);
router.post('/login', login);

// Protected endpoint
router.get('/me', protect, getMe);

module.exports = router;
