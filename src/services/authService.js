import { isSupabaseConfigured, supabase } from "./supabaseClient";

export function getUserProfile(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email || "",
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "Usuario",
    provider: user.app_metadata?.provider || "google",
  };
}

export async function getCurrentUserProfile() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  return getUserProfile(data.user);
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase no está configurado");
  }

  const redirectUrl = new URL(window.location.href);
  redirectUrl.hash = "";
  redirectUrl.search = "";

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl.toString(),
    },
  });

  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function recordPortalAccess(user, action = "login") {
  if (!isSupabaseConfigured || !supabase || !user) return;

  const profile = getUserProfile(user);
  const { error } = await supabase.from("portal_access_logs").insert({
    user_id: profile.id,
    email: profile.email,
    full_name: profile.name,
    provider: profile.provider,
    action,
    user_agent: window.navigator.userAgent,
  });

  if (error) {
    console.warn("No se pudo registrar el acceso al portal:", error.message);
  }
}

