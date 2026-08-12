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

let isSettingUp = false;
let hasSetup = false;

export const setupNotifications = async (userId) => {
  if (localStorage.getItem("nivora_notifications_enabled") === "false") {
    console.log("FCM Web: Notifications are disabled by user preference.");
    return;
  }
  if (isSettingUp || hasSetup) return;
  isSettingUp = true;
  try {
    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied.");
      return;
    }

    // 2. Get FCM Token using your VAPID key and active Service Worker registration
    let token;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
    } else {
      token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
    }

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
      
      // Visually display the notification when the web app is in the foreground
      if (Notification.permission === "granted" && payload.notification) {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(payload.notification.title, {
              body: payload.notification.body,
              icon: payload.notification.icon || 'https://streak-flow.netlify.app/logo192.png',
              badge: 'https://streak-flow.netlify.app/badge-flame.png'
            });
          }).catch((err) => {
            console.error("Failed to show foreground notification via SW:", err);
          });
        }
      }
    });

    hasSetup = true;
  } catch (error) {
    console.error("Error setting up FCM:", error);
  } finally {
    isSettingUp = false;
  }
};
