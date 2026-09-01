"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { processSyncQueue, subscribeOnline } from "@/lib/sync";

type SyncContextValue = {
  online: boolean;
  pending: number;
  lastSyncAt: string | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const pending = useLiveQuery(() => db.syncQueue.count(), []) ?? 0;

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await processSyncQueue();
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
    const bootTimer = window.setTimeout(() => {
      if (navigator.onLine) void syncNow();
    }, 2000);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, 45000);
    return () => {
      unsub();
      window.clearTimeout(bootTimer);
      window.clearInterval(timer);
    };
  }, [syncNow]);

  const value = useMemo(
    () => ({ online, pending, lastSyncAt, syncing, syncNow }),
    [online, pending, lastSyncAt, syncing, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync deve stare dentro SyncProvider");
  return ctx;
}
