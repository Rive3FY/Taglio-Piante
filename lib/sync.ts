import { db } from "@/lib/db";
import { rapportinoVisibile } from "@/lib/sezioni";
import type { Session } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteRemoteRapportino,
  pullDeletedRapportini,
  pullRapportini,
  pullReferenceData,
  pushCampatePending,
  pushRapportino,
  supabaseAutenticato,
} from "@/lib/supabase/remote";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SyncResult = { processed: number; pending: number; pulled: number };

let syncInCorso: Promise<SyncResult> | null = null;

export async function processSyncQueue() {
  if (syncInCorso) return syncInCorso;
  syncInCorso = eseguiSyncQueue().finally(() => {
    syncInCorso = null;
  });
  return syncInCorso;
}

async function eseguiSyncQueue(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, pending: await db.syncQueue.count(), pulled: 0 };
  }

  const autenticato = await supabaseAutenticato();
  if (isSupabaseConfigured() && !autenticato) {
    return { processed: 0, pending: await db.syncQueue.count(), pulled: 0 };
  }

  const items = await db.syncQueue.orderBy("createdAt").toArray();
  let processed = 0;

  for (const item of items) {
    try {
      if (autenticato) {
        if (item.action === "delete") {
          await deleteRemoteRapportino(item.rapportinoId);
        } else if (item.action === "campate") {
          await pushCampatePending(item.rapportinoId);
        } else {
          const rapportino = await db.rapportini.get(item.rapportinoId);
          if (!rapportino) {
            await db.syncQueue.delete(item.id);
            continue;
          }
          await pushRapportino(rapportino);
        }
      } else {
        await delay(180);
      }

      await db.syncQueue.delete(item.id);
      processed += 1;

      if (item.action !== "delete") {
        const restanti = await db.syncQueue.where("rapportinoId").equals(item.rapportinoId).toArray();
        await db.rapportini.update(item.rapportinoId, {
          syncStatus: restanti.length > 0 ? "pending" : "synced",
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      await db.syncQueue.update(item.id, {
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : "Errore sconosciuto",
      });
      if (item.action !== "delete") {
        await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
      }
    }
  }

  const ancoraInCoda = new Set((await db.syncQueue.toArray()).map((i) => i.rapportinoId));
  const inErrore = await db.rapportini.filter((r) => r.syncStatus === "error").toArray();
  for (const r of inErrore) {
    if (!ancoraInCoda.has(r.id)) {
      await db.rapportini.update(r.id, { syncStatus: "synced" });
    }
  }

  let pulled = 0;
  if (autenticato) {
    try {
      await pullReferenceData();
      await pullDeletedRapportini();
      pulled = await pullRapportini();
    } catch (error) {
      console.warn("Pull Supabase non riuscito:", error);
    }
  }

  const pending = await db.syncQueue.count();
  return { processed, pending, pulled };
}

/**
 * Un operatore non deve conservare sul telefono i rapportini degli altri, nemmeno
 * quelli scaricati prima che la visibilità venisse ristretta. Si toccano solo i
 * record già sincronizzati, così il lavoro non ancora inviato resta al suo posto.
 */
export async function purgaRapportiniAltrui(session: Session | null) {
  if (!session || session.ruolo === "tecnico") return 0;

  const tutti = await db.rapportini.toArray();
  const daRimuovere = tutti
    .filter((r) => r.syncStatus === "synced" && !rapportinoVisibile(r, session))
    .map((r) => r.id);

  if (daRimuovere.length > 0) await db.rapportini.bulkDelete(daRimuovere);
  return daRimuovere.length;
}

export function subscribeOnline(handler: () => void) {
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
