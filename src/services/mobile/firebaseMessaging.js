import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabaseClient";
import { mobileCrashlytics } from "./firebaseCrashlytics";

const isNative = Capacitor.isNativePlatform();

export const setupMobileNotifications = async (userId) => {
  if (localStorage.getItem("nivora_notifications_enabled") === "false") {
    console.log("FCM Mobile: Notifications are disabled by user preference.");
    return;
  }
  if (!isNative) {
    console.log("FCM Mobile: Skipping native push notifications setup on web.");
    return;
  }

  try {
    // 1. Request Push Notification Permissions
    const permissionStatus = await FirebaseMessaging.requestPermissions();
    if (permissionStatus.receive !== "granted") {
      console.warn("FCM Mobile: Permission denied by user.");
      mobileCrashlytics.log("Push notifications permission denied by user.");
      return;
    }

    // 2. Register with APNS (iOS only)
    // On iOS, the native APNS registration must be completed. On Android, this is handled automatically.
    if (Capacitor.getPlatform() === "ios") {
      await FirebaseMessaging.register();
    }

    // 3. Get FCM Token
    const result = await FirebaseMessaging.getToken();
    const token = result.token;

    if (token) {
      console.log("FCM Mobile: Obtained token:", token);
      
      // Save FCM Token to Supabase
      const { error } = await supabase
        .from("fcm_tokens")
        .upsert(
          { user_id: userId, token: token, platform: Capacitor.getPlatform() }, 
          { onConflict: 'token' }
        );

      if (error) {
        console.error("FCM Mobile: Supabase token sync failed", error.message || JSON.stringify(error) || error);
        mobileCrashlytics.recordNonFatal(new Error(`Supabase token sync failed: ${error.message || JSON.stringify(error)}`), { userId, token });
      } else {
        console.log("FCM Mobile: Token synced to Supabase successfully.");
      }
    }

    // 4. Set Up Listeners
    // Handle notification received while app is in foreground
    await FirebaseMessaging.addListener("notificationReceived", (event) => {
      console.log("FCM Mobile: Notification received in foreground:", event);
      // You can trigger custom in-app alerts here or show a top bar banner
    });

    // Handle user clicking/tapping on a notification
    await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      console.log("FCM Mobile: Notification click action performed:", event);
      // Navigate to a specific screen based on event.notification.data if needed
    });

  } catch (error) {
    console.error("FCM Mobile: Failed to setup mobile notifications", error);
    mobileCrashlytics.recordNonFatal(error, { userId });
  }
};
