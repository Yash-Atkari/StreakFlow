import { posthogService } from "./posthog";

export const analytics = {
  setUserId: (userId) => {
    // PostHog identify
    posthogService.identify(userId);
  },

  setUserProperties: (properties = {}) => {
    // PostHog user properties
    posthogService.identify(posthogService.get_distinct_id?.() || "", properties);
  },

  logEvent: (eventName, properties = {}) => {
    console.log(`[Analytics Event] ${eventName}:`, properties);
    // PostHog Track
    posthogService.track(eventName, properties);
  },

  // Custom standard helper events:
  logSignUp: (userId, method = "email") => {
    analytics.setUserId(userId);
    analytics.logEvent("sign_up", { method });
  },

  logLogin: (userId, method = "email") => {
    analytics.setUserId(userId);
    analytics.logEvent("login", { method });
  },

  logOnboardingCompleted: () => {
    analytics.logEvent("onboarding_completed");
  },

  logHabitCreated: (title, recurrence, targetStreak = null) => {
    analytics.logEvent("habit_created", {
      title,
      recurrence,
      target_streak: targetStreak,
    });
  },

  logStreakMilestone: (habitTitle, streak) => {
    analytics.logEvent("streak_milestone", {
      habit_title: habitTitle,
      streak_count: streak,
    });
  },

  logPremiumConversion: (planId, price) => {
    analytics.logEvent("premium_conversion", {
      plan_id: planId,
      price: price,
    });
  },

  logScreenView: (screenName) => {
    // PostHog screen view
    posthogService.screen(screenName);
  },
};
