import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { FiClock, FiEdit2, FiTrash2, FiAlertCircle } from "react-icons/fi";
import { usePremium } from "../contexts/PremiumContext";
import { useDialog } from "../contexts/DialogContext";
import { playSuccessChime, playUndoSound, playTap } from "../utils/audio";
import { triggerParticleBurst } from "../utils/particles";
import NivoraIcon from "./NivoraIcon";

export default function UrgencyCard({ 
  goal, 
  refresh, 
  onEdit, 
  openModal 
}) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(new Date());
  const { user } = usePremium();
  const { alert, confirm } = useDialog();

  const activeTheme = user?.user_metadata?.premium_theme || "default";
  const themeColors = {
    default: "#ff6c00",
    glowup: "#ec4899",
    zen: "#10b981",
    gym: "#f59e0b",
    study: "#3b82f6",
    healing: "#8b5cf6"
  };
  const themeColor = themeColors[activeTheme] || "#ff6c00";

  // Start ticking interval if not completed
  useEffect(() => {
    if (goal.completed) return;
    
    // Set immediate initial time
    setNow(new Date());
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [goal.completed]);

  const startDate = new Date(goal.start_time);
  const endDate = new Date(goal.end_time);

  // Determine status
  let status = "active"; // upcoming, active, urgent, overdue, completed
  if (goal.completed) {
    status = "completed";
  } else if (now < startDate) {
    status = "upcoming";
  } else if (now > endDate) {
    status = "overdue";
  } else {
    // Check if urgent (less than 30 minutes left)
    const timeRemaining = endDate.getTime() - now.getTime();
    if (timeRemaining < 30 * 60 * 1000) {
      status = "urgent";
    }
  }

  // Calculate elapsed time percentage
  const calculateProgress = () => {
    if (status === "completed") return 100;
    if (status === "upcoming") return 0;
    if (status === "overdue") return 100;
    
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const progressPercent = calculateProgress();

  // Helper to format countdown text
  const getCountdownText = () => {
    if (status === "completed") {
      if (goal.completed_at) {
        const completedTime = new Date(goal.completed_at);
        return `Completed at ${completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return "Completed";
    }

    let diffMs = 0;
    let prefix = "";
    if (status === "upcoming") {
      diffMs = startDate.getTime() - now.getTime();
      prefix = "Starts in ";
    } else if (status === "overdue") {
      diffMs = now.getTime() - endDate.getTime();
      prefix = "Overdue by ";
    } else {
      diffMs = endDate.getTime() - now.getTime();
      prefix = "Ends in ";
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const secs = diffSecs % 60;
    const diffMins = Math.floor(diffSecs / 60);
    const mins = diffMins % 60;
    const diffHours = Math.floor(diffMins / 60);
    const hours = diffHours % 24;
    const days = Math.floor(diffHours / 24);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    // Only show seconds if there are no days and less than 3 hours left
    if (days === 0 && diffHours < 3) {
      parts.push(`${secs}s`);
    }

    return prefix + parts.join(" ");
  };

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    playTap();

    const newCompletedState = !goal.completed;
    const payload = {
      completed: newCompletedState,
      completed_at: newCompletedState ? new Date().toISOString() : null,
    };

    if (newCompletedState) {
      playSuccessChime();
      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || window.innerHeight / 2;
      triggerParticleBurst(x, y, themeColor);
    } else {
      playUndoSound();
    }

    let saveError = null;

    // Supabase update
    try {
      const { error } = await supabase
        .from("urgency_goals")
        .update(payload)
        .eq("id", goal.id);
      saveError = error;
    } catch (err) {
      saveError = err;
    }

    // Local Storage update fallback
    if (saveError) {
      console.warn("Database update failed, falling back to local storage...", saveError);
      const localGoalsStr = localStorage.getItem(`nivora_local_urgency_${user.id}`) || "[]";
      let localGoals = [];
      try {
        localGoals = JSON.parse(localGoalsStr);
      } catch (e) {
        localGoals = [];
      }
      localGoals = localGoals.map(g => g.id === goal.id ? { ...g, ...payload } : g);
      localStorage.setItem(`nivora_local_urgency_${user.id}`, JSON.stringify(localGoals));
    }

    refresh();
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    const confirmDelete = await confirm("Are you sure you want to delete this goal?", "Confirm Deletion");
    if (!confirmDelete) return;

    playTap();
    let saveError = null;

    try {
      const { error } = await supabase
        .from("urgency_goals")
        .delete()
        .eq("id", goal.id);
      saveError = error;
    } catch (err) {
      saveError = err;
    }

    if (saveError) {
      console.warn("Database delete failed, falling back to local storage...", saveError);
      const localGoalsStr = localStorage.getItem(`nivora_local_urgency_${user.id}`) || "[]";
      let localGoals = [];
      try {
        localGoals = JSON.parse(localGoalsStr);
      } catch (e) {
        localGoals = [];
      }
      localGoals = localGoals.filter(g => g.id !== goal.id);
      localStorage.setItem(`nivora_local_urgency_${user.id}`, JSON.stringify(localGoals));
    }

    refresh();
  };

  // Define colors based on urgency status
  const getStatusColor = () => {
    if (status === "completed") return themeColor; // platform theme color
    if (status === "upcoming") return "#3b82f6"; // blue
    if (status === "overdue") return "#ef4444"; // red
    if (status === "urgent") return "#ff5555"; // light red
    return themeColor; // theme primary (orange/pink/etc.)
  };

  const statusColor = getStatusColor();

  return (
    <div
      className="mb-3 ritual-card-premium"
      style={{
        background: "var(--theme-card-bg, rgba(22, 22, 26, 0.7))",
        borderRadius: "18px",
        opacity: status === "completed" ? 0.75 : 1,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        border: `1px solid ${status === "urgent" ? "rgba(239, 68, 68, 0.3)" : "var(--theme-card-border, rgba(255, 255, 255, 0.06))"}`,
        boxShadow: expanded ? "var(--theme-shadow)" : "none",
        transform: expanded ? "scale(1.01)" : "scale(1)"
      }}
    >
      <div
        className="d-flex justify-content-between align-items-center p-3"
        style={{ cursor: "pointer" }}
        onClick={() => { playTap(); setExpanded(!expanded); }}
      >
        {/* Left Section */}
        <div className="d-flex align-items-start gap-2 flex-grow-1" style={{ overflow: "hidden" }}>
          {/* Custom Checkbox */}
          <div
            onClick={handleToggleComplete}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: `2px solid ${statusColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              marginTop: "2px",
              background: status === "completed" ? statusColor : "transparent",
              transition: "all 0.2s ease",
              flexShrink: 0
            }}
          >
            {status === "completed" && <NivoraIcon size={16} color="black" />}
          </div>

          <div style={{ minWidth: 0, flexGrow: 1, paddingRight: "10px" }}>
            {/* Title */}
            <div style={{
              fontSize: "15px",
              fontWeight: "700",
              textDecoration: status === "completed" ? "line-through" : "none",
              color: status === "completed" ? "#888" : "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {goal.title}
            </div>

            {/* Sub-details row */}
            <div className="d-flex align-items-center gap-2 mt-1 small text-secondary flex-wrap">
              {/* Countdown timer */}
              <span className={`d-flex align-items-center gap-1 ${status === "urgent" ? "text-danger fw-bold animate-pulse" : ""}`} style={{ fontSize: "11px" }}>
                {status !== "completed" && <FiClock size={12} />}
                {getCountdownText()}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section / Controls */}
        <div className="d-flex align-items-center gap-3">
          <FiEdit2
            size={18}
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              playTap();
              onEdit(goal);
              openModal();
            }}
            title="Edit"
          />
          <FiTrash2
            size={18}
            className="icon-btn"
            onClick={handleDelete}
            title="Delete"
          />
        </div>
      </div>



      {/* Expanded Description / Details */}
      {expanded && (
        <div
          className="px-3 pb-3 border-top border-secondary"
          style={{ borderColor: "#222 !important", paddingTop: "15px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {goal.description ? (
            <div className="mb-3">
              <div className="subheading mb-1">Description</div>
              <p className="text-secondary small mb-0" style={{ whiteSpace: "pre-wrap", userSelect: "text", WebkitUserSelect: "text" }}>
                {goal.description}
              </p>
            </div>
          ) : (
            <div className="mb-2 text-secondary small italic">No description provided.</div>
          )}

          <div className="row g-2 text-secondary" style={{ fontSize: "11px" }}>
            <div className="col-6">
              <div className="fw-bold text-white mb-0.5">Start</div>
              {startDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="col-6">
              <div className="fw-bold text-white mb-0.5">End</div>
              {endDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
