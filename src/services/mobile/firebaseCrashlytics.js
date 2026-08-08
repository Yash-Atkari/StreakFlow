import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

export const mobileCrashlytics = {
  recordError: async (message, stackTrace = "", context = {}) => {
    console.error(`[Crashlytics Record] ${message}`, stackTrace, context);

    if (isNative) {
      try {
        // Firebase Crashlytics expects message and stack trace string or error structure
        await FirebaseCrashlytics.recordUncaughtException({
          message: `${message} [Context: ${JSON.stringify(context)}]`,
          stacktrace: stackTrace || new Error().stack || "",
        });
      } catch (e) {
        console.error("Firebase Crashlytics: recordUncaughtException error", e);
      }
    }
  },

  recordNonFatal: async (error, context = {}) => {
    console.warn("[Crashlytics Non-Fatal]:", error, context);

    if (isNative) {
      try {
        await FirebaseCrashlytics.recordException({
          message: error?.message || String(error),
          stacktrace: error?.stack || new Error().stack || "",
        });
      } catch (e) {
        console.error("Firebase Crashlytics: recordException error", e);
      }
    }
  },

  log: async (message) => {
    console.log(`[Crashlytics Log]: ${message}`);

    if (isNative) {
      try {
        await FirebaseCrashlytics.log({ message });
      } catch (e) {
        console.error("Firebase Crashlytics: log error", e);
      }
    }
  },

  setUserId: async (userId) => {
    if (isNative) {
      try {
        await FirebaseCrashlytics.setUserId({ userId });
      } catch (e) {
        console.error("Firebase Crashlytics: setUserId error", e);
      }
    }
  },
};
