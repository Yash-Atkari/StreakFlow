import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import NivoraIcon from "../components/NivoraIcon";
import { playTap, playErrorPluck } from "../utils/audio";

import { analytics } from "../services/mobile/analytics";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({}); // Track validation and auth errors
  const [loading, setLoading] = useState(false); // Add a loading state for UX
  const [view, setView] = useState("login"); // 'login' | 'forgot-password'

  const validate = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }
    
    return newErrors;
  };

  const handleLogin = async () => {
    playTap();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      playErrorPluck();
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      playErrorPluck();
      setErrors({ auth: error.message });
    } else if (data?.user) {
      analytics.logLogin(data.user.id, "email");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    playTap();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      playErrorPluck();
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      playErrorPluck();
      setErrors({ auth: error.message });
    } else {
      if (data?.user) {
        analytics.logSignUp(data.user.id, "email");
      }
      // Professional feedback for sign up
      setErrors({ success: "Check your email for the confirmation link!" });
    }
    setLoading(false);
  };

  const handleResetRequest = async () => {
    playTap();
    if (!email) {
      playErrorPluck();
      setErrors({ email: "Email is required." });
      return;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      playErrorPluck();
      setErrors({ email: "Please enter a valid email address." });
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      playErrorPluck();
      setErrors({ auth: error.message });
    } else {
      setErrors({ success: "Password reset link has been sent to your email!" });
    }
    setLoading(false);
  };

  return (
    <div
      className="theme-wrapper theme-default"
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px"
      }}
    >
      <div
        style={{
          background: "rgba(20, 20, 28, 0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "36px 32px",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "370px",
          border: "1px solid rgba(255, 108, 0, 0.15)",
          transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Logo */}
        <div className="text-center mb-4">
          <span className="d-inline-flex align-items-center gap-2" style={{ fontSize: "28px" }}>
            <NivoraIcon size={35} />
            <b>
              <span style={{ color: "white" }}>Nivora</span>
            </b>
          </span>
        </div>

        {view === "login" && (
          <h5 className="mb-4 text-center" style={{ color: "#eee" }}>
            Login
          </h5>
        )}

        {view === "forgot-password" && (
          <h5 className="mb-4 text-center" style={{ color: "#eee" }}>
            Reset Password
          </h5>
        )}

        {view === "signup" && (
          <h5 className="mb-4 text-center" style={{ color: "#eee" }}>
            Create New Account
          </h5>
        )}

        {/* General Auth/Success Message */}
        {errors.auth && <div style={errorBannerStyle}>{errors.auth}</div>}
        {errors.success && <div style={successBannerStyle}>{errors.success}</div>}

        {/* Email */}
        <div className="mb-3">
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: null });
            }}
            style={{ ...inputStyle, borderColor: errors.email ? "#ff4d4d" : "#222" }}
            disabled={loading}
          />
          {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
        </div>

        {(view === "login" || view === "signup") && (
          <div className="mb-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: null });
              }}
              style={{ ...inputStyle, borderColor: errors.password ? "#ff4d4d" : "#222" }}
              disabled={loading}
            />
            {errors.password && <div style={errorTextStyle}>{errors.password}</div>}
            
            {view === "login" && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <span
                  onClick={() => {
                    setView("forgot-password");
                    setErrors({});
                  }}
                  style={{
                    color: "#888",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#ff6b00")}
                  onMouseLeave={(e) => (e.target.style.color = "#888")}
                >
                  Forgot Password?
                </span>
              </div>
            )}
          </div>
        )}

        {view === "login" && (
          <>
            {/* Buttons */}
            <button 
              onClick={handleLogin} 
              className="primary-btn mb-2"
              disabled={loading}
            >
              {loading ? "Processing..." : "Login"}
            </button>

            <button 
              onClick={() => {
                setView("signup");
                setErrors({});
                setEmail("");
                setPassword("");
              }} 
              className="secondary-btn"
              disabled={loading}
            >
              Create New Account
            </button>
          </>
        )}

        {view === "signup" && (
          <>
            {/* Buttons */}
            <button 
              onClick={handleSignup} 
              className="primary-btn mb-2"
              disabled={loading}
            >
              {loading ? "Processing..." : "Create New Account"}
            </button>

            <button 
              onClick={() => {
                setView("login");
                setErrors({});
                setEmail("");
                setPassword("");
              }} 
              className="secondary-btn"
              disabled={loading}
            >
              Back to Login
            </button>
          </>
        )}

        {view === "forgot-password" && (
          <>
            {/* Reset Request Button */}
            <button 
              onClick={handleResetRequest} 
              className="primary-btn mb-2"
              disabled={loading}
            >
              {loading ? "Processing..." : "Send Reset Link"}
            </button>

            {/* Back to Login Button */}
            <button 
              onClick={() => {
                setView("login");
                setErrors({});
                setEmail("");
                setPassword("");
              }} 
              className="secondary-btn"
              disabled={loading}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Internal Styles (matching your design)
const inputStyle = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "14px",
  padding: "14px",
  color: "white",
  outline: "none",
  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
};

const errorTextStyle = {
  color: "#ff4d4d",
  fontSize: "0.75rem",
  marginTop: "5px",
  marginLeft: "4px",
};

const errorBannerStyle = {
  background: "rgba(255, 77, 77, 0.08)",
  color: "#ff4d4d",
  padding: "12px",
  borderRadius: "12px",
  fontSize: "0.85rem",
  marginBottom: "18px",
  textAlign: "center",
  border: "1px solid rgba(255, 77, 77, 0.2)",
};

const successBannerStyle = {
  background: "rgba(75, 181, 67, 0.08)",
  color: "#4bb543",
  padding: "12px",
  borderRadius: "12px",
  fontSize: "0.85rem",
  marginBottom: "18px",
  textAlign: "center",
  border: "1px solid rgba(75, 181, 67, 0.2)",
};
