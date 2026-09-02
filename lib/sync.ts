import { db, enqueueSync, nextNumero } from "@/lib/db";
import { rapportinoVisibile } from "@/lib/sezioni";
import type { Session } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteRemoteRapportino,
  idsConNumero,
  pullDeletedRapportini,
  pullRapportini,
  pullReferenceData,
  pushCampatePending,
  pushRapportino,
  supabaseAutenticato,
} from "@/lib/supabase/remote";
import { ripristinaCampateOrfane, unisciCampateDoppie } from "@/lib/campate/apply";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SyncResult = { processed: number; pending: number; pulled: number; pullError: string | null };

let syncInCorso: Promise<SyncResult> | null = null;

async function allineaStatoSyncRapportino(rapportinoId: string) {
  const item = await db.rapportini.get(rapportinoId);
  if (!item) return;
  const restanti = await db.syncQueue.where("rapportinoId").equals(rapportinoId).count();
  if (restanti > 0) {
    if (item.syncStatus !== "pending" && item.syncStatus !== "error") {
      await db.rapportini.update(rapportinoId, { syncStatus: "pending" });
    }
    return;
  }
  if (item.syncStatus === "pending" || item.syncStatus === "error") {
    await db.rapportini.update(rapportinoId, { syncStatus: "synced" });
  }
}

/** Badge «da inviare» senza voci in coda: di solito l’invio c’è già stato, manca solo la spunta. */
async function riparaRapportiniSenzaCoda(autenticato: boolean) {
  if (!autenticato) return;
  const inCoda = new Set((await db.syncQueue.toArray()).map((i) => i.rapportinoId));
  const tutti = await db.rapportini.toArray();
  for (const r of tutti) {
    if (r.syncStatus !== "pending" && r.syncStatus !== "error") continue;
    if (inCoda.has(r.id)) continue;
    try {
      await pushRapportino(r);
      await db.rapportini.update(r.id, { syncStatus: "synced" });
    } catch {
      await db.rapportini.update(r.id, { syncStatus: "error" });
    }
  }
}

/**
 * Due telefoni offline possono creare lo stesso numero di rapportino. Gli id sono
 * diversi, quindi niente si sovrascrive, ma in elenco sembrano lo stesso foglio.
 * Si rinumera solo quello non ancora arrivato sul server, così i fogli già
 * consegnati tengono il numero stampato.
 */
async function risolviNumeriDuplicati(autenticato: boolean) {
  const tutti = (await db.rapportini.toArray()).sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
  const visti = new Map<string, string>();
  let corretti = 0;

  for (const r of tutti) {
    if (!r.numero) continue;
    const primo = visti.get(r.numero);
    let duplicato = Boolean(primo && primo !== r.id);

    if (!duplicato && autenticato && r.syncStatus !== "synced") {
      try {
        duplicato = (await idsConNumero(r.numero)).some((id) => id !== r.id);
      } catch {
        // senza risposta dal server si tiene il numero così com’è
      }
    }

    if (!duplicato || r.syncStatus === "synced") {
      visti.set(r.numero, r.id);
      continue;
    }

    const nuovo = await nextNumero();
    if (!nuovo || nuovo === r.numero || visti.has(nuovo)) continue;
    await db.rapportini.update(r.id, { numero: nuovo, updatedAt: new Date().toISOString() });
    await enqueueSync(r.id, "upsert");
    visti.set(nuovo, r.id);
    corretti += 1;
  }

  return corretti;
}

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

  await risolviNumeriDuplicati(autenticato);

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

        if (item.action !== "delete") {
          await allineaStatoSyncRapportino(item.rapportinoId);
        }
      } catch (error) {
        falliti.add(item.id);
        await db.syncQueue.update(item.id, {
          attempts: item.attempts + 1,
          lastError:
            error instanceof Error ? error.message.slice(0, 280) : "Errore sconosciuto",
        });
        if (item.action !== "delete") {
          await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
        }
      }
    }
  }

  if (autenticato) {
    const sistematePrima = (await ripristinaCampateOrfane()) + (await unisciCampateDoppie());
    if (sistematePrima > 0) await pushCampatePending();
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
    const sistemateDopo = (await ripristinaCampateOrfane()) + (await unisciCampateDoppie());
    if (sistemateDopo > 0) await pushCampatePending();
  }

  if (autenticato) await riparaRapportiniSenzaCoda(true);

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
