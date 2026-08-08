import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { mobileCrashlytics } from "./firebaseCrashlytics";
import { analytics } from "./analytics";

const REVENUECAT_ANDROID_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;
const REVENUECAT_IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;

const isNative = Capacitor.isNativePlatform();
let rcConfigured = false;

export const initRevenueCat = async (userId) => {
  if (!isNative) {
    console.log("RevenueCat: Native purchases not available on web.");
    return;
  }

  const platform = Capacitor.getPlatform();
  const apiKey = platform === "android" ? REVENUECAT_ANDROID_KEY : REVENUECAT_IOS_KEY;

  if (!apiKey) {
    console.warn(`RevenueCat: API Key is missing for platform '${platform}'. Purchases cannot be configured.`);
    return;
  }

  try {
    // 1. Configure RevenueCat with API Key and optional App User ID
    await Purchases.configure({
      apiKey: apiKey,
      appUserID: userId,
    });
    rcConfigured = true;
    console.log("RevenueCat: Purchases configured successfully.");

    // 2. Identify the user
    await Purchases.logIn({ appUserID: userId });
    console.log("RevenueCat: Identified user:", userId);

  } catch (error) {
    console.error("RevenueCat: Configuration failed", error);
    mobileCrashlytics.recordNonFatal(error, { userId, platform });
  }
};

export const revenueCatService = {
  isConfigured: () => rcConfigured,

  checkPremiumStatus: async () => {
    if (!isNative || !rcConfigured) return false;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      // Check active entitlements (assuming entitlement ID is "premium")
      const entitlements = customerInfo?.entitlements?.active;
      const isPremium = entitlements && entitlements["premium"] !== undefined;
      console.log("RevenueCat: Active premium entitlement status:", isPremium);
      return isPremium;
    } catch (error) {
      console.error("RevenueCat: Failed to check customer info", error);
      mobileCrashlytics.recordNonFatal(error);
      return false;
    }
  },

  getOfferings: async () => {
    if (!isNative || !rcConfigured) return null;
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        return offerings.current.availablePackages;
      }
      return [];
    } catch (error) {
      console.error("RevenueCat: Failed to get offerings", error);
      mobileCrashlytics.recordNonFatal(error);
      return [];
    }
  },

  purchasePackage: async (packageToPurchase) => {
    if (!isNative || !rcConfigured) {
      throw new Error("RevenueCat: Native purchases not initialized.");
    }
    try {
      console.log("RevenueCat: Purchase package starting...", packageToPurchase);
      const purchaseResult = await Purchases.purchasePackage({
        aPackage: packageToPurchase,
      });

      const customerInfo = purchaseResult?.customerInfo;
      const entitlements = customerInfo?.entitlements?.active;
      const isPremium = entitlements && entitlements["premium"] !== undefined;

      if (isPremium) {
        // Track the purchase
        analytics.logPremiumConversion(
          packageToPurchase.identifier,
          packageToPurchase.product.price
        );
      }

      return isPremium;
    } catch (error) {
      // Check if user cancelled
      if (error.userCancelled) {
        console.log("RevenueCat: User cancelled purchase.");
        return false;
      }
      console.error("RevenueCat: Purchase failed", error);
      mobileCrashlytics.recordNonFatal(error, { packageToPurchase });
      throw error;
    }
  },

  restorePurchases: async () => {
    if (!isNative || !rcConfigured) return false;
    try {
      console.log("RevenueCat: Restoring purchases...");
      const customerInfo = await Purchases.restorePurchases();
      const entitlements = customerInfo?.entitlements?.active;
      const isPremium = entitlements && entitlements["premium"] !== undefined;
      return isPremium;
    } catch (error) {
      console.error("RevenueCat: Restore failed", error);
      mobileCrashlytics.recordNonFatal(error);
      return false;
    }
  },
};
