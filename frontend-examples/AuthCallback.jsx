import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./AuthCallback.css";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const accessToken = searchParams.get("access_token");
        const refreshToken = searchParams.get("refresh_token");
        const userId = searchParams.get("user_id");
        const needsProfile = searchParams.get("needs_profile") === "true";
        const errorParam = searchParams.get("error");

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          setStatus("error");
          return;
        }

        if (!accessToken || !refreshToken || !userId) {
          setError("Missing authentication parameters");
          setStatus("error");
          return;
        }

        // Store tokens securely
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("userId", userId);

        // Fetch user data
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/v1/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const userData = await response.json();

        // Store user data
        localStorage.setItem("user", JSON.stringify(userData.data.user));

        setStatus("success");

        // Redirect based on profile completion status
        setTimeout(() => {
          if (
            needsProfile ||
            !userData.data.user.isProfileComplete ||
            !userData.data.user.role
          ) {
            // Redirect to profile completion
            navigate("/profile-completion", { replace: true });
          } else {
            // Redirect to dashboard
            navigate("/dashboard", { replace: true });
          }
        }, 2000);
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
        setStatus("error");
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    navigate("/login", { replace: true });
  };

  const handleGoHome = () => {
    navigate("/", { replace: true });
  };

  if (status === "processing") {
    return (
      <div className="auth-callback">
        <div className="auth-callback__content">
          <div className="auth-callback__spinner"></div>
          <h2>Completing sign in...</h2>
          <p>Please wait while we complete your authentication.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="auth-callback">
        <div className="auth-callback__content">
          <div className="auth-callback__error-icon">⚠️</div>
          <h2>Sign in failed</h2>
          <p>{error}</p>
          <div className="auth-callback__actions">
            <button
              onClick={handleRetry}
              className="auth-callback__btn auth-callback__btn--primary"
            >
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="auth-callback__btn auth-callback__btn--secondary"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-callback">
        <div className="auth-callback__content">
          <div className="auth-callback__success-icon">✅</div>
          <h2>Welcome!</h2>
          <p>You have been successfully signed in. Redirecting...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
