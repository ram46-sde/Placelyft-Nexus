const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { getJwtSecret } = require('./config/jwt');

// Load environment variables
dotenv.config();

// Validate critical security environment variables on startup
try {
  getJwtSecret();
} catch (error) {
  console.error(`[Security Configuration Error]: ${error.message}`);
  process.exit(1);
}

// Connect to MongoDB
connectDB();

const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server]: CPMS Backend is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

