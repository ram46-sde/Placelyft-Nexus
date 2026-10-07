import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import StudentLayout from './layouts/StudentLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Student Portal Pages
import DashboardPage from './pages/student/DashboardPage';
import DrivesPage from './pages/student/DrivesPage';
import ApplicationsPage from './pages/student/ApplicationsPage';
import ProfilePage from './pages/student/ProfilePage';
import NotificationsPage from './pages/student/NotificationsPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Student Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/" element={<StudentLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="drives" element={<DrivesPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
