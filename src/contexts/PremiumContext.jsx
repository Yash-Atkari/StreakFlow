import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { useDialog } from "./DialogContext";
import { revenueCatService } from "../services/mobile/revenueCat";
import { Capacitor } from "@capacitor/core";

const PremiumContext = createContext({
  user: null,
  isPremium: false,
  shieldsCount: 0,
  loading: true,
  refreshPremium: () => {},
  unlockPremium: () => {},
  buyShields: () => {},
  useShieldPass: async () => false,
  restorePurchases: async () => false
});

export function PremiumProvider({ children, user }) {
  const { alert } = useDialog();
  const [isPremium, setIsPremium] = useState(true); // Default to true for launch phase
  const [shieldsCount, setShieldsCount] = useState(3); // Start with at least 3 shields
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setIsPremium(true);
      setShieldsCount(0);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Supabase Subscription
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      let premiumStatus = true; // Force premium status to true
      let shields = 3; // Default starting shields to 3

      if (data) {
        shields = data.streak_shields;
      } else {
        // Fallback checks
        const localShields = parseInt(localStorage.getItem(`streakflow_shields_fallback_${user.id}`) || "3", 10);

        const { data: newRow, error: insertError } = await supabase
          .from("user_subscriptions")
          .insert([{ user_id: user.id, is_premium: true, streak_shields: localShields }])
          .select()
          .single();

        if (!insertError && newRow) {
          shields = newRow.streak_shields;
        }
      }

      // 2. Override subscription check on native platform with RevenueCat Entitlements
      if (Capacitor.isNativePlatform() && revenueCatService.isConfigured()) {
        const rcPremium = await revenueCatService.checkPremiumStatus();
        if (rcPremium) {
          // Sync back to Supabase if it wasn't marked premium
          if (data && !data.is_premium) {
            await supabase
              .from("user_subscriptions")
              .update({ is_premium: true, streak_shields: data.streak_shields + 3 })
              .eq("user_id", user.id);
            shields += 3;
          }
        }
      }

      setIsPremium(true);
      setShieldsCount(shields);

    } catch (err) {
      console.warn("DB subscription load warning, falling back to local metadata/cache:", err);
      const localShields = parseInt(localStorage.getItem(`streakflow_shields_fallback_${user.id}`) || "3", 10);
      setIsPremium(true);
      setShieldsCount(localShields);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const unlockPremium = async () => {
    if (!user) return;

    if (Capacitor.isNativePlatform() && revenueCatService.isConfigured()) {
      try {
        const offerings = await revenueCatService.getOfferings();
        if (offerings && offerings.length > 0) {
          // Buy the first package available
          const success = await revenueCatService.purchasePackage(offerings[0]);
          if (success) {
            setIsPremium(true);
            setShieldsCount((prev) => prev + 3);
            await supabase
              .from("user_subscriptions")
              .upsert({ user_id: user.id, is_premium: true, streak_shields: shieldsCount + 3 });
            await alert("Premium Unlocked! Streak insurance credited.", "Welcome Premium");
          }
        } else {
          await alert("No packages found on Google Play Store. Verify store setup.", "Offers Missing");
        }
      } catch (err) {
        console.error("RevenueCat purchase error", err);
        await alert("Transaction failed. Make sure your Play Store account is active.", "Billing Issue");
      }
      return;
    }

    // Web Fallback
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .upsert({ user_id: user.id, is_premium: true, streak_shields: shieldsCount + 3 });

      if (error) throw error;
      setIsPremium(true);
      setShieldsCount((prev) => prev + 3);
    } catch (err) {
      console.warn("Unlock DB upsert failed, using fallback:", err);
      localStorage.setItem(`streakflow_premium_fallback_${user.id}`, "true");
      localStorage.setItem(`streakflow_shields_fallback_${user.id}`, String(shieldsCount + 3));
      setIsPremium(true);
      setShieldsCount((prev) => prev + 3);
    }
  };

  const buyShields = async (count = 3) => {
    if (!user) return;
    const newCount = shieldsCount + count;
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ streak_shields: newCount })
        .eq("user_id", user.id);

      if (error) throw error;
      setShieldsCount(newCount);
    } catch (err) {
      console.warn("Update DB shield count failed, using fallback:", err);
      localStorage.setItem(`streakflow_shields_fallback_${user.id}`, String(newCount));
      setShieldsCount(newCount);
    }
  };

  const useShieldPass = async (ritualId) => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc("apply_streak_shield", {
        ritual_id_param: ritualId
      });

      if (error) throw error;

      setShieldsCount(data.remaining_shields);
      return true;
    } catch (err) {
      console.warn("RPC apply_streak_shield missing, running client fallback:", err);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { error: logError } = await supabase.from("habit_logs").insert([{
        ritual_id: ritualId,
        completed_at: yesterday.toISOString(),
        user_id: user.id
      }]);

      if (logError) {
        await alert("Failed to insert log: " + logError.message, "Database Error");
        return false;
      }

      await supabase.rpc("reset_missed_streaks");
      await buyShields(-1);
      return true;
    }
  };

  const restorePurchases = async () => {
    if (Capacitor.isNativePlatform() && revenueCatService.isConfigured()) {
      try {
        const active = await revenueCatService.restorePurchases();
        if (active) {
          setIsPremium(true);
          await supabase
            .from("user_subscriptions")
            .upsert({ user_id: user.id, is_premium: true });
          await alert("Purchases restored! Active entitlements synced.", "Restored");
          return true;
        } else {
          await alert("No active subscriptions found for this account.", "No Active Purchases");
          return false;
        }
      } catch (e) {
        console.error("Restore purchases error", e);
        return false;
      }
    }
    return false;
  };

  return (
    <PremiumContext.Provider value={{
      user,
      isPremium: isPremium,
      shieldsCount,
      loading,
      refreshPremium: fetchSubscription,
      unlockPremium,
      buyShields,
      useShieldPass,
      restorePurchases
    }}>
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => useContext(PremiumContext);
