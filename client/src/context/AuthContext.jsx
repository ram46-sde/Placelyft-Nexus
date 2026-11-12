import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('cpms_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('cpms_token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch student profile once when authenticated student is active
  useEffect(() => {
    let isMounted = true;
    const isStudent = user?._id && user?.role === 'student';
    if (isStudent && token) {
      setProfileLoading(true);
      profileService
        .getProfile()
        .then((data) => {
          if (isMounted && data && data.success && data.profile) {
            setStudentProfile(data.profile);
          }
        })
        .catch(() => {
          // Fallback handled cleanly by getDepartmentLabel
        })
        .finally(() => {
          if (isMounted) {
            setProfileLoading(false);
          }
        });
    } else {
      setStudentProfile(null);
      setProfileLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user?._id, user?.role, token]);

  // Hydrate user session on initial load
  useEffect(() => {
    const verifyUserSession = async () => {
      const storedToken = localStorage.getItem('cpms_token');
      if (storedToken) {
        try {
          const data = await authService.getMe();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('cpms_user', JSON.stringify(data.user));
          } else {
            logout();
          }
        } catch (err) {
          console.error('[Session Verification Failed]:', err);
          logout();
        }
      }
      setLoading(false);
    };

    verifyUserSession();
  }, []);

  // Register student
  const register = async (name, email, password) => {
    setError(null);
    try {
      const data = await authService.register({ name, email, password });
      if (data.success) {
        localStorage.setItem('cpms_token', data.token);
        localStorage.setItem('cpms_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please check your details.';
      setError(message);
      return { success: false, message };
    }
  };

  // Login user
  const login = async (email, password) => {
    setError(null);
    try {
      const data = await authService.login({ email, password });
      if (data.success) {
        localStorage.setItem('cpms_token', data.token);
        localStorage.setItem('cpms_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please verify credentials.';
      setError(message);
      return { success: false, message };
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('cpms_token');
    localStorage.removeItem('cpms_user');
    setUser(null);
    setStudentProfile(null);
    setProfileLoading(false);
    setToken(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        error,
        setError,
        login,
        register,
        logout,
        studentProfile,
        setStudentProfile,
        profileLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
