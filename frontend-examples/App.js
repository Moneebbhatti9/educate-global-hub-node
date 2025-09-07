import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./useAuth";
import SocialLoginForm from "./SocialLoginForm";
import AuthCallback from "./AuthCallback";
import ProfileCompletion from "./ProfileCompletion";
import Dashboard from "./Dashboard";
import "./App.css";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Login Page Component
const LoginPage = () => {
  const { login } = useAuth();

  const handleLoginSuccess = (userData) => {
    console.log("Login successful:", userData);
    // The AuthCallback component will handle token storage and routing
  };

  const handleLoginError = (error) => {
    console.error("Login error:", error);
    // Handle login error (show toast, etc.)
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome to Educate Global Hub</h1>
          <p>Sign in to access your account</p>
        </div>

        <SocialLoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
        />
      </div>
    </div>
  );
};

// Dashboard Component (Example)
const Dashboard = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="user-info">
          <span>
            Welcome, {user?.firstName} {user?.lastName}
          </span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-card">
          <h2>User Information</h2>
          <div className="user-details">
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
            <p>
              <strong>Role:</strong> {user?.role || "Not set"}
            </p>
            <p>
              <strong>Status:</strong> {user?.status}
            </p>
            <p>
              <strong>Email Verified:</strong>{" "}
              {user?.isEmailVerified ? "Yes" : "No"}
            </p>
            <p>
              <strong>Profile Complete:</strong>{" "}
              {user?.isProfileComplete ? "Yes" : "No"}
            </p>
            {user?.avatarUrl && (
              <div className="avatar">
                <img src={user.avatarUrl} alt="User Avatar" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Routes */}
            <Route
              path="/profile-completion"
              element={
                <ProtectedRoute>
                  <ProfileCompletion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
