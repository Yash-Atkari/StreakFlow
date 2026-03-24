import { supabase } from "../services/supabaseClient";
import { isCompletedToday, calculateNewStreak, isDateRequired } from "../utils/streak";
import { FiLock, FiTrash2, FiClock, FiEdit2 } from "react-icons/fi";
import { HiFire } from "react-icons/hi";

export default function RitualCard({ ritual, refresh, onEdit, openModal, onCelebrate }) {

  // 1. Calculate the dynamic status
  const isDone = isCompletedToday(ritual.last_completed_date);
  
  const isWithinWindow = () => {
    if (!ritual.submit_window) return true;
    const now = new Date();
    const current = now.toTimeString().slice(0, 5); // "HH:MM"
    return current >= ritual.start_time && current <= ritual.end_time;
  };

  const isRequiredToday = isDateRequired(ritual, new Date());
  const canComplete = isWithinWindow() && isRequiredToday;

  const handleComplete = async () => {
    if (!canComplete) return;

    // 2. Logic for Undo (if already done today)
    if (isDone) {
      await supabase
        .from("rituals")
        .update({
          completed: false, // Legacy support
          current_streak: Math.max((ritual.current_streak || 1) - 1, 0),
          last_completed_date: null, 
        })
        .eq("id", ritual.id);

      refresh();
      return;
    }

    // 3. Logic for Completion
    const newStreak = calculateNewStreak(ritual);

    if (newStreak > (ritual.current_streak || 0) && onCelebrate) {
      onCelebrate(newStreak);
    }

    await supabase
      .from("rituals")
      .update({
        completed: true,
        current_streak: newStreak,
        last_completed_date: new Date().toISOString(),
      })
      .eq("id", ritual.id);

    refresh();
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this ritual?")) {
      await supabase.from("rituals").delete().eq("id", ritual.id);
      refresh();
    }
  };

  const getRecurrence = () => {
    return ritual.repeat_type === "custom" ? "custom" : ritual.repeat_type;
  };

  return (
    <div
      className="d-flex justify-content-between align-items-center mb-3 p-3"
      style={{
        background: "#1a1a1a",
        borderRadius: "16px",
        // 4. Use isDone for container opacity
        opacity: isDone ? 0.8 : 1, 
        transition: "0.3s ease"
      }}
    >
      {/* LEFT */}
      <div className="d-flex align-items-start gap-3">
        <div
          onClick={handleComplete}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: canComplete ? "2px solid #ff6b00" : "2px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canComplete ? "pointer" : "not-allowed",
            marginTop: "2px",
            // 5. Use isDone for circle background
            background: isDone ? "#ff6b00" : "transparent"
          }}
        >
          {!canComplete ? (
            <FiLock size={12} color="#888" />
          ) : isDone ? ( // 6. Use isDone for icon visibility
            <HiFire size={16} color="white" />
          ) : null}
        </div>

        <div>
          <div style={{ 
            fontSize: "15px", 
            // 7. Use isDone for text styling
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

          <div className="d-flex align-items-center gap-2 mt-1 small text-secondary">
            <span className="d-flex align-items-center gap-1"> 
               <HiFire size={14} color={ritual.current_streak > 0 ? "#ff6b00" : "#444"} /> 
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
          onClick={() => {
            onEdit(ritual);
            openModal();
          }}
        />
        <FiTrash2
          size={18}
          className="icon-btn"
          onClick={handleDelete}
        />
      </div>
    </div>
  );
}