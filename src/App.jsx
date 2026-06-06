import { useEffect, useState } from "react";
import { supabase } from "./services/supabaseClient";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  const [user, setUser] = useState(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // Listen to auth changes
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
    <div className="bg-black min-h-screen text-white">
      {isRecoveryMode ? (
        <ResetPassword onComplete={() => setIsRecoveryMode(false)} />
      ) : user ? (
        <Home user={user} />
      ) : (
        <Login />
      )}
    </div>
  );
}
