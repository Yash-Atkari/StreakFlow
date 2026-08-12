import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { useDialog } from "../contexts/DialogContext";
import { playTap } from "../utils/audio";
import { FiInbox } from "react-icons/fi";
import "../styles/modal.css";

export default function SuggestionModal({ close, user }) {
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const { alert } = useDialog();

  const [form, setForm] = useState({
    title: "",
    improvement: "",
    howItHelps: "",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      close();
    }, 250);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.title.trim()) {
      newErrors.title = "Please provide a brief title for your suggestion.";
    }
    if (!form.improvement.trim()) {
      newErrors.improvement = "Please describe the improvement or feature you'd like to see.";
    }
    if (!form.howItHelps.trim()) {
      newErrors.howItHelps = "Please tell us how this will help you flow better.";
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
    try {
      const { error } = await supabase.from("suggestions").insert([
        {
          user_id: user?.id,
          title: form.title.trim(),
          improvement: form.improvement.trim(),
          how_it_helps: form.howItHelps.trim(),
        },
      ]);

      if (error) throw error;

      playTap();
      await alert("Your suggestion has been submitted successfully. Thank you for helping us improve Nivora!", "Success");
      handleClose();
    } catch (err) {
      console.error("Failed to submit suggestion:", err);
      setErrors({ submit: err.message || "Failed to submit suggestion. Please try again." });
    } finally {
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
          <h5 style={{ fontWeight: "800", color: "var(--theme-primary, #ff6b00)", display: "flex", alignItems: "center", gap: "8px" }}>
            <FiInbox size={20} /> Suggestion Box
          </h5>
          <span style={{ cursor: "pointer", fontSize: "18px" }} onClick={handleClose}>✕</span>
        </div>

        <p className="text-secondary small mb-4" style={{ fontSize: "12px", lineHeight: "1.4" }}>
          Have an idea to make Nivora better? Let us know what you want to build or improve, and how it would improve your workflow!
        </p>

        {/* Title */}
        <div className="label">SUGGESTION TITLE</div>
        <input
          className={`input ${errors.title ? "input-error" : ""}`}
          placeholder="e.g., Customizable sounds / widget support"
          value={form.title}
          onChange={(e) => {
            setForm({ ...form, title: e.target.value });
            if (errors.title) setErrors({ ...errors, title: null });
          }}
          disabled={submitting}
        />
        {errors.title && <div className="error-message">{errors.title}</div>}

        {/* Improvement */}
        <div className="label mt-3">WHAT IS THE IMPROVEMENT?</div>
        <textarea
          className={`input ${errors.improvement ? "input-error" : ""}`}
          style={{ height: "90px", resize: "none", padding: "10px" }}
          placeholder="Describe the feature or change in detail..."
          value={form.improvement}
          onChange={(e) => {
            setForm({ ...form, improvement: e.target.value });
            if (errors.improvement) setErrors({ ...errors, improvement: null });
          }}
          disabled={submitting}
        />
        {errors.improvement && <div className="error-message">{errors.improvement}</div>}

        {/* How it helps */}
        <div className="label mt-3">HOW WILL IT HELP YOU?</div>
        <textarea
          className={`input ${errors.howItHelps ? "input-error" : ""}`}
          style={{ height: "80px", resize: "none", padding: "10px" }}
          placeholder="How does this make tracking or momentum easier for you?"
          value={form.howItHelps}
          onChange={(e) => {
            setForm({ ...form, howItHelps: e.target.value });
            if (errors.howItHelps) setErrors({ ...errors, howItHelps: null });
          }}
          disabled={submitting}
        />
        {errors.howItHelps && <div className="error-message">{errors.howItHelps}</div>}

        {errors.submit && <div className="error-message mt-2">{errors.submit}</div>}

        {/* Action Buttons */}
        <div className="d-flex gap-2 mt-4">
          <button
            onClick={handleClose}
            className="pill w-50"
            style={{ background: "#222", color: "#aaa", border: "1px solid #333" }}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="pill active w-50"
            style={{
              background: "linear-gradient(135deg, var(--theme-primary, #ff6b00) 0%, #ff8533 100%)",
              color: "black",
              fontWeight: "bold",
              border: "none"
            }}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Send Idea"}
          </button>
        </div>
      </div>
    </div>
  );
}
