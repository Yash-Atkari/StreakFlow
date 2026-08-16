# Nivora Mobile Infrastructure Guide

This document outlines the complete mobile infrastructure architecture integrated into StreakFlow. The architecture is optimized for **Capacitor + React + Supabase**, utilising environment-variable configurations, clean reusable services, proper error boundaries, privacy compliance, and native capabilities.

---

## 1. Directory Structure

The services are organised in a modular, clean architectural pattern under `src/services/mobile/`:

```
src/services/mobile/
├── mobileInit.js          # Central bootstrapper for all mobile services
├── posthog.js             # PostHog Product Analytics (WebView & native support)
├── firebaseAnalytics.js   # Firebase Analytics native tracker + PostHog mirror
├── firebaseCrashlytics.js # Firebase Crashlytics native error capture
├── firebaseMessaging.js   # Native FCM Push Notifications registration & listeners
├── appReview.js           # Google Play / Apple App Store In-App Reviews scheduling
└── revenueCat.js          # RevenueCat In-App Subscriptions & Play Billing
```

---

## 2. Environment Variables Configuration

Ensure the following variables are configured in your `.env` (development) and production systems:

```env
# RevenueCat API Keys
VITE_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxx

# PostHog Analytics
VITE_POSTHOG_API_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

---

## 3. Local Database & Supabase Integration

We have deployed migrations to support mobile sync features:
1. **FCM Tokens Sync (`fcm_tokens`)**: The table holds native device registration tokens and includes a `platform` column (`android` | `ios` | `web`) to allow platform-specific notification formatting.
2. **Subscription Sync (`user_subscriptions`)**: Syncs Google Play purchases recorded in RevenueCat back to Supabase, enabling cross-platform entitlements (e.g. users maintain premium status if logging onto the web browser).
3. **Dynamic Notification Targeting (`get_active_reminders`)**: Re-written as an optimized database RPC function to target:
   - **Daily reminders**: Sent at 8 PM local time.
   - **Streak at Risk alerts**: Sent if a habit has an active streak and is within 2 hours of its submission window closing.
   - **Milestone celebrations**: Triggered at 6 PM local time if the user completed a habit today and hit a milestone (3, 7, 15, 30, 50, 100 days).

---

## 4. Deploying the Notification Cron Job

The push notification engine runs on a cron schedule executing the Deno edge function.

### A. Set Edge Secrets
Run the following commands in the Supabase CLI to configure environment keys:
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"streakflow-1e44b",...}'
```

### B. Deploy Edge Function
Deploy the function using:
```bash
supabase functions deploy send-reminders
```

### C. Configure Cron Trigger
To run reminders hourly, create a cron trigger using pg_cron in your Supabase SQL editor:
```sql
SELECT cron.schedule(
  'send-hourly-reminders',
  '0 * * * *', -- runs at the start of every hour
  $$ SELECT net.http_post(
       'https://<project-ref>.supabase.co/functions/v1/send-reminders',
       '{}',
       '{}',
       '{"Content-Type": "application/json", "Authorization": "Bearer <service-anon-key>"}'
     ) $$
);
```

---

## 5. Platform Native Configurations

### Android Setup

1. **Google Services Config**: 
   Place the downloaded `google-services.json` file into `android/app/`.
2. **Build Settings**:
   Add the Firebase Gradle dependency to `android/build.gradle` and apply the plugin in `android/app/build.gradle`.
3. **FCM Background Setup**:
   Ensure `AndroidManifest.xml` includes permissions for receiving push notifications, background operation, and the default notification channel specifications.

### iOS Setup

1. **Google Services Config**: 
   Add the `GoogleService-Info.plist` to your Xcode project assets.
2. **Push Entitlements**:
   In Xcode, enable the **Push Notifications** and **Background Modes** (Remote Notifications) capabilities.
3. **FCM Setup**:
   Configure APNS certificates inside your Firebase Console, linking the APNS key to FCM.
