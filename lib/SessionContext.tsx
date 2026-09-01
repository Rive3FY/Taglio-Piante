"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@/lib/types";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { ensureSeeded } from "@/lib/db";

type SessionContextValue = {
  session: Session | null;
  ready: boolean;
  setSession: (session: Session) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      if (cancelled) return;
      setSessionState(readSession());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      ready,
      setSession: (next) => {
        writeSession(next);
        setSessionState(next);
      },
      logout: () => {
        clearSession();
        setSessionState(null);
      },
    }),
    [session, ready],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve stare dentro SessionProvider");
  return ctx;
}
