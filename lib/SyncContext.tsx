"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { processSyncQueue, purgaRapportiniAltrui, subscribeOnline, voceCodaDiQuestoAccount } from "@/lib/sync";
import { useSession } from "@/lib/SessionContext";

type SyncContextValue = {
  online: boolean;
  pending: number;
  lastError: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  syncNow: (opts?: { completo?: boolean }) => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const { session } = useSession();
  const userId = session?.userId;
  const codaRaw = useLiveQuery(() => db.syncQueue.orderBy("createdAt").toArray(), []);
  const coda = Array.isArray(codaRaw) ? codaRaw : [];
  const fogliRaw = useLiveQuery(() => db.rapportini.toArray(), []);
  const fogli = Array.isArray(fogliRaw) ? fogliRaw : [];
  const codaMia = coda.filter((item) => voceCodaDiQuestoAccount(item, session, fogli));
  const pending = codaMia.length;
  const queueError = codaMia.find((item) => item.lastError)?.lastError ?? null;
  const lastError = queueError ?? pullError;

  const syncNow = useCallback(async (opts: { completo?: boolean } = {}) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await processSyncQueue(opts);
      setPullError(result.pullError);
      if (result.processed > 0 || result.pulled > 0 || result.pending === 0) {
        setLastSyncAt(new Date().toISOString());
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncNow();
    };
    const unsub = subscribeOnline(refresh);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, 20_000);
    const onVisibile = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
    };
    document.addEventListener("visibilitychange", onVisibile);
    return () => {
      unsub();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibile);
    };
  }, [syncNow]);

  /* Non aspetta il tocco sulla pillola: se c’è coda e c’è rete, parte da solo. */
  useEffect(() => {
    if (pending === 0) return;
    if (!online) return;
    const delay = lastError ? 12_000 : 500;
    const t = window.setTimeout(() => {
      void syncNow();
    }, delay);
    return () => window.clearTimeout(t);
  }, [pending, lastError, online, syncNow]);

  // Una passata sola quando entra un account: la sessione si aggiorna due volte
  // all'avvio (copia locale, poi conferma online) e non deve ripartire da capo.
  const ultimoUtente = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) {
      ultimoUtente.current = null;
      return;
    }
    if (ultimoUtente.current === userId) return;
    ultimoUtente.current = userId;
    void (async () => {
      await purgaRapportiniAltrui(session);
      await syncNow();
    })();
  }, [userId, session, syncNow]);

  const value = useMemo(
    () => ({ online, pending, lastError, lastSyncAt, syncing, syncNow }),
    [online, pending, lastError, lastSyncAt, syncing, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync deve stare dentro SyncProvider");
  return ctx;
}
