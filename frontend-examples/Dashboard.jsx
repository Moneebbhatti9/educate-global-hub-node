import React from "react";
import { useAuth } from "./useAuth";
import "./Dashboard.css";

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

        {!user?.isProfileComplete && (
          <div className="dashboard-card dashboard-card--warning">
            <h3>Complete Your Profile</h3>
            <p>
              Your profile is incomplete. Complete it to access all features.
            </p>
            <button
              onClick={() => (window.location.href = "/profile-completion")}
              className="btn btn--primary"
            >
              Complete Profile
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
