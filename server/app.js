const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const studentProfileRoutes = require('./routes/studentProfileRoutes');
const placementDriveRoutes = require('./routes/placementDriveRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const studentDashboardRoutes = require('./routes/studentDashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const officerRoutes = require('./routes/officerRoutes');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow frontend development requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'College Placement Management Platform API is running smoothly.',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/student/profile', studentProfileRoutes);
app.use('/api/student/drives', placementDriveRoutes);
app.use('/api/student/applications', applicationRoutes);
app.use('/api/student/dashboard', studentDashboardRoutes);
app.use('/api/student/notifications', notificationRoutes);
app.use('/api/officer', officerRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
