import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import "./ProfileCompletion.css";

const ProfileCompletion = () => {
  const { user, apiRequest, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: "",
    phone: "",
    // Add other profile fields as needed
  });

  useEffect(() => {
    // If user already has a role and profile is complete, redirect to dashboard
    if (user?.role && user?.isProfileComplete) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest(
        `${process.env.REACT_APP_API_URL}/api/v1/users/profile`,
        {
          method: "PUT",
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // Update user data in context and localStorage
        updateUser(result.data.user);

        // Redirect to dashboard
        navigate("/dashboard", { replace: true });
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow user to skip profile completion for now
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="profile-completion">
      <div className="profile-completion__container">
        <div className="profile-completion__header">
          <h1>Complete Your Profile</h1>
          <p>
            Help us personalize your experience by completing your profile
            information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="profile-completion__form">
          <div className="form-group">
            <label htmlFor="role" className="form-label">
              I am a: <span className="required">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Select your role</option>
              <option value="teacher">Teacher</option>
              <option value="school">School Administrator</option>
              <option value="recruiter">Recruiter</option>
              <option value="supplier">Educational Supplier</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="form-input"
              placeholder="+1234567890"
            />
            <small className="form-help">
              Include country code (e.g., +1234567890)
            </small>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !formData.role}
            >
              {loading ? "Saving..." : "Complete Profile"}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="btn btn--secondary"
              disabled={loading}
            >
              Skip for Now
            </button>
          </div>
        </form>

        <div className="profile-completion__info">
          <h3>Why complete your profile?</h3>
          <ul>
            <li>Get personalized job recommendations</li>
            <li>Connect with relevant schools and opportunities</li>
            <li>Access exclusive features and content</li>
            <li>Build your professional network</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;
