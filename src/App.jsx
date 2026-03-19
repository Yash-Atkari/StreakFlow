import { useEffect, useState } from "react";
import { supabase } from "./services/supabaseClient";
import Home from "./pages/Home";
import Login from "./pages/Login";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // Listen to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setUser(session?.user || null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div className="bg-black min-h-screen text-white">
      {user ? <Home /> : <Login />}
    </div>
  );
}
