import { useEffect, useState } from "react";
import { supabase } from "./services/supabaseClient";
import { Capacitor } from "@capacitor/core";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import { PremiumProvider } from "./contexts/PremiumContext";
import { DialogProvider } from "./contexts/DialogContext";

import { initMobileServices } from "./services/mobile/mobileInit";

export default function App() {
  const [user, setUser] = useState(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    initMobileServices(user);
  }, [user]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveryMode(true);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <DialogProvider>
      <div className="bg-black min-h-screen text-white">
        {isRecoveryMode ? (
          <ResetPassword onComplete={() => setIsRecoveryMode(false)} />
        ) : user ? (
          <PremiumProvider user={user}>
            <Home user={user} />
          </PremiumProvider>
        ) : (
          <Login />
        )}
      </div>
    </DialogProvider>
  );
}
