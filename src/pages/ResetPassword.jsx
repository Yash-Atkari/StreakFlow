import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import NivoraIcon from "../components/NivoraIcon";

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!password) {
      setErrors({ password: "New password is required." });
      return;
    }
    if (password.length < 6) {
      setErrors({ password: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setErrors({ auth: error.message });
    } else {
      setErrors({ success: "Your password has been successfully updated!" });
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
        }}
      >
        {/* Logo */}
        <div className="text-center mb-3">
          <h3 style={{ fontWeight: "bold", color: "white" }}>
            <NivoraIcon color="#ff6b00" /> Nivora
          </h3>
        </div>

        <h5 className="mb-4 text-center" style={{ color: "#eee" }}>
          Reset Password
        </h5>

        {/* General Auth/Success Message */}
        {errors.auth && <div style={errorBannerStyle}>{errors.auth}</div>}
        {errors.success && (
          <div>
            <div style={successBannerStyle}>{errors.success}</div>
            <button 
              onClick={onComplete} 
              className="primary-btn"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {!errors.success && (
          <>
            {/* New Password */}
            <div className="mb-3">
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: null });
                }}
                style={{ ...inputStyle, borderColor: errors.password ? "#ff4d4d" : "#222" }}
              />
              {errors.password && <div style={errorTextStyle}>{errors.password}</div>}
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                }}
                style={{ ...inputStyle, borderColor: errors.confirmPassword ? "#ff4d4d" : "#222" }}
              />
              {errors.confirmPassword && <div style={errorTextStyle}>{errors.confirmPassword}</div>}
            </div>

            {/* Buttons */}
            <button 
              onClick={handleResetPassword} 
              className="primary-btn"
              disabled={loading}
            >
              {loading ? "Processing..." : "Update Password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Internal Styles
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


