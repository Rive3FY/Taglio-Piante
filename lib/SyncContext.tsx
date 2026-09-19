"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { type StatoRete, sottoscriviRete, statoRete } from "@/lib/net";
import { processSyncQueue, purgaRapportiniAltrui, voceCodaDiQuestoAccount } from "@/lib/sync";
import { clearPullCursor } from "@/lib/supabase/remote";
import { useSession } from "@/lib/SessionContext";

const ULTIMO_SCAMBIO_KEY = "rt.ultimoScambio";
/** Con la coda vuota basta un giro ogni tanto, serve solo a leggere le novità. */
const RITMO_LETTURA_MS = 120_000;
/** Con roba da mandare si insiste, ma non a raffica. */
const RITMO_INVIO_MS = 6_000;
/** Con linea ballerina si rallenta invece di collezionare scadenze. */
const RITMO_INSTABILE_MS = 30_000;
const RITMO_MAX_MS = 5 * 60_000;

type SyncContextValue = {
  /** «instabile» è il caso vero sul campo: il telefono crede di avere rete ma non passa nulla. */
  stato: StatoRete;
  online: boolean;
  pending: number;
  bloccate: number;
  lastError: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  syncNow: (opts?: { manuale?: boolean }) => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * «Quando è partito l'ultimo invio» deve sopravvivere alla chiusura dell'app:
 * è la risposta alla domanda che l'operatore si fa davvero sul campo, cioè se
 * il foglio di stamattina è arrivato o no.
 */
let ultimoScambio: string | null =
  typeof window === "undefined"
    ? null
    : (() => {
        try {
          return localStorage.getItem(ULTIMO_SCAMBIO_KEY);
        } catch {
          return null;
        }
      })();

const ascoltatoriScambio = new Set<() => void>();

function leggiUltimoScambio() {
  return ultimoScambio;
}

function sottoscriviScambio(cb: () => void) {
  ascoltatoriScambio.add(cb);
  return () => {
    ascoltatoriScambio.delete(cb);
  };
}

function registraScambio(iso: string) {
  ultimoScambio = iso;
  try {
    localStorage.setItem(ULTIMO_SCAMBIO_KEY, iso);
  } catch {
    // spazio esaurito: si perde solo l'orario mostrato
  }
  for (const cb of ascoltatoriScambio) cb();
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const stato = useSyncExternalStore(sottoscriviRete, statoRete, () => "online" as StatoRete);
  const online = stato !== "offline";

  const [syncing, setSyncing] = useState(false);
  const lastSyncAt = useSyncExternalStore(sottoscriviScambio, leggiUltimoScambio, () => null);
  const [pullError, setPullError] = useState<string | null>(null);
  const { session } = useSession();
  const userId = session?.userId;

  const codaRaw = useLiveQuery(() => db.syncQueue.orderBy("createdAt").toArray(), []);
  const coda = useMemo(() => (Array.isArray(codaRaw) ? codaRaw : []), [codaRaw]);
  const fogliRaw = useLiveQuery(() => db.rapportini.toArray(), []);
  const fogli = useMemo(() => (Array.isArray(fogliRaw) ? fogliRaw : []), [fogliRaw]);

  const codaMia = useMemo(
    () => coda.filter((item) => voceCodaDiQuestoAccount(item, session, fogli)),
    [coda, session, fogli],
  );
  const pending = codaMia.length;
  const bloccate = codaMia.filter((item) => item.bloccato).length;
  const queueError = codaMia.find((item) => item.lastError)?.lastError ?? null;
  const lastError = pullError ?? queueError;

  const syncNow = useCallback(async (opts?: { manuale?: boolean }) => {
    setSyncing(true);
    try {
      const result = await processSyncQueue(opts);
      setPullError(result.pullError);
      if (result.processed > 0 || result.pulled > 0 || (!result.interrotta && !result.pullError)) {
        registraScambio(new Date().toISOString());
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  /**
   * Quando ha senso riprovare. Prima era un timer fisso ogni 20 secondi: con
   * poca linea significava una scadenza dietro l'altra, con la coda vuota
   * significava rileggere l'intero archivio tre volte al minuto.
   */
  const prontoDa = useMemo<number | "lettura" | null>(() => {
    if (stato === "offline") return null;
    const daRiprovare = codaMia.filter((i) => !i.bloccato);
    if (daRiprovare.length === 0) return "lettura";
    return Math.min(
      ...daRiprovare.map((i) => (i.nextAttemptAt ? new Date(i.nextAttemptAt).getTime() : 0)),
    );
  }, [stato, codaMia]);

  useEffect(() => {
    if (prontoDa === null) return;
    const minimo = stato === "instabile" ? RITMO_INSTABILE_MS : RITMO_INVIO_MS;
    const attesa =
      prontoDa === "lettura"
        ? RITMO_LETTURA_MS
        : Math.min(Math.max(prontoDa - Date.now(), minimo), RITMO_MAX_MS);

    const t = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      void syncNow();
    }, attesa);
    return () => window.clearTimeout(t);
    // lastSyncAt e syncing entrano di proposito: a giro concluso si riprogramma il successivo
  }, [prontoDa, stato, lastSyncAt, syncing, syncNow]);

  // Ritorno del segnale e ritorno in primo piano: sono i due momenti in cui
  // l'utente si aspetta che parta subito, senza toccare niente.
  useEffect(() => {
    const appenaTornati = () => {
      if (navigator.onLine && document.visibilityState === "visible") void syncNow();
    };
    const boot = window.setTimeout(appenaTornati, 1500);
    window.addEventListener("online", appenaTornati);
    document.addEventListener("visibilitychange", appenaTornati);
    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("online", appenaTornati);
      document.removeEventListener("visibilitychange", appenaTornati);
    };
  }, [syncNow]);

  // Dopo il login serve una passata subito, altrimenti i dati arrivano solo al giro successivo.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      clearPullCursor();
      await purgaRapportiniAltrui(session);
      await syncNow();
    })();
  }, [userId, session, syncNow]);

  const value = useMemo(
    () => ({ stato, online, pending, bloccate, lastError, lastSyncAt, syncing, syncNow }),
    [stato, online, pending, bloccate, lastError, lastSyncAt, syncing, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync deve stare dentro SyncProvider");
  return ctx;
}
