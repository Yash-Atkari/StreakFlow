import { useState, useEffect } from "react";
import { FiCpu } from "react-icons/fi";
import "../styles/premium.css";

export default function AIMicroCoach({ rituals, user }) {
  const [nudge, setNudge] = useState("");
  const [tipsPool, setTipsPool] = useState([]);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const pool = [];

    if (rituals.length === 0) {
      pool.push("Your flow is empty! Create your first ritual to start building daily momentum.");
      pool.push("Consistency starts with a single step. Add a simple habit like 'Drink Water' or 'Breathe'.");
    } else {
      // 1. Rule: Missed 3 days (burnout warning)
      const missed3DaysHabit = rituals.find(r => {
        if (!r.last_completed_date) return false;
        const diffTime = Math.abs(new Date() - new Date(r.last_completed_date));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return r.current_streak === 0 && diffDays >= 3;
      });
      if (missed3DaysHabit) {
        pool.push(`Reduce today's goal for '${missed3DaysHabit.title}' to 5 minutes. Consistency is about showing up.`);
      }

      // 2. Rule: 7-day streak (momentum builder)
      const streak7Habit = rituals.find(r => (r.current_streak || 0) >= 7);
      if (streak7Habit) {
        pool.push(`You're building serious momentum on '${streak7Habit.title}'. Don't break it today!`);
      }

      // 3. Rule: Check-ins after 9 PM
      const lateHabit = rituals.find(r => {
        const logs = r.habit_logs || [];
        if (logs.length === 0) return false;
        
        // Count logs completed after 9 PM (21:00)
        const lateLogsCount = logs.filter(log => {
          const hours = new Date(log.completed_at).getHours();
          return hours >= 21;
        }).length;
        
        return lateLogsCount / logs.length >= 0.4; // 40% or more late checkins
      });
      if (lateHabit) {
        pool.push(`You usually check in for '${lateHabit.title}' after 9 PM. Try completing this habit before dinner.`);
      }

      // 4. Fallback Rule: Habit overload
      if (rituals.length >= 5) {
        pool.push("You're managing 5+ habits today. Focus on just the top 2 priorities to protect your mental bandwidth.");
      }

      // general rules
      pool.push("Consistency beats intensity. 5 minutes of meditation daily beats 1 hour once a week.");
      pool.push("Habits become identity. Every check-in is a vote for the person you want to become.");
    }

    setTipsPool(pool);
    setNudge(pool[0] || "Your AI Micro-Coach is ready. Complete your habits to unlock tailored nudges!");
    setTipIndex(0);
  }, [rituals, user]);

  const handleNextTip = () => {
    if (tipsPool.length <= 1) return;
    const nextIdx = (tipIndex + 1) % tipsPool.length;
    setTipIndex(nextIdx);
    setNudge(tipsPool[nextIdx]);
  };

  return (
    <div className="coach-card mb-4">
      <div className="d-flex align-items-center gap-3">
        <div className="coach-avatar">
          <FiCpu size={22} color="var(--theme-primary, #ff6b00)" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--theme-primary, #ff6b00)", letterSpacing: "1px" }}>
              AI MICRO-COACH
            </span>
            {tipsPool.length > 1 && (
              <span 
                onClick={handleNextTip} 
                style={{ fontSize: "10px", color: "#888", cursor: "pointer", textDecoration: "underline" }}
              >
                Next advice
              </span>
            )}
          </div>
          <p className="mb-0 text-white" style={{ fontSize: "13px", lineHeight: "1.4" }}>
            "{nudge}"
          </p>
        </div>
      </div>
    </div>
  );
}
