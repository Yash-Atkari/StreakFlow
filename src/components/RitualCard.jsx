import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { isCompletedToday, isDateRequired } from "../utils/streak";
import { FiLock, FiTrash2, FiClock, FiEdit2, FiMenu, FiShield, FiAward, FiTarget, FiStar } from "react-icons/fi";
import NivoraIcon from "./NivoraIcon";
import { usePremium } from "../contexts/PremiumContext";
import { useDialog } from "../contexts/DialogContext";
import { playSuccessChime, playUndoSound, playTap, playShieldCharge } from "../utils/audio";
import { triggerParticleBurst } from "../utils/particles";

import { analytics } from "../services/mobile/analytics";
import { triggerInAppReview } from "../services/mobile/appReview";

export default function RitualCard({ 
  ritual, 
  refresh, 
  onEdit, 
  openModal, 
  onCelebrate,
  onOpenPremium
}) {
  const [expanded, setExpanded] = useState(false);
  const { isPremium, shieldsCount, useShieldPass, user } = usePremium();
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

  const completedDates = new Set(
    (ritual.habit_logs || []).map(log => {
      return new Date(log.completed_at).toDateString();
    })
  );

  const getHeatmapMonths = () => {
    const today = new Date();
    const monthsList = [];
    
    // Generate the last 12 months, ending with the current month.
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString(undefined, { month: "short" });
      
      const firstDay = new Date(year, month, 1);
      const firstDayOfWeek = firstDay.getDay(); // 0: Sunday, 6: Saturday
      const lastDay = new Date(year, month + 1, 0).getDate(); // Number of days in the month
      
      const numCols = Math.ceil((lastDay + firstDayOfWeek) / 7);
      const grid = [];
      for (let c = 0; c < numCols; c++) {
        grid.push(new Array(7).fill(null));
      }
      
      for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
        const date = new Date(year, month, dayNum);
        const dayOfWeek = date.getDay();
        const col = Math.floor((dayNum - 1 + firstDayOfWeek) / 7);
        grid[col][dayOfWeek] = date;
      }
      
      monthsList.push({
        label,
        grid
      });
    }
    
    return monthsList;
  };

  // Calculate the dynamic status
  const isDone = isCompletedToday(ritual.last_completed_date);
  
  const isWithinWindow = () => {
    if (!ritual.submit_window) return true;
    const now = new Date();
    const current = now.toTimeString().slice(0, 5); // "HH:MM"
    return current >= ritual.start_time && current <= ritual.end_time;
  };

  const isRequiredToday = isDateRequired(ritual, new Date());
  const canComplete = isWithinWindow() && isRequiredToday;

  const handleComplete = async (e) => {
    e.stopPropagation();
    if (!canComplete) return;

    if (isDone) {
      playUndoSound();
      const { error } = await supabase.rpc("undo_ritual_completion", {
        ritual_id_param: ritual.id
      });

      if (error) {
        await alert(error.message, "Error");
      } else {
        refresh();
      }
      return;
    }

    // Play chime and trigger particle explosion at mouse/touch click coordinates
    playSuccessChime();
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    triggerParticleBurst(x, y, themeColor);

    const { data, error } = await supabase.rpc("complete_ritual", {
      ritual_id_param: ritual.id
    });

    if (error) {
      await alert(error.message, "Error");
    } else {
      const newStreak = data.new_streak;
      if (newStreak > (ritual.current_streak || 0)) {
        // Track the streak milestone event
        analytics.logStreakMilestone(ritual.title, newStreak);
        
        if (onCelebrate) {
          onCelebrate(newStreak);
        }

        // Politely ask for rating on major milestones
        const milestones = [3, 7, 15, 30, 50];
        if (milestones.includes(newStreak)) {
          triggerInAppReview(true);
        }
      } else {
        // Standard completion review prompt check
        triggerInAppReview(false);
      }
      refresh();
    }
  };

  const handleUseShield = async (e) => {
    e.stopPropagation();
    
    if (!isPremium) {
      if (onOpenPremium) onOpenPremium();
      return;
    }
    
    if (shieldsCount <= 0) {
      await alert("You don't have any Streak Shields left! Go to Premium settings to recharge.", "No Shields");
      return;
    }
    
    const value = await confirm("Use 1 Streak Shield to recover this streak?", "Confirm Recovery");
    if (value) {
      playShieldCharge();
      const success = await useShieldPass(ritual.id);
      if (success) {
        await alert("Streak Shield Applied! Your streak has been successfully restored.", "Success");
        refresh();
      }
    }
  };

  const handleDelete = async () => {
    const value = await confirm("Are you sure you want to delete this ritual?", "Confirm Deletion");
    if (value) {
      await supabase.from("rituals").delete().eq("id", ritual.id);
      refresh();
    }
  };

  const getRecurrence = () => {
    return ritual.repeat_type === "custom" ? "custom" : ritual.repeat_type;
  };

  // Check if yesterday was a missed check-in
  const wasYesterdayMissed = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it was required yesterday
    const requiredYesterday = isDateRequired(ritual, yesterday);
    if (!requiredYesterday) return false;
    
    // Check if completed yesterday
    return !completedDates.has(yesterday.toDateString());
  };

  const showShieldBanner = wasYesterdayMissed();
  


  return (
    <div
      className="mb-3 ritual-card-premium"
      style={{
        background: "var(--theme-card-bg, rgba(22, 22, 26, 0.7))",
        borderRadius: "18px",
        opacity: isDone ? 0.75 : 1, 
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        border: "1px solid var(--theme-card-border, rgba(255, 255, 255, 0.06))",
        boxShadow: expanded ? "var(--theme-shadow)" : "none",
        transform: expanded ? "scale(1.01)" : "scale(1)"
      }}
    >
      <div
        className="d-flex justify-content-between align-items-center p-3"
        style={{ cursor: "pointer" }}
        onClick={() => { playTap(); setExpanded(!expanded); }}
      >
        {/* LEFT */}
        <div className="d-flex align-items-start gap-2">
          {/* Drag Handle Icon */}
          <div className="drag-handle" style={{ marginTop: "4px", paddingRight: "4px" }} onClick={(e) => e.stopPropagation()}>
            <FiMenu size={16} />
          </div>

          <div
            onClick={handleComplete}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: canComplete ? "2px solid var(--theme-primary, #ff6b00)" : "2px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canComplete ? "pointer" : "not-allowed",
              marginTop: "2px",
              background: isDone ? "var(--theme-primary, #ff6b00)" : "transparent"
            }}
          >
            {!canComplete ? (
              <FiLock size={12} color="#888" />
            ) : isDone ? ( 
              <NivoraIcon size={16} color="black" />
            ) : null}
          </div>

          <div>
            <div style={{ 
              fontSize: "15px", 
              textDecoration: isDone ? "line-through" : "none",
              color: isDone ? "#888" : "white" 
            }}>
              {ritual.title}
            </div>

            {ritual.description && (
              <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>
                {ritual.description}
              </div>
            )}

            <div className="d-flex align-items-center gap-2 mt-1 small text-secondary flex-wrap">
              <span className="d-flex align-items-center gap-1"> 
                 <NivoraIcon size={14} color={ritual.current_streak > 0 ? undefined : "#444"} /> 
                 {ritual.current_streak || 0} 
              </span>

              {ritual.submit_window && ritual.start_time && ritual.end_time && (
                <span className="d-flex align-items-center gap-1">
                  <FiClock size={12} />
                  {canComplete ? `${ritual.start_time} - ${ritual.end_time}` : "Closed"}
                </span>
              )}

              <span style={{
                  background: "#222",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  textTransform: "capitalize"
                }}
              >
                {getRecurrence()}
              </span>


            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="d-flex align-items-center gap-3">
          <FiEdit2
            size={18}
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(ritual);
              openModal();
            }}
            title="Edit"
          />
          <FiTrash2
            size={18}
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            title="Delete"
          />
        </div>
      </div>

      {/* Streak Broken Alert */}
      {expanded && showShieldBanner && (
        <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="shield-alert-banner">
            <div className="d-flex align-items-center gap-2">
              <FiShield size={20} color="var(--theme-primary)" />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="text-warning fw-bold" style={{ fontSize: "12px", lineHeight: "1.2" }}>Streak Saved?</span>
                <span className="text-secondary" style={{ fontSize: "11px", lineHeight: "1.3" }}>
                  Use 1 Streak Shield pass to log yesterday and repair your streak!
                </span>
              </div>
            </div>
            <button className="shield-alert-btn" onClick={handleUseShield}>
              Restore
            </button>
          </div>
        </div>
      )}

      {/* Heatmap expanded section */}
      {expanded && (
        <div 
          className="px-3 pb-3 border-top border-secondary"
          style={{ borderColor: "#222 !important", paddingTop: "15px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="subheading mb-2">
            Completion History (Last 365 Days)
          </div>
          <div className="heatmap-container d-flex gap-3 pb-2" style={{ overflowX: "auto" }}>
            {getHeatmapMonths().map((m, mIdx) => (
              <div key={mIdx} className="d-flex flex-column align-items-center">
                <div className="d-flex gap-1">
                  {m.grid.map((col, colIdx) => (
                    <div key={colIdx} className="d-flex flex-column gap-1">
                      {col.map((day, rowIdx) => {
                        if (!day) {
                          return (
                            <div 
                              key={rowIdx} 
                              style={{ width: "10px", height: "10px" }} 
                            />
                          );
                        }
                        const dateStr = day.toDateString();
                        const wasCompleted = completedDates.has(dateStr);
                        const isToday = dateStr === new Date().toDateString();
                        
                        let cellColor = "#222222"; 
                        if (wasCompleted) {
                          cellColor = "var(--theme-primary, #ff6b00)";
                        } else if (isToday) {
                          cellColor = "#333333"; 
                        }
                        
                        return (
                          <div
                            key={rowIdx}
                            title={`${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}: ${wasCompleted ? 'Completed' : 'Uncompleted'}`}
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "2px",
                              background: cellColor,
                              border: isToday && !wasCompleted ? "1px solid #444" : "none"
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: "10px", color: "#666", marginTop: "6px" }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* Milestones & Rewards Quest */}
          <div className="border-top border-secondary pt-3 mt-3" style={{ borderColor: "#222 !important" }}>
            <div className="row g-3">
              {/* Trophies Column */}
              <div className="col-12 col-md-6">
                <div className="subheading mb-2">
                  Streak Milestone Trophies
                </div>
                <div className="d-flex justify-content-between align-items-center bg-dark p-3 rounded-4" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)", minHeight: "78px" }}>
                  {[
                    { days: 3, icon: <FiAward size={22} color="#cd7f32" />, label: "Bronze" },
                    { days: 7, icon: <FiAward size={22} color="#c0c0c0" />, label: "Silver" },
                    { days: 15, icon: <FiAward size={22} color="#ffd700" />, label: "Gold" },
                    { days: 30, icon: <FiStar size={22} color="#b9f2ff" />, label: "Diamond" },
                    { days: 50, icon: <FiAward size={22} color="var(--theme-primary)" />, label: "Crown" }
                  ].map((trophy, index) => {
                    const isUnlocked = (ritual.current_streak || 0) >= trophy.days;
                    return (
                      <div 
                        key={index} 
                        className="d-flex flex-column align-items-center gap-1"
                        style={{ opacity: isUnlocked ? 1 : 0.25, transition: "opacity 0.3s ease" }}
                        title={`${trophy.label} Trophy (${trophy.days} days) - ${isUnlocked ? 'Unlocked' : 'Locked'}`}
                      >
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {trophy.icon}
                        </span>
                        <span style={{ fontSize: "9px", color: isUnlocked ? "var(--theme-primary, #ff6b00)" : "rgba(255,255,255,0.35)", fontWeight: "bold" }}>
                          {trophy.days}D
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Commitment Column */}
              <div className="col-12 col-md-6">
                <div className="subheading mb-2">
                  Commitment
                </div>
                {ritual.reward_title ? (
                  (() => {
                    const current = ritual.current_streak || 0;
                    const target = ritual.reward_target_streak || 1;
                    const isComplete = current >= target;
                    const progressPercent = Math.min(100, Math.round((current / target) * 100));
                    
                    return (
                      <div 
                        className="bg-dark p-3 rounded-4 d-flex flex-column justify-content-center" 
                        style={{ 
                          background: isComplete ? "rgba(16, 185, 129, 0.04)" : "rgba(255,255,255,0.01)", 
                          border: isComplete ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(255,255,255,0.03)",
                          minHeight: "78px"
                        }}
                      >
                        {isComplete ? (
                          <div className="text-center py-1">
                            <FiTarget size={20} color="var(--theme-primary)" className="mb-1" />
                            <div className="text-success fw-bold" style={{ fontSize: "12px" }}>
                              Commitment Complete! Solidified:
                            </div>
                            <div className="text-white fw-bold mt-1" style={{ fontSize: "13px" }}>
                              "{ritual.reward_title}"
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: "11px" }}>
                              <span className="text-secondary fw-bold d-inline-flex align-items-center gap-1">
                                <FiTarget size={12} color="var(--theme-primary)" /> {ritual.reward_title}
                              </span>
                              <span style={{ color: "var(--theme-primary, #ff6b00)", fontWeight: "bold" }}>
                                {current}/{target} Days
                              </span>
                            </div>
                            <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                              <div 
                                style={{ 
                                  height: "100%", 
                                  width: `${progressPercent}%`, 
                                  background: "var(--theme-primary, #ff6b00)",
                                  borderRadius: "3px"
                                }}
                              />
                            </div>
                            <div style={{ color: "#a1a1aa", fontSize: "9px", marginTop: "6px", lineHeight: "1.2" }}>
                              Reach a {target}-day streak to lock in this commitment.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div 
                    className="d-flex justify-content-between align-items-center bg-dark p-3 rounded-4" 
                    style={{ 
                      background: "rgba(255,255,255,0.01)", 
                      border: "1px solid rgba(255,255,255,0.03)",
                      minHeight: "78px"
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.45)" }}>
                      No active commitment defined.
                    </span>
                    <button 
                      className="primary-btn" 
                      style={{ 
                        width: "auto",
                        padding: "6px 16px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        marginTop: 0
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(ritual);
                        openModal();
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}