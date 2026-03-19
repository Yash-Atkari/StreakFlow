import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { FaFire } from "react-icons/fa";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({}); // Track validation and auth errors
  const [loading, setLoading] = useState(false); // Add a loading state for UX

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
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrors({ auth: error.message });
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrors({ auth: error.message });
    } else {
      // Professional feedback for sign up
      setErrors({ success: "Check your email for the confirmation link!" });
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px"
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          padding: "30px",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "350px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-3">
          <h3 style={{ fontWeight: "bold", color: "white" }}>
            <FaFire color="#ff6b00" /> StreakFlow
          </h3>
        </div>

        <h5 className="mb-4 text-center" style={{ color: "#eee" }}>
          Welcome Back
        </h5>

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
          />
          {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
        </div>

        {/* Password */}
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
          />
          {errors.password && <div style={errorTextStyle}>{errors.password}</div>}
        </div>

        {/* Buttons */}
        <button 
          onClick={handleLogin} 
          style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading ? "Processing..." : "Login"}
        </button>

        <button 
          onClick={handleSignup} 
          style={secondaryBtn}
          disabled={loading}
        >
          Create New Account
        </button>
      </div>
    </div>
  );
}

// Internal Styles (matching your design)
const inputStyle = {
  width: "100%",
  background: "#111",
  border: "1px solid #222",
  borderRadius: "12px",
  padding: "12px",
  color: "white",
  outline: "none",
  transition: "border-color 0.2s",
};

const errorTextStyle = {
  color: "#ff4d4d",
  fontSize: "0.75rem",
  marginTop: "5px",
  marginLeft: "4px",
};

const errorBannerStyle = {
  background: "rgba(255, 77, 77, 0.1)",
  color: "#ff4d4d",
  padding: "10px",
  borderRadius: "10px",
  fontSize: "0.85rem",
  marginBottom: "15px",
  textAlign: "center",
  border: "1px solid rgba(255, 77, 77, 0.2)"
};

const successBannerStyle = {
  background: "rgba(75, 181, 67, 0.1)",
  color: "#4bb543",
  padding: "10px",
  borderRadius: "10px",
  fontSize: "0.85rem",
  marginBottom: "15px",
  textAlign: "center",
  border: "1px solid rgba(75, 181, 67, 0.2)"
};

const primaryBtn = {
  width: "100%",
  background: "#ff6b00",
  border: "none",
  borderRadius: "12px",
  padding: "12px",
  color: "white",
  marginBottom: "10px",
  cursor: "pointer",
};

const secondaryBtn = {
  width: "100%",
  background: "transparent",
  border: "1px solid #333",
  borderRadius: "12px",
  padding: "12px",
  color: "#999",
  cursor: "pointer",
};