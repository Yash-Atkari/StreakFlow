import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import "../styles/modal.css";

export default function AddUrgencyModal({ close, refresh, urgencyGoal }) {
  const [closing, setClosing] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const formatDateForInput = (date) => {
    const d = new Date(date);
    const pad = (num) => String(num).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getInitialTimes = () => {
    const start = urgencyGoal ? new Date(urgencyGoal.start_time) : new Date();
    // Default end time to 1 hour from start
    const end = urgencyGoal ? new Date(urgencyGoal.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    return {
      start_time: formatDateForInput(start),
      end_time: formatDateForInput(end),
    };
  };

  const initialTimes = getInitialTimes();

  const [form, setForm] = useState({
    title: urgencyGoal?.title || "",
    description: urgencyGoal?.description || "",
    start_time: initialTimes.start_time,
    end_time: initialTimes.end_time,
  });

  const handleClose = () => {
    if (submitting) return;
    setClosing(true);
    setTimeout(() => {
      close();
    }, 250);
  };

  // Helper to apply quick presets based on start_time
  const applyPreset = (minutes) => {
    if (submitting) return;
    const start = new Date(form.start_time);
    let end;
    if (minutes === "today") {
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(start.getTime() + minutes * 60 * 1000);
    }
    setForm({ ...form, end_time: formatDateForInput(end) });
    if (errors.end_time) {
      setErrors({ ...errors, end_time: null });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.title.trim()) {
      newErrors.title = "A title is required to name your goal.";
    }
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);

    if (isNaN(start.getTime())) {
      newErrors.start_time = "Please enter a valid start time.";
    }
    if (isNaN(end.getTime())) {
      newErrors.end_time = "Please enter a valid end time.";
    } else if (end <= start) {
      newErrors.end_time = "End time must be after start time.";
    }
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrors({ auth: "You must be logged in to save goals." });
        setSubmitting(false);
        return;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        user_id: user.id,
      };

      let saveError = null;

      // Primary write to Supabase
      try {
        if (urgencyGoal) {
          const { error } = await supabase
            .from("urgency_goals")
            .update(payload)
            .eq("id", urgencyGoal.id);
          saveError = error;
        } else {
          const { error } = await supabase
            .from("urgency_goals")
            .insert([payload]);
          saveError = error;
        }
      } catch (err) {
        console.warn("Supabase save error, falling back to localStorage:", err);
        saveError = err;
      }

      // Fallback: If table doesn't exist or network error occurs, store in LocalStorage
      if (saveError) {
        console.warn("Database save failed. Falling back to local storage...", saveError);
        
        // Load existing local goals
        const localGoalsStr = localStorage.getItem(`nivora_local_urgency_${user.id}`) || "[]";
        let localGoals = [];
        try {
          localGoals = JSON.parse(localGoalsStr);
        } catch (e) {
          localGoals = [];
        }

        if (urgencyGoal) {
          // Edit existing local goal
          localGoals = localGoals.map(g => g.id === urgencyGoal.id ? { 
            ...g, 
            ...payload, 
            updated_at: new Date().toISOString() 
          } : g);
        } else {
          // Add new local goal
          const newGoal = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            ...payload,
            completed: false,
            completed_at: null,
            created_at: new Date().toISOString(),
          };
          localGoals.push(newGoal);
        }

        localStorage.setItem(`nivora_local_urgency_${user.id}`, JSON.stringify(localGoals));
      }

      refresh();
      close();
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message || "An unexpected error occurred." });
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className={`modal-card ${closing ? "closing" : ""}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="d-flex justify-content-between mb-3">
          <h5>{urgencyGoal ? "Edit Urgency Goal" : "New Urgency Goal"}</h5>
          <span style={{ cursor: "pointer" }} onClick={handleClose}>✕</span>
        </div>

        {/* Title */}
        <div className="label">TITLE</div>
        <input
          className={`input ${errors.title ? "input-error" : ""}`}
          placeholder="e.g., Complete physics report"
          value={form.title}
          onChange={(e) => {
            setForm({ ...form, title: e.target.value });
            if (errors.title) setErrors({ ...errors, title: null });
          }}
          disabled={submitting}
        />
        {errors.title && <div className="error-message">{errors.title}</div>}

        {/* Description */}
        <div className="label mt-3">DESCRIPTION</div>
        <textarea
          className="input"
          placeholder="e.g., Focus on graphs and analysis..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={submitting}
        />

        {/* Start Time */}
        <div className="label mt-3">START</div>
        <input
          type="datetime-local"
          className={`input ${errors.start_time ? "input-error" : ""}`}
          value={form.start_time}
          onChange={(e) => {
            setForm({ ...form, start_time: e.target.value });
            if (errors.start_time) setErrors({ ...errors, start_time: null });
          }}
          disabled={submitting}
        />
        {errors.start_time && <div className="error-message">{errors.start_time}</div>}

        {/* End Time / Deadline */}
        <div className="label mt-3">DEADLINE</div>
        <input
          type="datetime-local"
          className={`input ${errors.end_time ? "input-error" : ""}`}
          value={form.end_time}
          onChange={(e) => {
            setForm({ ...form, end_time: e.target.value });
            if (errors.end_time) setErrors({ ...errors, end_time: null });
          }}
          disabled={submitting}
        />
        {errors.end_time && <div className="error-message">{errors.end_time}</div>}

        {/* Quick presets */}
        <div className="label mt-2">QUICK DURATION PRESETS</div>
        <div className="d-flex flex-wrap gap-1 mb-3">
          {[
            { label: "15m", val: 15 },
            { label: "30m", val: 30 },
            { label: "1h", val: 60 },
            { label: "3h", val: 180 },
            { label: "Today", val: "today" }
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.val)}
              className="pill"
              disabled={submitting}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* General Error Messages */}
        {errors.auth || errors.submit ? (
          <div className="error-message mb-2 text-center">
            {errors.auth || errors.submit}
          </div>
        ) : null}

        {/* Action Button */}
        <button onClick={handleSave} className="primary-btn mt-2" disabled={submitting}>
          {submitting ? "Processing..." : (urgencyGoal ? "Update Goal" : "Create Goal")}
        </button>
      </div>
    </div>
  );
}
