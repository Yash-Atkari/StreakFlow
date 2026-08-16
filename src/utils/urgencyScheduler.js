import { supabase } from "../services/supabaseClient";

/**
 * Checks active urgency goals and triggers notifications when thresholds are crossed.
 */
export async function checkUrgencyNotifications(goals, user, onNotify) {
  if (!user || !goals || goals.length === 0) return;

  const now = new Date();
  const updatedGoals = [];

  for (const goal of goals) {
    if (goal.completed) continue;

    const startDate = new Date(goal.start_time);
    const endDate = new Date(goal.end_time);

    // If start time hasn't arrived yet, skip
    if (now < startDate) continue;

    const totalMs = endDate.getTime() - startDate.getTime();
    const elapsedMs = now.getTime() - startDate.getTime();
    const progress = elapsedMs / totalMs;

    const timeRemainingMs = endDate.getTime() - now.getTime();
    const fiveMinutesMs = 5 * 60 * 1000;

    let triggerType = null; // '50', '75', 'deadline'
    let title = "";
    let body = "";

    // 1. Deadline Approaching Check (within last 5 minutes, or last 20% for short sprints under 15 minutes)
    const deadlineThresholdMs = Math.min(fiveMinutesMs, totalMs * 0.2);
    if (timeRemainingMs > 0 && timeRemainingMs <= deadlineThresholdMs && !goal.notified_deadline) {
      triggerType = "deadline";
      title = "⚠️ Deadline Approaching";
      const minsLeft = Math.ceil(timeRemainingMs / 60000);
      body = `"${goal.title}" is ending in ${minsLeft} ${minsLeft === 1 ? 'minute' : 'minutes'}!`;
    }
    // 2. 75% Threshold Check
    else if (progress >= 0.75 && progress < 0.95 && !goal.notified_75) {
      triggerType = "75";
      title = "⏳ 75% Timeline Elapsed";
      body = `"${goal.title}" has 25% of its timeline remaining. Keep pushing!`;
    }
    // 3. 50% Threshold Check
    else if (progress >= 0.5 && progress < 0.75 && !goal.notified_50) {
      triggerType = "50";
      title = "🏃‍♂️ 50% Timeline Elapsed";
      body = `"${goal.title}" is halfway through its timeline.`;
    }

    if (triggerType) {
      // Trigger callback to render alert/toast banner
      onNotify(title, body);

      // Prepare payload to store
      const payload = {};
      if (triggerType === "50") payload.notified_50 = true;
      if (triggerType === "75") payload.notified_75 = true;
      if (triggerType === "deadline") payload.notified_deadline = true;

      // Update Supabase or LocalStorage
      let error = null;
      try {
        const { error: dbError } = await supabase
          .from("urgency_goals")
          .update(payload)
          .eq("id", goal.id);
        error = dbError;
      } catch (err) {
        error = err;
      }

      if (error) {
        // Fallback update in LocalStorage
        const localGoalsStr = localStorage.getItem(`nivora_local_urgency_${user.id}`) || "[]";
        try {
          const localGoals = JSON.parse(localGoalsStr);
          const idx = localGoals.findIndex(g => g.id === goal.id);
          if (idx !== -1) {
            localGoals[idx] = { ...localGoals[idx], ...payload };
            localStorage.setItem(`nivora_local_urgency_${user.id}`, JSON.stringify(localGoals));
          }
        } catch (e) {
          console.error("Failed to update local storage notifications:", e);
        }
      }

      // Track updated goal state locally
      updatedGoals.push({ ...goal, ...payload });
    }
  }

  return updatedGoals.length > 0;
}

/**
 * Utility to request system notification permissions
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

/**
 * Utility to trigger native browser notification banner
 */
export function sendSystemNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "https://niivora.netlify.app/logo192.png"
      });
    } catch (e) {
      console.warn("Failed to spawn System Notification:", e);
    }
  }
}
