// services/fcmService.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabaseClient";

// Using Vite environment variables to secure your configuration
const firebaseConfig = { 
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
 
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const setupNotifications = async (userId) => {
  try {
    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied.");
      return;
    }

    // 2. Get FCM Token using your new VAPID key
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    if (token) {
      // 3. Save Token to Supabase
      // The 'onConflict' ensures we don't spam the table with duplicate tokens
      const { error } = await supabase
        .from("fcm_tokens")
        .upsert(
          { user_id: userId, token: token }, 
          { onConflict: 'token' }
        );

      if (error) throw error;
      console.log("FCM Token synced successfully.");
    }

    // 4. Handle Foreground Messages
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      // Optional: Add a toast notification library here to show a UI alert
    });

  } catch (error) {
    console.error("Error setting up FCM:", error);
  }
};
