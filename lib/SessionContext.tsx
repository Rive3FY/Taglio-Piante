"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import type { Ruolo, Session } from "@/lib/types";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { ensureSeeded } from "@/lib/db";
import { SCADENZA_AUTH, conScadenza, eDiRete, messaggioErrore } from "@/lib/net";
import { clearPullCursor } from "@/lib/supabase/remote";
import { accessoRifiutato, getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

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

function dispositivoOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

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

    /** Tiene aperta l'app con la copia locale invece di riportare al login. */
    function restaConCopiaLocale() {
      const cache = readSession();
      if (cache && !annullato) {
        setSessionState(cache);
        setOffline(true);
      }
    }

    async function confermaOnline() {
      if (!supabase || dispositivoOffline() || annullato) return;
      try {
        const { data } = await conScadenza(supabase.auth.getSession(), SCADENZA_AUTH, "Il login");
        if (annullato) return;
        let auth = data.session;

        if (!auth) {
          // Rinnovo non riuscito: buttare fuori l'utente ha senso solo se è
          // stato il server a rifiutare. Se è mancata la linea, l'app resta
          // aperta sulla copia locale, altrimenti il lavoro non ancora inviato
          // finisce dietro una schermata di accesso che senza rete non si passa.
          let rifiutato = false;
          try {
            const { data: refreshed, error } = await conScadenza(
              supabase.auth.refreshSession(),
              SCADENZA_AUTH,
              "Il rinnovo dell’accesso",
            );
            if (error) rifiutato = accessoRifiutato(error.message);
            else auth = refreshed.session ?? null;
          } catch (errore) {
            rifiutato = !eDiRete(errore) && accessoRifiutato(messaggioErrore(errore));
          }

          if (!auth && !rifiutato) {
            restaConCopiaLocale();
            return;
          }
          if (!auth) {
            clearSession();
            setSessionState(null);
            setOffline(false);
            return;
          }
        }

        const profilo = await conScadenza(profiloDaSupabase(auth), SCADENZA_AUTH, "Il profilo");
        if (annullato) return;
        writeSession(profilo);
        setSessionState(profilo);
        setOffline(false);
      } catch {
        restaConCopiaLocale();
      }
    }

    (async () => {
      try {
        await conScadenza(ensureSeeded(), 8000, "L’archivio locale").catch(() => undefined);
        if (annullato) return;

        const cache = readSession();
        if (cache) {
          setSessionState(cache);
          setOffline(true);
        } else if (!supabase) {
          clearSession();
        }

        // Con profilo locale l'app deve aprirsi subito: getSession/refresh
        // di Supabase in assenza di rete non falliscono, restano in attesa.
        if (cache) {
          setReady(true);
          if (!dispositivoOffline()) void confermaOnline();
          return;
        }

        if (!supabase || dispositivoOffline()) {
          return;
        }

        await confermaOnline();
        if (!annullato && !readSession()) clearSession();
      } finally {
        if (!annullato) setReady(true);
      }
    })();

    const { data: listener } = supabase
      ? supabase.auth.onAuthStateChange((event) => {
          if (event !== "SIGNED_OUT") return;
          void (async () => {
            if (dispositivoOffline()) {
              const cache = readSession();
              if (cache) {
                setSessionState(cache);
                setOffline(true);
              }
              return;
            }
            try {
              const { data: refreshed } = await conScadenza(
                supabase.auth.refreshSession(),
                SCADENZA_AUTH,
                "Il rinnovo dell’accesso",
              );
              if (refreshed.session) {
                const profilo = await conScadenza(
                  profiloDaSupabase(refreshed.session),
                  SCADENZA_AUTH,
                  "Il profilo",
                );
                writeSession(profilo);
                setSessionState(profilo);
                setOffline(false);
                return;
              }
            } catch (errore) {
              // Caduta la linea a metà rinnovo: l'app resta aperta sulla copia locale.
              if (eDiRete(errore)) {
                const cache = readSession();
                if (cache) {
                  setSessionState(cache);
                  setOffline(true);
                  return;
                }
              }
            }
            clearSession();
            setSessionState(null);
            setOffline(false);
          })();
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
    if (dispositivoOffline()) {
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
    clearPullCursor();
    setSessionState(null);
    setOffline(false);
    if (supabase) {
      try {
        await conScadenza(supabase.auth.signOut(), SCADENZA_AUTH, "L’uscita");
      } catch {
        // anche senza rete l'uscita locale deve completarsi
      }
    }
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
