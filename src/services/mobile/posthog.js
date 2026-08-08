import posthog from "posthog-js";
import { Capacitor } from "@capacitor/core";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn("PostHog API Key is missing. Skipping PostHog initialization.");
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true, // Automatically capture clicks, forms, etc.
      capture_pageview: true, // Automatically capture screen/page views
      persistence: "localStorage",
      loaded: (ph) => {
        // Boostrap user properties with platform info
        const isNative = Capacitor.isNativePlatform();
        const platform = Capacitor.getPlatform();
        ph.register({
          platform_type: isNative ? "mobile" : "web",
          app_platform: platform,
        });
      },
    });
    initialized = true;
    console.log("PostHog initialized successfully.");
  } catch (error) {
    console.error("Error initializing PostHog:", error);
  }
};

export const posthogService = {
  identify: (userId, properties = {}) => {
    if (!initialized) return;
    try {
      posthog.identify(userId, properties);
    } catch (e) {
      console.error("PostHog identify error", e);
    }
  },

  track: (event, properties = {}) => {
    if (!initialized) return;
    try {
      posthog.capture(event, properties);
    } catch (e) {
      console.error("PostHog capture error", e);
    }
  },

  screen: (screenName, properties = {}) => {
    if (!initialized) return;
    try {
      posthog.capture("$pageview", {
        $current_url: screenName,
        ...properties,
      });
    } catch (e) {
      console.error("PostHog screen view track error", e);
    }
  },

  reset: () => {
    if (!initialized) return;
    try {
      posthog.reset();
    } catch (e) {
      console.error("PostHog reset error", e);
    }
  },
};
