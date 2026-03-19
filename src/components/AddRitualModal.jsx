import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import "../styles/modal.css";

export default function AddRitualModal({ close, refresh, ritual }) {
  const [closing, setClosing] = useState(false);
  const [errors, setErrors] = useState({}); // Track validation errors
  const [form, setForm] = useState({
    title: ritual?.title || "",
    description: ritual?.description || "",
    repeat_type: ritual?.repeat_type || "daily",
    custom_days: ritual?.custom_days || [],
    submit_window: ritual?.submit_window || false,
    start_time: ritual?.start_time || "06:00",
    end_time: ritual?.end_time || "08:00",
  });

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      close();
    }, 250); 
  };

  const daysList = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
  ];

  const toggleDay = (value) => {
    let updated = [...form.custom_days];
    if (updated.includes(value)) {
      updated = updated.filter((d) => d !== value);
    } else {
      updated.push(value);
    }
    setForm({ ...form, custom_days: updated });
    
    // Clear error if user selects a day
    if (errors.custom_days) {
      setErrors({ ...errors, custom_days: null });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.title.trim()) {
      newErrors.title = "A title is required to keep your ritual organized.";
    }
    if (form.repeat_type === "custom" && form.custom_days.length === 0) {
      newErrors.custom_days = "Please select at least one day for custom recurrence.";
    }
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return; // Stop here if there are errors
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrors({ auth: "You must be logged in to save rituals." });
      return;
    }

    const payload = {
      ...form,
      user_id: user.id,
    };

    if (!form.submit_window) {
      payload.start_time = null;
      payload.end_time = null;
    }

    let error;
    if (ritual) {
      const res = await supabase.from("rituals").update(payload).eq("id", ritual.id);
      error = res.error;
    } else {
      const res = await supabase.from("rituals").insert([payload]);
      error = res.error;
    }

    if (error) {
      console.error(error);
      setErrors({ submit: "Something went wrong on our end. Please try again." });
      return;
    }

    refresh();
    close();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className={`modal-card ${closing ? "closing" : ""}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="d-flex justify-content-between mb-3">
          <h5>{ritual ? "Edit Ritual" : "New Ritual"}</h5>
          <span style={{ cursor: "pointer" }} onClick={handleClose}>✕</span>
        </div>

        {/* Title */}
        <div className="label">TITLE</div>
        <input
          className={`input ${errors.title ? "input-error" : ""}`}
          placeholder="e.g., Morning Meditation"
          value={form.title}
          onChange={(e) => {
            setForm({ ...form, title: e.target.value });
            if (errors.title) setErrors({ ...errors, title: null });
          }}
        />
        {errors.title && <div className="error-message">{errors.title}</div>}

        {/* Description */}
        <div className="label mt-3">DESCRIPTION</div>
        <textarea
          className="input"
          placeholder="Optional details..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {/* Recurrence */}
        <div className="label mt-3">RECURRENCE</div>
        <div className="d-flex gap-1 mb-3">
          {["daily", "weekly", "biweekly", "custom"].map((type) => (
            <button
              key={type}
              onClick={() => {
                setForm({ ...form, repeat_type: type });
                setErrors({ ...errors, custom_days: null });
              }}
              className={`pill ${form.repeat_type === type ? "active" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Custom Days */}
        {form.repeat_type === "custom" && (
          <>
            <div className="label">DAYS</div>
            <div className="days mb-1">
              {daysList.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`pill ${form.custom_days.includes(day.value) ? "active" : ""}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {errors.custom_days && <div className="error-message">{errors.custom_days}</div>}
          </>
        )}

        {/* Submit Window */}
        <div className="label mt-3">SUBMIT WINDOW</div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-muted small">Restrict check-ins to a specific time</span>
          <div
            className={`toggle ${form.submit_window ? "active" : ""}`}
            onClick={() => setForm({ ...form, submit_window: !form.submit_window })}
          >
            <div className="toggle-circle"></div>
          </div>
        </div>

        {/* Time Inputs */}
        {form.submit_window && (
          <div className="time-row mb-3">
            <div className="time-box">
              <div className="label">Start</div>
              <input
                type="time"
                className="time-input"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="time-box">
              <div className="label">End</div>
              <input
                type="time"
                className="time-input"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* General Error (Auth or Submit) */}
        {errors.auth || errors.submit ? (
          <div className="error-message mb-2 text-center">
            {errors.auth || errors.submit}
          </div>
        ) : null}

        {/* Action Button */}
        <button onClick={handleSave} className="primary-btn mt-2">
          {ritual ? "Update Ritual" : "Create Ritual"}
        </button>
      </div>
    </div>
  );
}
