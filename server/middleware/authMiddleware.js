const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes: verify JWT Bearer token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cpms_default_secret_key');

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact the administrator.',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('[AuthMiddleware Error]:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authorization token.',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.',
    });
  }
};

// Authorize roles (e.g. authorize('student'))
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user ? req.user.role : 'unauthenticated'}) is not authorized to access this resource.`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
