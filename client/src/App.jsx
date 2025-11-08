import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Upload from './pages/Upload';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import { logout, getCurrentUser } from './api';

function App() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to check and update user state
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Verify token and get user info
        const response = await getCurrentUser();
        setUser(response.user);
        localStorage.setItem('username', response.user.username);
      } catch (error) {
        console.error('Error getting current user:', error);
        // Token is invalid, clear it
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
      }
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }

    // Initial auth check
    checkAuth().finally(() => {
      setLoading(false);
    });

    // Listen for storage changes (when login/signup sets token)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        checkAuth();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom auth event (for same-tab updates)
    const handleAuthEvent = () => {
      checkAuth();
    };
    window.addEventListener('auth-state-changed', handleAuthEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthEvent);
    };
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Sidebar - only show if user is authenticated */}
        {user && (
          <Sidebar
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            user={user}
            onLogout={handleLogout}
          />
        )}

        {/* Main Content */}
        <div className={user ? 'ml-64' : ''}>
          <AnimatedRoutes user={user} darkMode={darkMode} toggleDarkMode={toggleDarkMode} onAuthStateChange={checkAuth} />
        </div>
      </div>
    </Router>
  );
}

function AnimatedRoutes({ user, darkMode, toggleDarkMode, onAuthStateChange }) {
  const location = useLocation();

  // Check auth state when route changes (especially after login/signup)
  useEffect(() => {
    if (location.pathname !== '/login' && location.pathname !== '/signup') {
      const token = localStorage.getItem('token');
      if (token && !user) {
        // Token exists but user state is null - trigger auth check
        onAuthStateChange();
      }
    }
  }, [location.pathname, user, onAuthStateChange]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Routes>
          <Route path="/login" element={<Login onLoginSuccess={onAuthStateChange} />} />
          <Route path="/signup" element={<Signup onSignupSuccess={onAuthStateChange} />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default App;