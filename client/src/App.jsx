import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import StudentLayout from './layouts/StudentLayout';

// Common Pages
import LandingPage from './pages/LandingPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OfficerLoginPage from './pages/auth/OfficerLoginPage';
import RecruiterLoginPage from './pages/auth/RecruiterLoginPage';

// Student Portal Pages
import DashboardPage from './pages/student/DashboardPage';
import DrivesPage from './pages/student/DrivesPage';
import DriveDetailsPage from './pages/student/DriveDetailsPage';
import ApplicationsPage from './pages/student/ApplicationsPage';
import ProfilePage from './pages/student/ProfilePage';
import NotificationsPage from './pages/student/NotificationsPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Common Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Student Auth Routes */}
          <Route path="/student/login" element={<LoginPage />} />
          <Route path="/student/register" element={<RegisterPage />} />

          {/* Placement Officer Auth Route (Placeholder) */}
          <Route path="/placement-officer/login" element={<OfficerLoginPage />} />

          {/* Recruiter Auth Route (Placeholder) */}
          <Route path="/recruiter/login" element={<RecruiterLoginPage />} />

          {/* Protected Student Portal Routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']} loginPath="/student/login" />}>
            <Route element={<StudentLayout />}>
              <Route index element={<Navigate to="/student/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="drives" element={<DrivesPage />} />
              <Route path="drives/:id" element={<DriveDetailsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
