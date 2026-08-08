import { initPostHog } from "./posthog";
import { initRevenueCat } from "./revenueCat";
import { setupMobileNotifications } from "./firebaseMessaging";
import { analytics } from "./analytics";
import { mobileCrashlytics } from "./firebaseCrashlytics";
import { incrementLaunchCount } from "./appReview";
import { Capacitor } from "@capacitor/core";

// Register global error listeners to forward webview/JS crashes to native Firebase Crashlytics
if (Capacitor.isNativePlatform()) {
  window.addEventListener("error", (event) => {
    mobileCrashlytics.recordError(
      event.message || "Unhandled JS Error",
      event.error?.stack || "",
      { filename: event.filename, lineno: event.lineno }
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;
    mobileCrashlytics.recordNonFatal(
      error instanceof Error ? error : new Error(String(error || "Unhandled Promise Rejection"))
    );
  });
}

export const initMobileServices = async (user) => {
  try {
    // 1. App Launch counter for In-App Review scheduling
    incrementLaunchCount();

    // 2. Initialize Product Analytics (PostHog works on web & mobile)
    initPostHog();

    if (!user) {
      console.log("Mobile Services: No user logged in yet. Delaying native config.");
      return;
    }

    const userId = user.id;

    // Identify user in analytics systems
    analytics.setUserId(userId);
    
    // Pass user metadata if available
    if (user.email) {
      analytics.setUserProperties({
        email: user.email,
        created_at: user.created_at || new Date().toISOString(),
      });
    }

    // 3. Initialize native mobile configurations
    if (Capacitor.isNativePlatform()) {
      console.log("Mobile Services: Configuring native platform integrations...");
      
      // Initialize Crashlytics identifier
      mobileCrashlytics.setUserId(userId);
      mobileCrashlytics.log("App opened on native platform.");

      // Initialize RevenueCat In-App Purchases
      await initRevenueCat(userId);

      // Initialize Firebase Push Notifications
      await setupMobileNotifications(userId);

      // Track mobile install/open
      analytics.logEvent("app_open_native", {
        platform: Capacitor.getPlatform(),
        version_code: "1.0.0", // Upgrade dynamically if needed
      });
    } else {
      console.log("Mobile Services: Web browser detected. Native services skipped.");
      analytics.logEvent("app_open_web");
    }

  } catch (error) {
    console.error("Mobile Services: Failed to initialize mobile infrastructure", error);
    if (Capacitor.isNativePlatform()) {
      mobileCrashlytics.recordNonFatal(error);
    }
  }
};
