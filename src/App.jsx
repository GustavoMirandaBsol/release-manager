// src/App.jsx
import { useEffect, useRef, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import { getUserProfile, recordPortalAccess, signOut } from "./services/authService";
import { isSupabaseConfigured, supabase } from "./services/supabaseClient";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState(null);
  const loggedAccessRef = useRef(new Set());

  const logAccessOnce = (sessionUser) => {
    if (!sessionUser) return;

    const accessKey = sessionUser.id;
    const storageKey = `releaseManagerAccessLogged:${accessKey}`;

    if (!loggedAccessRef.current.has(accessKey) && !sessionStorage.getItem(storageKey)) {
      loggedAccessRef.current.add(accessKey);
      sessionStorage.setItem(storageKey, "true");
      recordPortalAccess(sessionUser, "login");
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const sessionUser = data.session?.user || null;
      setUser(sessionUser);
      setIsLoggedIn(Boolean(sessionUser));
      logAccessOnce(sessionUser);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      setIsLoggedIn(Boolean(sessionUser));

      if (sessionUser && event === "SIGNED_IN") {
        logAccessOnce(sessionUser);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      if (user?.id) {
        sessionStorage.removeItem(`releaseManagerAccessLogged:${user.id}`);
        loggedAccessRef.current.delete(user.id);
      }
      await signOut();
      setUser(null);
    }
    setIsLoggedIn(false);
  };

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Validando sesión...</p>
        </div>
      </div>
    );
  }

  return isLoggedIn ? (
    <Dashboard user={getUserProfile(user)} onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={() => setIsLoggedIn(true)} />
  );
}
