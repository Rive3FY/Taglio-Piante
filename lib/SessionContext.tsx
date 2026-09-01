"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import type { Ruolo, Session } from "@/lib/types";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { ensureSeeded } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type SessionContextValue = {
  session: Session | null;
  ready: boolean;
  /** true quando l'accesso è ripreso dalla copia locale perché il dispositivo è offline. */
  offline: boolean;
  configurato: boolean;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function profiloDaSupabase(auth: SupabaseSession): Promise<Session> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non configurato.");

  const { data, error } = await supabase
    .from("profili")
    .select("user_id, nome, email, ruolo")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Account senza profilo: chiedi al tecnico di ricreare l’utenza dalla sezione Operatori.",
    );
  }

  return {
    userId: data.user_id as string,
    nome: data.nome as string,
    email: data.email as string,
    ruolo: data.ruolo as Ruolo,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const configurato = isSupabaseConfigured();

  useEffect(() => {
    let annullato = false;
    const supabase = getSupabase();

    (async () => {
      await ensureSeeded();
      if (annullato) return;

      if (!supabase) {
        setReady(true);
        return;
      }

      const cache = readSession();
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        try {
          const profilo = await profiloDaSupabase(data.session);
          if (annullato) return;
          writeSession(profilo);
          setSessionState(profilo);
          setOffline(false);
        } catch {
          // Sessione valida ma profilo non raggiungibile: si prosegue con la copia locale.
          if (cache) {
            setSessionState(cache);
            setOffline(true);
          }
        }
      } else if (cache && typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline: si riapre l'ultimo accesso per non bloccare il lavoro sul campo.
        setSessionState(cache);
        setOffline(true);
      } else {
        clearSession();
      }

      if (!annullato) setReady(true);
    })();

    const { data: listener } = supabase
      ? supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") {
            clearSession();
            setSessionState(null);
            setOffline(false);
          }
        })
      : { data: { subscription: null } };

    return () => {
      annullato = true;
      listener.subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase non è configurato su questo dispositivo.");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Serve la rete per accedere. Riprova quando hai segnale.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.session) {
      throw new Error(
        error?.message?.toLowerCase().includes("invalid")
          ? "Email o password non corrette."
          : (error?.message ?? "Accesso non riuscito."),
      );
    }

    const profilo = await profiloDaSupabase(data.session);
    writeSession(profilo);
    setSessionState(profilo);
    setOffline(false);
    return profilo;
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabase();
    clearSession();
    setSessionState(null);
    setOffline(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, ready, offline, configurato, login, logout }),
    [session, ready, offline, configurato, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve stare dentro SessionProvider");
  return ctx;
}
