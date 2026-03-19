// services/fcmService.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabaseClient";

const firebaseConfig = { 
  // apiKey: "AIzaSyAeDj9rruFAACp-w0rEDkMO5rLyzgz76mg",
  // authDomain: "streakflow-df8d6.firebaseapp.com",
  // projectId: "streakflow-df8d6",
  // storageBucket: "streakflow-df8d6.firebasestorage.app",
  // messagingSenderId: "342195661254",
  // appId: "1:342195661254:web:309978004dd21a9bf7aac7"
 };
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const setupNotifications = async (userId) => {
  try {
    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // 2. Get FCM Token
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    if (token) {
      // 3. Save Token to Supabase
      // Use upsert so we don't create duplicate tokens for the same user/device
      await supabase
        .from("fcm_tokens")
        .upsert({ user_id: userId, token: token }, { onConflict: 'token' });
    }

    // 4. Handle Foreground Messages
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      // You could trigger a custom toast or UI update here
    });

  } catch (error) {
    console.error("Error setting up FCM:", error);
  }
};
