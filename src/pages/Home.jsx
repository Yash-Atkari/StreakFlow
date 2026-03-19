import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import AddRitualModal from "../components/AddRitualModal";
import RitualCard from "../components/RitualCard";
import CircularProgress from "../components/CircularProgress";
import { HiFire } from "react-icons/hi";
import { FiLogOut, FiAlertCircle } from "react-icons/fi"; // Added alert icon
import StreakCelebration from "../components/StreakCelebration"; // 1. Import it
import { setupNotifications } from './services/fcmService.js';

  export default function Home() {
    const [rituals, setRituals] = useState([]);
    const [open, setOpen] = useState(false);
    const [selectedRitual, setSelectedRitual] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [celebrationStreak, setCelebrationStreak] = useState(null); // 2. Add this state

    // 1. Initial Data Load
    useEffect(() => {
      fetchRituals();
    }, []);

    // Inside Home.jsx
    useEffect(() => {
      const initFCM = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setupNotifications(user.id);
        }
      };
      initFCM();
    }, []);

    const fetchRituals = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("authentication_required");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("rituals")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("fetch_failed");
      } else {
        setRituals(data || []);
        // Reset streaks after fetching
        if (data) resetMissedStreaks(data);
      }
      setLoading(false);
    };

    // Stats
    const total = rituals.length;
    const completedToday = rituals.filter(r => r.completed).length;
    const progress = total === 0 ? 0 : Math.round((completedToday / total) * 100);
    const longestStreak = Math.max(...rituals.map(r => r.current_streak || 0), 0);

    // Inside Home.jsx
    const resetMissedStreaks = async (items) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updates = [];

      for (let r of items) {
        if (!r.last_completed_date || r.current_streak === 0) continue;

        const last = new Date(r.last_completed_date);
        last.setHours(0, 0, 0, 0);

        let missed = false;
        let checkDate = new Date(last);
        checkDate.setDate(checkDate.getDate() + 1);

        // Check every day up until TODAY
        while (checkDate < today) {
          // If any day in the past was required but not completed
          if (isRequiredDay(checkDate, r)) {
            missed = true;
            break;
          }
          checkDate.setDate(checkDate.getDate() + 1);
        }

        if (missed) {
          updates.push(
            supabase.from("rituals").update({ current_streak: 0 }).eq("id", r.id)
          );
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        fetchRituals();
      }
    };

    // 2. Handle Authentication Error State
    if (error === "authentication_required") {
      return (
        <div className="container py-5 text-center">
          <FiAlertCircle size={48} color="#9ca3af" className="mb-3" />
          <h3>Session Expired</h3>
          <p className="text-secondary">Please log in to view and manage your rituals.</p>
          <button 
            className="primary-btn mt-3" 
            onClick={() => window.location.href = "/login"} // Or your login route
          >
            Go to Login
          </button>
        </div>
      );
    }

    return (
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0"><b>StreakFlow</b></h2>
          <button
            onClick={async () => await supabase.auth.signOut()}
            className="logout-btn d-flex align-items-center gap-2"
          >
            <FiLogOut size={16} />
            <span className="logout-text">Logout</span>
          </button>
        </div>

        {/* Dashboard Stats */}
        <div className="p-4 mb-4" style={{ background: "#1f2937", borderRadius: "20px" }}>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <HiFire size={50} color="#ff6b00" />
              <div>
                <div style={{ color: "#9ca3af", fontSize: "12px" }}>LONGEST STREAK</div>
                <div style={{ fontSize: "28px", color: "#ff6b00" }}>{longestStreak}</div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div className="text-end">
                <div style={{ color: "#9ca3af" }}>Today</div>
                <div>{completedToday}/{total}</div>
              </div>
              <CircularProgress value={progress} />
            </div>
          </div>
        </div>

        {/* Ritual List */}
        {loading ? (
          <div className="text-center mt-5 text-secondary">Loading your flow...</div>
        ) : rituals.length === 0 ? (
          <div className="text-center mt-5 text-secondary">
            No rituals defined. Start with one.
          </div>
        ) : (
          rituals.map((r) => (
            <RitualCard
              key={r.id}
              ritual={r}
              refresh={fetchRituals}
              onEdit={setSelectedRitual}
              openModal={() => setOpen(true)}
              onCelebrate={(streak) => setCelebrationStreak(streak)} // 3. Pass the trigger
            />
          ))
        ) }

        {/* Add Button */}
        <button
          onClick={() => { setOpen(true); setSelectedRitual(null); }}
          className="floating-add-btn"
          style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          fontSize: "28px",
          background: "#ff6b00",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
        > + </button>

        {celebrationStreak && (
          <StreakCelebration 
            streak={celebrationStreak} 
            onClose={() => setCelebrationStreak(null)} 
          />
        )}

        {/* Modal Integration */}
        {open && (
          <AddRitualModal
            close={() => setOpen(false)}
            refresh={fetchRituals}
            ritual={selectedRitual}
          />
        )}
      </div>
    );
  }
