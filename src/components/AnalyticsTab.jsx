import { useState, useEffect } from "react";
import { isDateRequired } from "../utils/streak";
import { FiAward, FiTrendingUp, FiCalendar, FiActivity } from "react-icons/fi";
import { HiFire } from "react-icons/hi";

export default function AnalyticsTab({ rituals, user }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [stats, setStats] = useState({
    consistencyScore: 0,
    trendData: [],
    weekdayStats: [],
    leaderboard: []
  });

  useEffect(() => {
    if (!rituals || rituals.length === 0) return;

    // 1. Calculate overall consistency
    let totalRequired = 0;
    let totalCompleted = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      last30Days.push(d);
    }

    rituals.forEach((r) => {
      const logs = r.habit_logs || [];
      const completedDates = new Set(
        logs.map((log) => new Date(log.completed_at).toDateString())
      );

      last30Days.forEach((date) => {
        const isRequired = isDateRequired(r, date);
        if (isRequired) {
          totalRequired++;
          if (completedDates.has(date.toDateString())) {
            totalCompleted++;
          }
        }
      });
    });

    const consistencyScore = totalRequired === 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100);

    // 2. 7-Day Trend Chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      last7Days.push(d);
    }

    const trendData = last7Days.map((date) => {
      const label = date.toLocaleDateString(undefined, { weekday: "short" });
      let completedCount = 0;
      let requiredCount = 0;

      rituals.forEach((r) => {
        const logs = r.habit_logs || [];
        const completedDates = new Set(
          logs.map((log) => new Date(log.completed_at).toDateString())
        );
        if (isDateRequired(r, date)) {
          requiredCount++;
          if (completedDates.has(date.toDateString())) {
            completedCount++;
          }
        }
      });

      return {
        label,
        dateStr: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        completed: completedCount,
        required: requiredCount
      };
    });

    // 3. Weekday breakdown (historic completion rates for Mon, Tue, etc.)
    const weekdayStats = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
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
      return {
        ...stat,
        rate
      };
    });

    const orderedWeekdayStats = [
      formattedWeekdayStats[1], // Mon
      formattedWeekdayStats[2], // Tue
      formattedWeekdayStats[3], // Wed
      formattedWeekdayStats[4], // Thu
      formattedWeekdayStats[5], // Fri
      formattedWeekdayStats[6], // Sat
      formattedWeekdayStats[0]  // Sun
    ];

    // 4. Leaderboard
    const leaderboard = rituals.map((r) => {
      const logs = r.habit_logs || [];
      const completedDates = new Set(
        logs.map((log) => new Date(log.completed_at).toDateString())
      );

      let rRequired = 0;
      let rCompleted = 0;
      last30Days.forEach((date) => {
        if (isDateRequired(r, date)) {
          rRequired++;
          if (completedDates.has(date.toDateString())) {
            rCompleted++;
          }
        }
      });

      const rate = rRequired === 0 ? 0 : Math.round((rCompleted / rRequired) * 100);
      return {
        id: r.id,
        title: r.title,
        rate,
        streak: r.current_streak || 0
      };
    }).sort((a, b) => b.rate - a.rate);

    setStats({
      consistencyScore,
      trendData,
      weekdayStats: orderedWeekdayStats,
      leaderboard
    });
  }, [rituals, user]);

  if (!rituals || rituals.length === 0) {
    return (
      <div className="text-center py-5 text-secondary">
        <FiActivity size={48} className="mb-3 text-muted" />
        <h5>No Data Available Yet</h5>
        <p className="small">Add some habits and complete them to start generating analytics insights!</p>
      </div>
    );
  }

  // Draw Line Chart SVG parameters
  const chartWidth = 500;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const dataPoints = stats.trendData;
  const maxYVal = Math.max(3, ...dataPoints.map(d => Math.max(d.required, d.completed)));

  const coordinates = dataPoints.map((item, i) => {
    const x = paddingLeft + (i / 6) * (chartWidth - paddingLeft - paddingRight);
    const y = chartHeight - paddingBottom - (item.completed / maxYVal) * (chartHeight - paddingTop - paddingBottom);
    return { x, y, ...item };
  });

  // Build SVG Path
  const linePath = coordinates.reduce((path, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
  }, "");

  // Build Filled Area Path underneath the line
  const areaPath = coordinates.length > 0 
    ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${chartHeight - paddingBottom} L ${coordinates[0].x} ${chartHeight - paddingBottom} Z`
    : "";

  return (
    <div className="d-flex flex-column gap-4 text-start" onClick={() => setHoveredIndex(null)}>
      {/* 1. Consistency Index Card */}
      <div 
        className="p-4"
        style={{
          background: "var(--theme-card-bg, #1a1a1a)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "20px",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="subheading mb-2">
              30-Day Consistency Index
            </div>
            <div className="d-flex align-items-baseline gap-2 mt-2">
              <span style={{ fontSize: "40px", color: "var(--theme-primary, #ff6b00)", fontWeight: "bold" }}>
                {stats.consistencyScore}%
              </span>
              <span className="text-secondary small">completion rate</span>
            </div>
            <p className="text-secondary small mb-0 mt-2" style={{ maxWidth: "260px", lineHeight: "1.4" }}>
              {stats.consistencyScore >= 80 
                ? "Excellent consistency! You are firmly locking in your positive identity." 
                : stats.consistencyScore >= 50 
                ? "Solid progress. Keep pushing to bridge the gap and build stronger habits."
                : "A fresh start is waiting. Focus on checking off just one key habit today!"}
            </p>
            <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.35)", marginTop: "12px", lineHeight: "1.3" }}>
              Formula: (Completed check-ins / Scheduled check-ins) in the last 30 days.
            </div>
          </div>
          <div style={{ position: "relative", width: "90px", height: "90px" }}>
            <svg width="90" height="90" viewBox="0 0 36 36">
              <path
                className="text-dark"
                strokeWidth="3.5"
                stroke="rgba(255,255,255,0.05)"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${stats.consistencyScore}, 100`}
                strokeLinecap="round"
                stroke="var(--theme-primary, #ff6b00)"
                fill="none"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <FiAward size={28} color="var(--theme-primary, #ff6b00)" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. 7-Day Trend Chart */}
      <div 
        className="p-4"
        style={{
          background: "var(--theme-card-bg, #1a1a1a)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "20px"
        }}
      >
        <div className="d-flex align-items-center gap-2 mb-3">
          <FiTrendingUp color="var(--theme-primary, #ff6b00)" />
          <span className="subheading">
            7-Day Completion Trend
          </span>
        </div>

        {/* SVG Area Chart */}
        <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
          <svg 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            width="100%" 
            height="100%"
            style={{ minWidth: "450px" }}
          >
            {/* Gradients */}
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--theme-primary, #ff6b00)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--theme-primary, #ff6b00)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {Array.from({ length: 4 }).map((_, idx) => {
              const yVal = Math.round((maxYVal / 3) * idx);
              const y = chartHeight - paddingBottom - (yVal / maxYVal) * (chartHeight - paddingTop - paddingBottom);
              return (
                <g key={idx}>
                  <line 
                    x1={paddingLeft} 
                    y1={y} 
                    x2={chartWidth - paddingRight} 
                    y2={y} 
                    stroke="rgba(255,255,255,0.04)" 
                    strokeWidth="1"
                  />
                  <text 
                    x={paddingLeft - 8} 
                    y={y + 4} 
                    fill="#666" 
                    fontSize="10" 
                    textAnchor="end"
                  >
                    {yVal}
                  </text>
                </g>
              );
            })}

            {/* Filled Area */}
            {areaPath && (
              <path d={areaPath} fill="url(#chartGradient)" />
            )}

            {/* Main Trend Line */}
            {linePath && (
              <path 
                d={linePath} 
                fill="none" 
                stroke="var(--theme-primary, #ff6b00)" 
                strokeWidth="3.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: "drop-shadow(0px 4px 10px rgba(var(--theme-primary-rgb, 255, 107, 0), 0.35))"
                }}
              />
            )}

            {/* Interactive Data Nodes */}
            {coordinates.map((pt, idx) => (
              <g key={idx}>
                {/* Outer Glowing Ring */}
                <circle 
                  cx={pt.x} 
                  cy={pt.y} 
                  r={hoveredIndex === idx ? "7" : "5"} 
                  fill="var(--theme-primary, #ff6b00)"
                  style={{ transition: "0.15s ease", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredIndex(hoveredIndex === idx ? null : idx);
                  }}
                />
                {/* Inner center */}
                <circle 
                  cx={pt.x} 
                  cy={pt.y} 
                  r="2" 
                  fill="black"
                  style={{ pointerEvents: "none" }}
                />
              </g>
            ))}

            {/* X-Axis Labels */}
            {coordinates.map((pt, idx) => (
              <text 
                key={idx} 
                x={pt.x} 
                y={chartHeight - paddingBottom + 18} 
                fill="#888" 
                fontSize="10" 
                textAnchor="middle"
              >
                {pt.label}
              </text>
            ))}
          </svg>

          {/* Interactive Tooltip Overlay */}
          {hoveredIndex !== null && coordinates[hoveredIndex] && (
            <div 
              style={{
                position: "absolute",
                top: `${coordinates[hoveredIndex].y - 45}px`,
                left: `${(coordinates[hoveredIndex].x / chartWidth) * 100}%`,
                transform: "translateX(-50%)",
                background: "#222",
                border: "1px solid var(--theme-primary, #ff6b00)",
                borderRadius: "8px",
                padding: "4px 8px",
                fontSize: "11px",
                color: "white",
                whiteSpace: "nowrap",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                pointerEvents: "none"
              }}
            >
              <strong>{coordinates[hoveredIndex].completed}</strong> completed ({coordinates[hoveredIndex].dateStr})
            </div>
          )}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.35)", marginTop: "12px", lineHeight: "1.3" }}>
          Formula: Daily count of completed habits. Tap points to view exact dates and check-in counts.
        </div>
      </div>

      {/* 3. Weekday Productivity Breakdown & Leaderboard in a row */}
      <div className="row g-4">
        {/* Weekday Breakdown */}
        <div className="col-12 col-md-6">
          <div 
            className="p-4 h-100"
            style={{
              background: "var(--theme-card-bg, #1a1a1a)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px"
            }}
          >
            <div className="d-flex align-items-center gap-2 mb-3">
              <FiCalendar color="var(--theme-primary, #ff6b00)" />
              <span className="subheading">
                Weekday Consistency
              </span>
            </div>

            <div className="d-flex flex-column gap-2 mt-2">
              {stats.weekdayStats.map((stat, idx) => (
                <div key={idx} className="d-flex align-items-center justify-content-between">
                  <span style={{ width: "35px", fontSize: "12px", color: "#888" }}>{stat.label}</span>
                  <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", margin: "0 10px", overflow: "hidden" }}>
                    <div 
                      style={{
                        height: "100%",
                        width: `${stat.rate}%`,
                        background: "var(--theme-primary, #ff6b00)",
                        borderRadius: "4px"
                      }}
                    />
                  </div>
                  <span style={{ width: "35px", textAlign: "right", fontSize: "12px", color: "white", fontWeight: "bold" }}>
                    {stat.rate}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.35)", marginTop: "16px", lineHeight: "1.3" }}>
              Formula: (Completions on this day / Total times this day was required) in the last 30 days.
            </div>
          </div>
        </div>

        {/* Habit Leaderboard */}
        <div className="col-12 col-md-6">
          <div 
            className="p-4 h-100"
            style={{
              background: "var(--theme-card-bg, #1a1a1a)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px"
            }}
          >
            <div className="d-flex align-items-center gap-2 mb-3">
              <HiFire color="var(--theme-primary, #ff6b00)" size={16} />
              <span className="subheading">
                Habit Leaderboard
              </span>
            </div>

            <div className="d-flex flex-column gap-3 mt-2" style={{ maxHeight: "180px", overflowY: "auto", paddingRight: "4px" }}>
              {stats.leaderboard.map((item, idx) => {
                let rankText = `#${idx + 1}`;

                return (
                  <div key={item.id} className="d-flex justify-content-between align-items-center p-2 rounded-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--theme-primary)", minWidth: "24px" }}>{rankText}</span>
                      <div className="text-truncate">
                        <div className="text-white text-truncate" style={{ fontSize: "13px" }}>{item.title}</div>
                        <span style={{ fontSize: "10.5px", color: "#9ca3af" }}>Streak: {item.streak} {item.streak === 1 ? "day" : "days"}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: "13px", color: "var(--theme-primary, #ff6b00)", fontWeight: "bold", paddingLeft: "10px" }}>
                      {item.rate}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.35)", marginTop: "16px", lineHeight: "1.3" }}>
              Formula: 30-day individual consistency percentage and current active streak.
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: "75px" }} />
    </div>
  );
}
