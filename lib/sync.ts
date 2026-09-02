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
import { ripristinaCampateOrfane } from "@/lib/campate/apply";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SyncResult = { processed: number; pending: number; pulled: number; pullError: string | null };

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
    return { processed: 0, pending: await db.syncQueue.count(), pulled: 0, pullError: null };
  }

  const autenticato = await supabaseAutenticato();
  if (isSupabaseConfigured() && !autenticato) {
    const pending = await db.syncQueue.count();
    return {
      processed: 0,
      pending,
      pulled: 0,
      pullError:
        pending > 0
          ? "Sessione scaduta: esci e accedi di nuovo per inviare i rapportini sul server."
          : null,
    };
  }

  const falliti = new Set<string>();
  let processed = 0;

  while (true) {
    const items = (await db.syncQueue.orderBy("createdAt").toArray()).filter((i) => !falliti.has(i.id));
    if (items.length === 0) break;

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
              await deleteRemoteRapportino(item.rapportinoId);
              await db.syncQueue.delete(item.id);
              processed += 1;
              continue;
            }
            await pushRapportino(rapportino);
          }
        } else {
          await delay(180);
        }

        await db.syncQueue.delete(item.id);
        processed += 1;

        if (item.action !== "delete" && item.action !== "campate") {
          const restanti = await db.syncQueue.where("rapportinoId").equals(item.rapportinoId).toArray();
          await db.rapportini.update(item.rapportinoId, {
            syncStatus: restanti.length > 0 ? "pending" : "synced",
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        falliti.add(item.id);
        await db.syncQueue.update(item.id, {
          attempts: item.attempts + 1,
          lastError:
            error instanceof Error ? error.message.slice(0, 280) : "Errore sconosciuto",
        });
        if (item.action !== "delete" && item.action !== "campate") {
          await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
        }
      }
    }
  }

  if (autenticato) {
    const orfanePrima = await ripristinaCampateOrfane();
    if (orfanePrima > 0) await pushCampatePending();
  }

  let pulled = 0;
  let pullError: string | null = null;
  if (autenticato) {
    try {
      await pullReferenceData();
      await pullDeletedRapportini();
      pulled = await pullRapportini();
    } catch (error) {
      pullError =
        error instanceof Error ? error.message.slice(0, 280) : "Lettura dal server non riuscita.";
      console.warn("Pull Supabase non riuscito:", error);
    }
  }

  if (autenticato) {
    const orfaneDopo = await ripristinaCampateOrfane();
    if (orfaneDopo > 0) await pushCampatePending();
  }

  const pending = await db.syncQueue.count();
  return { processed, pending, pulled, pullError };
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
