import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import AddRitualModal from "../components/AddRitualModal";
import RitualCard from "../components/RitualCard";
import CircularProgress from "../components/CircularProgress";
import NivoraIcon from "../components/NivoraIcon";
import AddUrgencyModal from "../components/AddUrgencyModal";
import UrgencyList from "../components/UrgencyList";
import { checkUrgencyNotifications, sendSystemNotification, requestNotificationPermission } from "../utils/urgencyScheduler";
import { 
  FiLogOut, 
  FiAlertCircle, 
  FiList, 
  FiSliders, 
  FiShield, 
  FiZap,
  FiBarChart2,
  FiPlus,
  FiBell,
  FiBellOff
} from "react-icons/fi";

import StreakCelebration from "../components/StreakCelebration";
import { setupNotifications } from '../services/fcmService.js';
import { isDateRequired, isCompletedToday, calculateStreak } from "../utils/streak";

// Premium imports
import PremiumModal from "../components/PremiumModal";
import WeeklyRecapStory from "../components/WeeklyRecapStory";
import SuggestionModal from "../components/SuggestionModal";
import { usePremium } from "../contexts/PremiumContext";
import AnalyticsTab from "../components/AnalyticsTab";
import { useDialog } from "../contexts/DialogContext";
import { playTap, playThemeSweep, playNotificationSound } from "../utils/audio";

export default function Home({ user }) {
  const { alert, confirm } = useDialog();
  const [rituals, setRituals] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedRitual, setSelectedRitual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [celebrationStreak, setCelebrationStreak] = useState(null);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Premium UI states
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showRecapStory, setShowRecapStory] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState("tracker");
  const [trackerSubTab, setTrackerSubTab] = useState("habits"); // "habits" or "urgency"
  const [urgencyModalOpen, setUrgencyModalOpen] = useState(false);
  const [selectedUrgencyGoal, setSelectedUrgencyGoal] = useState(null);
  const [urgencyRefreshTrigger, setUrgencyRefreshTrigger] = useState(0);
  const [urgencyGoals, setUrgencyGoals] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);

  // Swipe gesture touch tracking
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    const t = e.targetTouches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
    setTouchEnd({ x: t.clientX, y: t.clientY });
  };

  const handleTouchMove = (e) => {
    const t = e.targetTouches[0];
    setTouchEnd({ x: t.clientX, y: t.clientY });
  };

  const handleTouchEnd = () => {
    const diffX = touchStart.x - touchEnd.x;
    const diffY = touchStart.y - touchEnd.y;
    
    // Swipe left (diffX > 50) means transition to urgency
    // Swipe right (diffX < -50) means transition to habits
    // Verify horizontal move is larger than vertical move to avoid accidental swipes on scrolls
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0 && trackerSubTab === "habits") {
        setTrackerSubTab("urgency");
        playTap();
      } else if (diffX < 0 && trackerSubTab === "urgency") {
        setTrackerSubTab("habits");
        playTap();
      }
    }
  };

  // PWA Install prompt states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Notification toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("nivora_notifications_enabled") !== "false";
  });

  // Consume Premium Context
  const { isPremium, shieldsCount, buyShields } = usePremium();

  // Resolve preference metadata from user
  const activeTheme = user?.user_metadata?.premium_theme || "default";

  const handleTabClick = (tab) => {
    playTap();
    if (tab === "insights") {
      setShowRecapStory(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleLogout = async () => {
    const accepted = await confirm("Are you sure you want to log out?", "Confirm Logout");
    if (accepted) {
      await supabase.auth.signOut();
    }
  };

  const handleToggleNotifications = async () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    localStorage.setItem("nivora_notifications_enabled", String(nextState));
    
    if (nextState) {
      playTap();
      await setupNotifications(user.id);
      await alert("Notifications enabled! You will now receive daily reminders.", "Notifications On");
    } else {
      playTap();
      try {
        const { error } = await supabase
          .from("fcm_tokens")
          .delete()
          .eq("user_id", user.id);
        if (error) throw error;
        await alert("Notifications disabled. You will no longer receive daily reminders.", "Notifications Off");
      } catch (err) {
        console.error("Failed to delete FCM token on disable:", err);
      }
    }
  };

  const fetchRituals = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    if (!user) {
      setError("authentication_required");
      setLoading(false);
      return;
    }

    const { error: resetError } = await supabase.rpc("reset_missed_streaks");
    if (resetError) {
      console.error("Error resetting missed streaks:", resetError);
    }

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const { data, error: fetchError } = await supabase
      .from("rituals")
      .select(`
        *,
        habit_logs (
          completed_at
        )
      `)
      .gte("habit_logs.completed_at", oneYearAgo.toISOString());

    if (fetchError) {
      setError("fetch_failed");
    } else {
      let fetched = data || [];
      
      const userId = user.id;
      const storedOrder = localStorage.getItem(`nivora_order_${userId}`);
      if (storedOrder) {
        try {
          const orderIds = JSON.parse(storedOrder);
          const orderMap = {};
          orderIds.forEach((id, idx) => {
            orderMap[id] = idx;
          });
          
          fetched.sort((a, b) => {
            const indexA = orderMap[a.id] !== undefined ? orderMap[a.id] : -1;
            const indexB = orderMap[b.id] !== undefined ? orderMap[b.id] : -1;
            
            if (indexA === -1 && indexB === -1) {
              return new Date(b.created_at) - new Date(a.created_at);
            }
            if (indexA === -1) return -1;
            if (indexB === -1) return 1;
            return indexA - indexB;
          });
        } catch (e) {
          console.error("Error parsing stored order", e);
          fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
      } else {
        fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      if (userId && fetched.length > 0) {
        const currentOrderIds = fetched.map(r => r.id);
        localStorage.setItem(`nivora_order_${userId}`, JSON.stringify(currentOrderIds));
      }

      const enriched = fetched.map(r => ({
        ...r,
        current_streak: calculateStreak(r)
      }));

      setRituals(enriched);

      // Auto-sync client timezone for rituals in the database
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const ritualsToUpdate = fetched.filter(r => r.timezone !== localTimezone);
      if (ritualsToUpdate.length > 0) {
        Promise.all(
          ritualsToUpdate.map((r) =>
            supabase.from("rituals").update({ timezone: localTimezone }).eq("id", r.id)
          )
        )
          .then(() => {
            console.log(`Auto-synced local timezone (${localTimezone}) to ${ritualsToUpdate.length} rituals.`);
          })
          .catch((e) => {
            console.error("Failed to auto-sync ritual timezones:", e);
          });
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRituals();
  }, [fetchRituals]);

  const fetchUrgencyGoals = useCallback(async () => {
    if (!user) return;
    let fetched = null;
    try {
      const { data, error } = await supabase
        .from("urgency_goals")
        .select("*");
      if (!error && data) fetched = data;
    } catch (err) {
      // ignore
    }

    if (!fetched) {
      const localStr = localStorage.getItem(`nivora_local_urgency_${user.id}`) || "[]";
      try {
        fetched = JSON.parse(localStr);
      } catch (e) {
        fetched = [];
      }
    }

    setUrgencyGoals(fetched || []);
  }, [user]);

  useEffect(() => {
    fetchUrgencyGoals();
  }, [fetchUrgencyGoals, urgencyRefreshTrigger]);

  // Request notification permissions
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission();
    }
  }, [notificationsEnabled]);

  // Background check for active urgency goals notifications
  useEffect(() => {
    if (!user || urgencyGoals.length === 0) return;

    const runNotificationCheck = async () => {
      const didTrigger = await checkUrgencyNotifications(
        urgencyGoals,
        user,
        (title, body) => {
          playNotificationSound();
          sendSystemNotification(title, body);
          setActiveNotification({ title, body });
          
          // Auto-dismiss the alert banner after 6 seconds
          setTimeout(() => {
            setActiveNotification(null);
          }, 6000);
        }
      );

      if (didTrigger) {
        fetchUrgencyGoals();
      }
    };

    runNotificationCheck();

    // Check every 15 seconds
    const interval = setInterval(runNotificationCheck, 15000);
    return () => clearInterval(interval);
  }, [user, urgencyGoals, fetchUrgencyGoals]);

  useEffect(() => {
    if (user && notificationsEnabled) {
      setupNotifications(user.id);
    }
  }, [user, notificationsEnabled]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log("PWA was installed");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    playTap();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Product branding themes and terminology mapping
  const getHabitTerm = () => {
    if (!isPremium) return "rituals";
    return {
      default: "rituals",
      glowup: "cyber-habits",
      zen: "zen tasks",
      gym: "missions",
      study: "quests",
      healing: "aspirations"
    }[activeTheme] || "rituals";
  };

  const renderTitle = () => {
    return (
      <span className="d-inline-flex align-items-center gap-2">
        <NivoraIcon size={35} />
        <b>
          <span className="premium-glow-text">Nivora</span>
        </b>
      </span>
    );
  };

  // Stats
  const ritualsToday = rituals.filter(r => isDateRequired(r, new Date()));
  const total = ritualsToday.length;
  const completedToday = ritualsToday.filter(r => isCompletedToday(r.last_completed_date)).length;
  const progress = total === 0 ? 0 : Math.round((completedToday / total) * 100);
  const longestStreak = Math.max(...rituals.map(r => r.current_streak || 0), 0);

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...rituals];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);

    setRituals(reordered);

    if (user?.id) {
      const orderIds = reordered.map(r => r.id);
      localStorage.setItem(`nivora_order_${user.id}`, JSON.stringify(orderIds));
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getShieldClaimStatus = () => {
    if (!user) return { claimable: true };
    const claimKey = `last_shield_claim_${user.id}`;
    const lastClaim = localStorage.getItem(claimKey);
    if (!lastClaim) return { claimable: true };

    const now = new Date();
    const lastClaimDate = new Date(lastClaim);
    const diffTime = Math.abs(now - lastClaimDate);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 7) {
      const remainingTime = 7 - diffDays;
      const days = Math.floor(remainingTime);
      const hours = Math.ceil((remainingTime - days) * 24);
      return {
        claimable: false,
        remainingText: `${days}d ${hours}h`
      };
    }

    return { claimable: true };
  };

  const claimStatus = getShieldClaimStatus();

  if (error === "authentication_required" || !user) {
    return (
      <div className="container py-5 text-center">
        <FiAlertCircle size={48} color="#9ca3af" className="mb-3" />
        <h3>Session Expired</h3>
        <p className="text-secondary">Please log in to view and manage your rituals.</p>
        <button 
          className="primary-btn mt-3" 
          onClick={() => window.location.href = window.location.origin}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className={`theme-wrapper theme-${activeTheme}`}>
      <div className="container py-4" style={{ paddingBottom: "160px" }}>
        
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">
            {renderTitle()}
          </h2>
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={handleToggleNotifications}
              className="logout-btn d-flex align-items-center gap-2"
              title={notificationsEnabled ? "Disable Reminders" : "Enable Reminders"}
              style={{
                borderColor: notificationsEnabled ? "rgba(255, 107, 0, 0.4)" : "rgba(255, 255, 255, 0.15)",
                color: notificationsEnabled ? "var(--theme-primary, #ff6b00)" : "#9ca3af"
              }}
            >
              {notificationsEnabled ? <FiBell size={16} /> : <FiBellOff size={16} />}
              <span className="logout-text">{notificationsEnabled ? "Reminders On" : "Reminders Off"}</span>
            </button>
            <button
              onClick={handleLogout}
              className="logout-btn d-flex align-items-center gap-2"
            >
              <FiLogOut size={16} />
              <span className="logout-text">Logout</span>
            </button>
          </div>
        </div>

        {/* Render Active Tab Content */}
        {activeTab === "tracker" && (
          <>
            {/* PWA Install Banner */}
            {showInstallBanner && (
              <div 
                className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center p-3 mb-4 rounded-4 gap-3" 
                style={{ 
                  background: "rgba(255, 107, 0, 0.08)",
                  border: "1px solid rgba(255, 107, 0, 0.2)",
                  backdropFilter: "blur(10px)",
                  animation: "fadeIn 0.3s ease-in-out"
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-circle" style={{ background: "rgba(255, 107, 0, 0.15)", flexShrink: 0 }}>
                    <NivoraIcon size={24} />
                  </div>
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: "14px", lineHeight: "1.2" }}>Install Nivora App</div>
                    <div className="text-secondary" style={{ fontSize: "11px", marginTop: "2px", lineHeight: "1.3" }}>Add to home screen for faster, native access!</div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-auto ms-sm-0">
                  <button 
                    style={{ 
                      fontSize: "12px", 
                      color: "#9ca3af", 
                      background: "transparent", 
                      border: "none", 
                      outline: "none", 
                      padding: "6px 12px",
                      cursor: "pointer",
                      transition: "color 0.2s"
                    }}
                    onMouseEnter={(e) => e.target.style.color = "#ffffff"}
                    onMouseLeave={(e) => e.target.style.color = "#9ca3af"}
                    onClick={() => setShowInstallBanner(false)}
                  >
                    Later
                  </button>
                  <button 
                    style={{ 
                      fontSize: "12px", 
                      fontWeight: "700",
                      color: "#000000", 
                      background: "var(--theme-primary, #ff6b00)", 
                      border: "none", 
                      borderRadius: "10px", 
                      padding: "6px 16px",
                      cursor: "pointer",
                      width: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "30px"
                    }}
                    onClick={handleInstallClick}
                  >
                    Install
                  </button>
                </div>
              </div>
            )}

            {/* Toggle Switch between Habits and Urgency */}
            <div className="d-flex justify-content-center mb-4">
              <div 
                className="p-1 rounded-pill d-flex" 
                style={{ 
                  background: "rgba(255, 255, 255, 0.04)", 
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)"
                }}
              >
                <button
                  type="button"
                  className="px-4 py-2 rounded-pill fw-bold border-0"
                  style={{
                    background: trackerSubTab === "habits" ? "var(--theme-primary, #ff6b00)" : "transparent",
                    color: trackerSubTab === "habits" ? "#000000" : "#a1a1aa",
                    fontSize: "13px",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    cursor: "pointer"
                  }}
                  onClick={() => { playTap(); setTrackerSubTab("habits"); }}
                >
                  Habits
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-pill fw-bold border-0"
                  style={{
                    background: trackerSubTab === "urgency" ? "var(--theme-primary, #ff6b00)" : "transparent",
                    color: trackerSubTab === "urgency" ? "#000000" : "#a1a1aa",
                    fontSize: "13px",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    cursor: "pointer"
                  }}
                  onClick={() => { playTap(); setTrackerSubTab("urgency"); }}
                >
                  Urgency
                </button>
              </div>
            </div>

            {/* Sliding swipe container */}
            <div
              className="swipe-container"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                overflow: "hidden",
                width: "100%",
                position: "relative"
              }}
            >
              <div
                className="swipe-slides-wrapper"
                style={{
                  display: "flex",
                  width: "200%",
                  transform: `translate3d(${trackerSubTab === "habits" ? "0%" : "-50%"}, 0, 0)`,
                  transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
                {/* Habits Slide */}
                <div 
                  className="swipe-slide" 
                  style={{ 
                    width: "50%", 
                    flexShrink: 0,
                    opacity: trackerSubTab === "habits" ? 1 : 0.05,
                    transition: "opacity 0.25s ease, max-height 0.25s ease",
                    pointerEvents: trackerSubTab === "habits" ? "auto" : "none",
                    maxHeight: trackerSubTab === "habits" ? "none" : "0px",
                    overflow: trackerSubTab === "habits" ? "visible" : "hidden"
                  }}
                >
                  {/* Dashboard Stats */}
                  <div 
                    className="p-4 mb-4" 
                    style={{ 
                      background: "var(--theme-card-bg, #1f2937)", 
                      borderRadius: "20px",
                      border: "1px solid rgba(255, 255, 255, 0.05)"
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-3">
                        <NivoraIcon size={50} />
                        <div>
                          <div className="subheading mb-1">Longest Streak</div>
                          <div style={{ fontSize: "28px", color: "var(--theme-primary, #ff6b00)", fontWeight: "bold", lineHeight: "1.2" }}>{longestStreak}</div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <div className="text-end">
                          <div className="subheading mb-1">Today</div>
                          <div style={{ fontSize: "16px", fontWeight: "bold" }}>{completedToday}/{total}</div>
                        </div>
                        <CircularProgress value={progress} />
                      </div>
                    </div>
                  </div>

                  {/* Ritual List */}
                  {loading ? (
                    <div className="text-center mt-5 text-secondary">Loading your flow...</div>
                  ) : (
                    <>
                      {rituals.length === 0 ? (
                        <div className="text-center mt-5 mb-4 text-secondary">
                          No {getHabitTerm()} defined. Start with one.
                        </div>
                      ) : (
                        rituals.map((r, index) => (
                          <div
                            key={r.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`draggable-ritual-container ${
                              draggedIndex === index ? "dragging" : ""
                            } ${dragOverIndex === index ? "drag-over" : ""}`}
                          >
                            <RitualCard
                              ritual={r}
                              refresh={fetchRituals}
                              onEdit={setSelectedRitual}
                              openModal={() => setOpen(true)}
                              onCelebrate={(streak) => setCelebrationStreak(streak)}
                              onOpenPremium={() => setShowPremiumModal(true)}
                            />
                          </div>
                        ))
                      )}

                      {/* Suggestion Box Habit Card */}
                      <div
                        className="mb-3 ritual-card-premium"
                        style={{
                          background: "var(--theme-card-bg, rgba(22, 22, 26, 0.7))",
                          borderRadius: "18px",
                          border: "1px solid var(--theme-card-border, rgba(255, 255, 255, 0.06))",
                          cursor: "pointer",
                          transition: "all 0.3s ease"
                        }}
                        onClick={() => {
                          playTap();
                          setShowSuggestionModal(true);
                        }}
                      >
                        <div className="d-flex align-items-center p-3 gap-3">
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              border: "2px solid var(--theme-primary, #ff6b00)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 107, 0, 0.1)",
                              flexShrink: 0
                            }}
                          >
                            <span style={{ fontSize: "12px", color: "var(--theme-primary, #ff6b00)", fontWeight: "bold" }}>?</span>
                          </div>
                          <div>
                            <div style={{ fontSize: "15px", fontWeight: "bold", color: "white" }}>
                              Suggestion Box
                            </div>
                            <div className="text-secondary" style={{ fontSize: "11px" }}>
                              Tap to suggest improvements & features
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div style={{ height: "120px" }} />
                </div>

                {/* Urgency Slide */}
                <div 
                  className="swipe-slide px-1" 
                  style={{ 
                    width: "50%", 
                    flexShrink: 0,
                    opacity: trackerSubTab === "urgency" ? 1 : 0.05,
                    transition: "opacity 0.25s ease, max-height 0.25s ease",
                    pointerEvents: trackerSubTab === "urgency" ? "auto" : "none",
                    maxHeight: trackerSubTab === "urgency" ? "none" : "0px",
                    overflow: trackerSubTab === "urgency" ? "visible" : "hidden"
                  }}
                >
                  <UrgencyList
                    goals={urgencyGoals}
                    refresh={fetchUrgencyGoals}
                    onEdit={setSelectedUrgencyGoal}
                    onOpenModal={() => setUrgencyModalOpen(true)}
                  />
                </div>
              </div>
            </div>

            {/* Add Button */}
            {!(trackerSubTab === "urgency" && urgencyGoals.length === 0) && (
              <button
                onClick={() => { 
                  playTap(); 
                  if (trackerSubTab === "habits") {
                    setOpen(true); 
                    setSelectedRitual(null); 
                  } else {
                    setUrgencyModalOpen(true);
                    setSelectedUrgencyGoal(null);
                  }
                }}
                className="floating-add-btn animate-bounce-on-hover"
                style={{
                  position: "fixed",
                  bottom: "105px", // Moved up slightly to fit perfectly above the floating glass nav
                  right: "24px",
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--theme-primary, #ff6b00) 0%, #ff8533 100%)",
                  color: "black",
                  border: "none",
                  cursor: "pointer",
                  zIndex: 100,
                  boxShadow: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
                }}
              >
                <FiPlus size={28} />
              </button>
            )}
          </>
        )}

        {activeTab === "vibes" && (
          <div className="p-3 mb-4 rounded-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <h4 className="mb-2 text-white">Vibe Themes</h4>
            <p className="text-secondary small mb-4">Select an identity layout for your habit lists and colors.</p>
            
            <div className="row g-3">
              {[
                { id: "default", name: "Orange", desc: "Classic orange styling and simple momentum.", primaryColor: "#ff6b00" },
                { id: "glowup", name: "Pink", desc: "Neon pink highlights and vibrant outlines.", primaryColor: "#ec4899" },
                { id: "zen", name: "Green", desc: "Soothing green colors and minimal focus.", primaryColor: "#10b981" },
                { id: "gym", name: "Yellow", desc: "Amber yellow highlights and warm tones.", primaryColor: "#f59e0b" },
                { id: "study", name: "Blue", desc: "Clean blue styling and deep accents.", primaryColor: "#3b82f6" },
                { id: "healing", name: "Purple", desc: "Lavender purple shades and calm lines.", primaryColor: "#8b5cf6" }
              ].map((t) => {
                const isActive = activeTheme === t.id;
                return (
                  <div className="col-12 col-md-6" key={t.id}>
                    <div 
                      className={`p-3 rounded-4 border text-start d-flex justify-content-between align-items-center ${isActive ? "border-warning" : "border-secondary"}`}
                      style={{ cursor: "pointer", background: isActive ? "rgba(255,255,255,0.05)" : "#16161a" }}
                      onClick={async () => {
                        playThemeSweep();
                        await supabase.auth.updateUser({
                          data: {
                            ...user.user_metadata,
                            premium_theme: t.id
                          }
                        });
                        fetchRituals();
                      }}
                    >
                      <div>
                        <h6 className="mb-1 text-white fw-bold">{t.name}</h6>
                        <span className="text-secondary small d-block" style={{ fontSize: "11px" }}>{t.desc}</span>
                      </div>
                      <div 
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: t.primaryColor,
                          boxShadow: `0 0 10px ${t.primaryColor}`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: "120px" }} />
          </div>
        )}

        {activeTab === "shields" && (
          <div className="p-4 text-center rounded-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ position: "relative", display: "inline-block" }} className="mb-3">
              <FiShield size={70} color="var(--theme-primary)" style={{ display: "block", margin: "0 auto" }} />
              <span style={{
                position: "absolute",
                bottom: "-5px",
                right: "-5px",
                background: "var(--theme-primary, #ff6b00)",
                color: "white",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold",
                border: "2px solid #111"
              }}>
                {shieldsCount}
              </span>
            </div>
            <h4 className="text-white mb-2">Streak Insurance</h4>
            <p className="text-secondary small px-3 mb-4">
              Streak shields protect your habits from breaking if you miss a required check-in.
              To use a shield, expand a broken habit card in the Tracker tab and click "Use Shield".
            </p>
             <button 
              className="primary-btn" 
              style={{ 
                maxWidth: "280px", 
                margin: "0 auto"
              }}
              disabled={!claimStatus.claimable}
              onClick={async () => {
                if (!claimStatus.claimable) return;
                 await buyShields(3);
                 localStorage.setItem(`last_shield_claim_${user.id}`, new Date().toISOString());
                 await alert("Streak Shields recharged!", "Shields Recharged");
                 fetchRituals(); // trigger re-render
              }}
            >
              {claimStatus.claimable ? "Add 3 Shields" : `Next claim in: ${claimStatus.remainingText}`}
            </button>
            <div style={{ height: "120px" }} />
          </div>
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab rituals={rituals} user={user} />
        )}

        {/* Bottom Navigation Bar */}
        <div className="bottom-navbar">
          <button 
            className={`nav-tab-btn ${activeTab === "tracker" ? "active" : ""}`}
            onClick={() => handleTabClick("tracker")}
          >
            <FiList className="nav-tab-icon" />
            <span>Tracker</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => handleTabClick("analytics")}
          >
            <FiBarChart2 className="nav-tab-icon" />
            <span>Analytics</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "vibes" ? "active" : ""}`}
            onClick={() => handleTabClick("vibes")}
          >
            <FiSliders className="nav-tab-icon" />
            <span>Vibes</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "shields" ? "active" : ""}`}
            onClick={() => handleTabClick("shields")}
          >
            <FiShield className="nav-tab-icon" />
            <span>Shields</span>
          </button>

          <button 
            className="nav-tab-btn"
            onClick={() => handleTabClick("insights")}
          >
            <FiZap className="nav-tab-icon" />
            <span>Insights</span>
          </button>
        </div>

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

        {urgencyModalOpen && (
          <AddUrgencyModal
            close={() => setUrgencyModalOpen(false)}
            refresh={fetchUrgencyGoals}
            urgencyGoal={selectedUrgencyGoal}
          />
        )}

        {/* Premium Billing/Upgrade Modal */}
        {showPremiumModal && (
          <PremiumModal 
            close={() => setShowPremiumModal(false)}
            refresh={fetchRituals}
          />
        )}

        {/* Weekly Recap Story Overlay */}
        {showRecapStory && (
          <WeeklyRecapStory 
            rituals={rituals}
            user={user}
            onClose={() => setShowRecapStory(false)}
          />
        )}

        {/* Suggestion Box Form Overlay */}
        {showSuggestionModal && (
          <SuggestionModal 
            user={user}
            close={() => setShowSuggestionModal(false)}
          />
        )}

        {/* Urgency In-App Notification Banner */}
        {activeNotification && (
          <div 
            className="in-app-notification-banner"
            style={{
              position: "fixed",
              top: "20px",
              left: "50%",
              transform: "translate3d(-50%, 0, 0)",
              width: "90%",
              maxWidth: "400px",
              background: "rgba(22, 22, 26, 0.95)",
              border: "1px solid var(--theme-primary, #ff6b00)",
              borderRadius: "16px",
              padding: "16px",
              zIndex: 9999,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(10px)",
              animation: "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div 
                className="p-2 rounded-circle d-flex align-items-center justify-content-center" 
                style={{ background: "rgba(255, 108, 0, 0.15)", color: "var(--theme-primary, #ff6b00)" }}
              >
                <NivoraIcon size={24} />
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold text-white" style={{ fontSize: "14px", textAlign: "left" }}>
                  {activeNotification.title}
                </div>
                <div className="text-secondary mt-1" style={{ fontSize: "12px", textAlign: "left" }}>
                  {activeNotification.body}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveNotification(null)}
                style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
