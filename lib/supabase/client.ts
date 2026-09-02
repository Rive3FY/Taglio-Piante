import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "rt.auth",
        },
      },
    );
    if (typeof window !== "undefined") {
      const auth = client.auth;
      const syncRefresh = () => {
        if (navigator.onLine) auth.startAutoRefresh();
        else auth.stopAutoRefresh();
      };
      syncRefresh();
      window.addEventListener("online", syncRefresh);
      window.addEventListener("offline", syncRefresh);
    }
  }
  return client;
}

export async function accessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
