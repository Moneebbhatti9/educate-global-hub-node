import { useState, useEffect, createContext, useContext } from "react";

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem("accessToken");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verify token is still valid
          const response = await fetch(
            `${process.env.REACT_APP_API_URL}/api/v1/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${storedToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            // Token is invalid, clear storage
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
            localStorage.removeItem("userId");
            setAccessToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Clear invalid data
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        localStorage.removeItem("userId");
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = (userData, token, refreshToken) => {
    setUser(userData);
    setAccessToken(token);
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  // Update user function
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
  };

  // Logout function
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        // Call logout endpoint to revoke refresh token
        await fetch(`${process.env.REACT_APP_API_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear all auth data
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
    }
  };

  // Refresh token function
  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/auth/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      const data = await response.json();
      const newAccessToken = data.data.accessToken;
      const newRefreshToken = data.data.refreshToken;

      setAccessToken(newAccessToken);
      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      return newAccessToken;
    } catch (error) {
      console.error("Token refresh error:", error);
      logout();
      throw error;
    }
  };

  // Make authenticated API request
  const apiRequest = async (url, options = {}) => {
    let token = accessToken;

    // Try the request with current token
    let response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // If token is expired, try to refresh it
    if (response.status === 401) {
      try {
        token = await refreshAccessToken();

        // Retry the request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });
      } catch (refreshError) {
        // Refresh failed, user needs to login again
        logout();
        throw refreshError;
      }
    }

    return response;
  };

  const value = {
    user,
    accessToken,
    loading,
    login,
    updateUser,
    logout,
    refreshAccessToken,
    apiRequest,
    isAuthenticated: !!user && !!accessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = (WrappedComponent) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <div>Loading...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login or show login form
      window.location.href = "/login";
      return null;
    }

    return <WrappedComponent {...props} />;
  };
};

export default useAuth;
