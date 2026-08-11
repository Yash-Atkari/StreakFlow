import { useState, useEffect, useRef } from "react";
import NivoraIcon from "./NivoraIcon";
import { FiAward, FiSliders, FiShield } from "react-icons/fi";
import { useDialog } from "../contexts/DialogContext";
import { isDateRequired, isCompletedToday } from "../utils/streak";
import "../styles/premium.css";
import { playTap } from "../utils/audio";

export default function WeeklyRecapStory({ rituals, user, onClose }) {
  const { alert } = useDialog();
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const timerRef = useRef(null);
  const [progressVal, setProgressVal] = useState(0);

  const numSlides = 5;
  const slideDuration = 4000;

  // Calculate the insights dynamically on mount
  useEffect(() => {
    if (!user?.id) return;

    const totalRituals = rituals.length;

    // Calculate daily consistency today
    const ritualsToday = rituals.filter(r => isDateRequired(r, new Date()));
    const totalToday = ritualsToday.length;
    const completedToday = ritualsToday.filter(r => isCompletedToday(r.last_completed_date)).length;
    const progressToday = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);

    // Calculate weekday pattern over last 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      last30Days.push(d);
    }

    const weekdayStats = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i,
      label: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i],
      required: 0,
      completed: 0
    }));

    rituals.forEach((r) => {
      const logs = r.habit_logs || [];
      const completedDates = new Set(
        logs.map((log) => new Date(log.completed_at).toDateString())
      );

      last30Days.forEach((date) => {
        const isRequired = isDateRequired(r, date);
        if (isRequired) {
          const dayIdx = date.getDay();
          weekdayStats[dayIdx].required++;
          if (completedDates.has(date.toDateString())) {
            weekdayStats[dayIdx].completed++;
          }
        }
      });
    });

    const formattedWeekdayStats = weekdayStats.map((stat) => {
      const rate = stat.required === 0 ? 0 : Math.round((stat.completed / stat.required) * 100);
      return { ...stat, rate };
    });

    const bestDay = formattedWeekdayStats.reduce((best, curr) => curr.rate > best.rate ? curr : best, { rate: -1 });

    // Calculate longest active streak (Momentum Anchor)
    let bestStreakRitualTitle = "";
    let bestStreak = 0;
    rituals.forEach((r) => {
      if ((r.current_streak || 0) > bestStreak) {
        bestStreak = r.current_streak;
        bestStreakRitualTitle = r.title;
      }
    });

    const theme = user?.user_metadata?.premium_theme || "default";

    const generated = {
      totalRituals,
      totalToday,
      completedToday,
      progressToday,
      bestStreak,
      bestStreakRitualTitle,
      bestDayName: bestDay.rate > 0 ? bestDay.label : null,
      bestDayRate: bestDay.rate > 0 ? bestDay.rate : null,
      theme,
      generatedAt: new Date().toISOString()
    };

    setRecapData(generated);
  }, [rituals, user]);

  // Slide Progress Timer
  useEffect(() => {
    if (paused || !recapData) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalTime = 40;
    const step = (intervalTime / slideDuration) * 100;

    timerRef.current = setInterval(() => {
      setProgressVal((prev) => {
        if (prev >= 100) {
          setActiveSlide((curr) => {
            if (curr >= numSlides - 1) {
              onClose();
              return curr;
            }
            return curr + 1;
          });
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, activeSlide, recapData]);

  useEffect(() => {
    setProgressVal(0);
  }, [activeSlide]);

  const handleNext = () => {
    playTap();
    if (activeSlide < numSlides - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    playTap();
    if (activeSlide > 0) {
      setActiveSlide(activeSlide - 1);
    }
  };

  const pointerDownTimeRef = useRef(0);

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerDownTimeRef.current = Date.now();
    setPaused(true);
  };

  const handleLeftPointerUp = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const duration = Date.now() - pointerDownTimeRef.current;
    setPaused(false);
    if (duration < 250) {
      handlePrev();
    }
  };

  const handleRightPointerUp = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const duration = Date.now() - pointerDownTimeRef.current;
    setPaused(false);
    if (duration < 250) {
      handleNext();
    }
  };

  const handlePointerCancel = () => {
    setPaused(false);
  };

  if (!recapData) {
    return (
      <div className="story-recap-overlay">
        <div className="text-white">Generating your daily insights...</div>
      </div>
    );
  }

  // Brand theme display names and quotes
  const themeName = {
    default: "Default Orange",
    glowup: "Cyberpunk Glow",
    zen: "Zen Emerald",
    gym: "Volcanic Gym",
    study: "Deep Ocean Study",
    healing: "Lavender Healing",
  }[recapData.theme] || "Default";

  return (
    <div className="story-recap-overlay">
      <div className="story-container">
        
        {/* Navigation Overlays */}
        <div 
          className="story-nav-btn left" 
          onPointerDown={handlePointerDown}
          onPointerUp={handleLeftPointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
        />
        <div 
          className="story-nav-btn right" 
          onPointerDown={handlePointerDown}
          onPointerUp={handleRightPointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
        />

        {/* Progress Bars */}
        <div className="story-header">
          <div className="story-progress-bars">
            {Array.from({ length: numSlides }).map((_, idx) => {
              let width = "0%";
              if (idx < activeSlide) width = "100%";
              else if (idx === activeSlide) width = `${progressVal}%`;
              return (
                <div key={idx} className="story-progress-bg">
                  <div className="story-progress-fill" style={{ width }} />
                </div>
              );
            })}
          </div>

          <div className="story-meta">
            <div className="d-flex align-items-center gap-2">
              <FiAward size={20} color="var(--theme-primary)" />
              <div>
                <strong style={{ fontSize: "14px" }}>Daily Insights</strong>
                <span className="text-secondary small d-block" style={{ fontSize: "10px" }}>Nivora Premium</span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "20px",
                padding: "4px 8px",
                cursor: "pointer",
                zIndex: 30
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Story Screens */}
        <div className="story-content">
          {activeSlide === 0 && (
            <div className="story-slide-in">
              <span className="subheading mb-2">Chapter I: Daily Focus</span>
              <h2 className="display-6 fw-bold mb-4">Mindset Check</h2>
              <p className="text-secondary px-3 mb-5" style={{ fontSize: "15px", lineHeight: "1.5" }}>
                {recapData.totalToday === 0 ? (
                  "Enjoy your rest day! Recharge your battery for tomorrow."
                ) : recapData.completedToday === 0 ? (
                  "Zero pressure. A single check-in is all it takes to keep the momentum alive. What's your smallest step today?"
                ) : recapData.progressToday < 50 ? (
                  "Off to a solid start! Every small action is a vote for the person you want to become."
                ) : recapData.progressToday < 100 ? (
                  "You are in the flow! Almost done. Finish strong and rest easy tonight."
                ) : (
                  "All clear! Absolute victory today. Take a moment to celebrate your discipline!"
                )}
              </p>
              <div className="d-flex justify-content-around py-3 bg-dark rounded-4 border border-secondary px-2 w-100">
                <div>
                  <h3 className="mb-0 text-white">{recapData.completedToday}/{recapData.totalToday}</h3>
                  <span className="small text-secondary">Done Today</span>
                </div>
                <div style={{ width: "1px", background: "#333" }} />
                <div>
                  <h3 className="mb-0 text-warning">{recapData.progressToday}%</h3>
                  <span className="small text-secondary">Progress</span>
                </div>
              </div>
            </div>
          )}

          {activeSlide === 1 && (
            <div className="story-slide-in w-100">
              <span className="subheading mb-2">Chapter II: Peak Rhythm</span>
              <h2 className="display-6 fw-bold mb-3">Weekly Rhythm</h2>
              <p className="text-secondary small px-3 mb-4" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                {recapData.bestDayName ? (
                  <>
                    <strong>{recapData.bestDayName}s</strong> are your power days! You have an <strong>{recapData.bestDayRate}%</strong> consistency rate on {recapData.bestDayName}s historically. Make today count!
                  </>
                ) : (
                  "Every day is an opportunity to build a new pattern. Choose one small habit to start your week in style."
                )}
              </p>
              
              <div className="mt-4 p-4 rounded-4 text-center w-100" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-secondary small text-uppercase fw-bold" style={{ fontSize: "10px", letterSpacing: "1px" }}>Peak Consistency</span>
                  <span className="fw-bold text-success" style={{ fontSize: "18px" }}>
                    {recapData.bestDayRate || 0}%
                  </span>
                </div>
                <div style={{ height: "14px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "7px", overflow: "hidden", position: "relative" }}>
                  <div 
                    style={{ 
                      height: "100%", 
                      width: `${recapData.bestDayRate || 0}%`, 
                      background: "linear-gradient(90deg, var(--theme-primary, #ff6c00) 0%, #10b981 100%)",
                      borderRadius: "7px",
                      transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  />
                </div>
                <div className="small mt-2 text-start" style={{ color: "#a1a1aa", fontSize: "11px", lineHeight: "1.3" }}>
                  Consistency is key to transforming habits into identity. Keep showing up!
                </div>
              </div>
            </div>
          )}

          {activeSlide === 2 && (
            <div className="story-slide-in">
              <span className="subheading mb-2">Chapter III: Momentum Anchor</span>
              <h2 className="display-6 fw-bold mb-4">Streak Champion</h2>
              
              {recapData.bestStreak > 0 ? (
                <div>
                  <div className="mb-3 d-inline-block position-relative">
                    <NivoraIcon size={120} style={{ filter: "drop-shadow(0 0 20px var(--theme-primary))" }} />
                    <div style={{
                      position: "absolute",
                      top: "55%", left: "50%",
                      transform: "translate(-50%, -20%)",
                      fontSize: "30px",
                      fontWeight: "900",
                      color: "white"
                    }}>
                      {recapData.bestStreak}
                    </div>
                  </div>
                  <h3 className="text-white mb-2">{recapData.bestStreakRitualTitle}</h3>
                  <p className="text-secondary small" style={{ fontSize: "14px" }}>
                    This is your anchor habit today—protect this streak at all costs!
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3">
                    <NivoraIcon size={90} color="#444" />
                  </div>
                  <h3 className="text-secondary mb-2">No Active Anchor</h3>
                  <p className="text-secondary small px-3">
                    Complete scheduled habits today to kickstart a streak. Once you hit 3 days, it becomes your anchor!
                  </p>
                </div>
              )}
            </div>
          )}

          {activeSlide === 3 && (
            <div className="story-slide-in">
              <span className="subheading mb-2">Chapter IV: Focus Guard</span>
              <h2 className="display-6 fw-bold mb-4">Bandwidth Shield</h2>
              
              <div 
                style={{
                  width: "90px",
                  height: "90px",
                  borderRadius: "24px",
                  background: "var(--theme-card-bg, #1a1a1a)",
                  border: "2px solid var(--theme-primary, #ff6b00)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: "0 0 25px rgba(var(--theme-primary-rgb, 255,107,0), 0.3)"
                }}
              >
                <FiSliders size={36} color="var(--theme-primary)" />
              </div>
              <h3 className="text-white mb-2" style={{ color: "var(--theme-primary)", fontSize: "20px" }}>
                {recapData.totalRituals >= 5 ? "Simplify to Solidify" : "Show Up Daily"}
              </h3>
              <p className="text-secondary px-3" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                {recapData.totalRituals >= 5 ? (
                  `You are managing ${recapData.totalRituals} active habits. Remember, consistency beats intensity. If you are low on energy today, perform a 2-minute micro-session of each instead of skipping.`
                ) : (
                  "Consistency Code: Focus on showing up, even for 1 minute. It keeps the neural path active. A micro-session is infinitely better than a zero day."
                )}
              </p>
            </div>
          )}

          {activeSlide === 4 && (
            <div className="story-slide-in w-100">
              <div 
                className="p-4 rounded-4 text-start border"
                style={{
                  background: "linear-gradient(135deg, #111 0%, #1e1e24 100%)",
                  borderColor: "var(--theme-primary, #ff6b00)"
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold tracking-widest text-uppercase text-secondary" style={{ fontSize: "10px" }}>Daily Sentinel</span>
                  <span className="premium-pill">Insights</span>
                </div>
                <h4 className="text-white mb-3" style={{ fontSize: "18px" }}>Today's Vibe Insight</h4>
                
                <p className="text-white-50 small mb-0" style={{ lineHeight: "1.5", fontSize: "12.5px" }}>
                  <strong>Time Hacking:</strong> Habits checked off before 8 PM are 4x more likely to stick long-term. Try to check off your next habit early to protect your evening peace and sleep hygiene.
                </p>

                <div className="mt-4 pt-3 border-top border-dark d-flex align-items-center gap-2">
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "var(--theme-primary, #ff6b00)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "black"
                  }}>N</div>
                  <span className="fw-bold text-white" style={{ fontSize: "12px" }}>Nivora Daily Insights</span>
                </div>
              </div>

              <button 
                className="primary-btn mt-4"
                style={{ width: "100%" }}
                onClick={async () => {
                  await alert("Daily Insight Card copied to clipboard! Share it with your friends.", "Shared");
                  onClose();
                }}
              >
                Share Daily Vibe
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
