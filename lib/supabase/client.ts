import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SCADENZA_AUTH, SCADENZA_DATI, SCADENZA_FILE, fetchConScadenza } from "@/lib/net";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function scadenzaPer(input: RequestInfo | URL) {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/storage/v1/")) return SCADENZA_FILE;
  if (url.includes("/auth/v1/")) return SCADENZA_AUTH;
  return SCADENZA_DATI;
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
        global: {
          // Senza questa la libreria usa la fetch nuda, che non ha scadenza:
          // con poca linea una singola chiamata può restare appesa per minuti.
          fetch: (input, init) => fetchConScadenza(input, init, scadenzaPer(input)),
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

/**
 * Il server ha detto di no, oppure non ha detto niente? Sono due cose diverse:
 * solo la prima giustifica riportare l'utente alla schermata di accesso.
 */
export function accessoRifiutato(messaggio: string) {
  return /invalid[_ ]grant|refresh[_ ]token|already used|not found|invalid token|jwt expired|unauthorized/i.test(
    messaggio,
  );
}

export async function accessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
