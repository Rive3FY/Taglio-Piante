import { compattaCodaSync, db, eliminaFirme, enqueueSync, nextNumero } from "@/lib/db";
import { rapportinoVisibile } from "@/lib/sezioni";
import { readSession } from "@/lib/session";
import type { Rapportino, Session, SyncQueueItem } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  compattaNumeri,
  deleteRemoteRapportino,
  idsConNumero,
  precaricaFirmeRecenti,
  pullDeletedRapportini,
  pullRapportini,
  pullReferenceData,
  pushCampatePending,
  pushRapportino,
  segnaControlloCompleto,
  serveControlloCompleto,
  supabaseAutenticato,
  versioniRapportiniRemote,
} from "@/lib/supabase/remote";
import {
  riallineaCampateDaRapportini,
  ripristinaCampateOrfane,
  unisciCampateDoppie,
} from "@/lib/campate/apply";

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
async function riparaRapportiniSenzaCoda(autenticato: boolean, session: Session | null) {
  if (!autenticato) return;
  const inCoda = new Set((await db.syncQueue.toArray()).map((i) => i.rapportinoId));
  const nonInviati = await db.rapportini.where("syncStatus").anyOf("pending", "error").toArray();
  for (const r of nonInviati) {
    if (inCoda.has(r.id)) continue;
    if (!rapportinoVisibile(r, session)) continue;
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
async function risolviNumeriDuplicati(autenticato: boolean, session: Session | null) {
  // Solo i fogli non ancora inviati possono cambiare numero: gli altri si guardano
  // dall'indice sul numero, senza caricare l'archivio.
  const nonInviati = (await db.rapportini.where("syncStatus").anyOf("pending", "error").toArray())
    .filter((r) => rapportinoVisibile(r, session))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const assegnati = new Set<string>();
  let corretti = 0;

  for (const r of nonInviati) {
    if (!r.numero) continue;
    const stessoNumero = (await db.rapportini.where("numero").equals(r.numero).toArray()).filter(
      (x) => x.id !== r.id && rapportinoVisibile(x, session),
    );
    // Tra due fogli locali con lo stesso numero lo tiene il più vecchio, come in elenco.
    let duplicato = stessoNumero.some(
      (x) =>
        x.syncStatus === "synced" ||
        (x.createdAt ?? "") < (r.createdAt ?? "") ||
        ((x.createdAt ?? "") === (r.createdAt ?? "") && assegnati.has(x.id)),
    );

    if (!duplicato && autenticato) {
      try {
        duplicato = (await idsConNumero(r.numero)).some((id) => id !== r.id);
      } catch {
        // senza risposta dal server si tiene il numero così com’è
      }
    }

    if (!duplicato) {
      assegnati.add(r.id);
      continue;
    }

    const nuovo = await nextNumero();
    if (!nuovo || nuovo === r.numero) continue;
    if ((await db.rapportini.where("numero").equals(nuovo).count()) > 0) continue;
    await db.rapportini.update(r.id, { numero: nuovo, updatedAt: new Date().toISOString() });
    await enqueueSync(r.id, "upsert");
    assegnati.add(r.id);
    corretti += 1;
  }

  return corretti;
}

async function fogliDellaCoda() {
  const ids = [...new Set((await db.syncQueue.toArray()).map((i) => i.rapportinoId))];
  return (await db.rapportini.bulkGet(ids)).filter((r): r is Rapportino => Boolean(r));
}

/** Le riparazioni leggono tutte le campate: una volta a sessione, poi solo se è cambiato qualcosa. */
let riparazioniFatte = false;

/**
 * Di norma legge dal server solo ciò che è cambiato. `completo` rilegge tutto
 * (cancellazioni comprese): parte da sé al primo accesso e ogni mezz'ora, oppure
 * quando si tocca la pillola.
 */
export async function processSyncQueue(opts: { completo?: boolean } = {}) {
  if (syncInCorso) return syncInCorso;
  syncInCorso = eseguiSyncQueue(opts.completo ?? false).finally(() => {
    syncInCorso = null;
  });
  return syncInCorso;
}

async function eseguiSyncQueue(richiestoCompleto: boolean): Promise<SyncResult> {
  await compattaCodaSync();

  const profilo = readSession();
  const pendingDiQuestoAccount = async () => {
    const resto = await db.syncQueue.toArray();
    const fogli = await fogliDellaCoda();
    return resto.filter((i) => voceCodaDiQuestoAccount(i, profilo, fogli)).length;
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, pending: await pendingDiQuestoAccount(), pulled: 0, pullError: null };
  }

  const autenticato = await supabaseAutenticato();
  if (isSupabaseConfigured() && !autenticato) {
    const pending = await pendingDiQuestoAccount();
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

  await risolviNumeriDuplicati(autenticato, profilo);
  const fogliLocali = await fogliDellaCoda();

  const falliti = new Set<string>();
  const saltati = new Set<string>();
  let processed = 0;
  let cancellati = 0;

  while (true) {
    const items = (await db.syncQueue.orderBy("createdAt").toArray()).filter(
      (i) => !falliti.has(i.id) && !saltati.has(i.id),
    );
    if (items.length === 0) break;

    for (const item of items) {
      try {
        if (autenticato) {
          if (!voceCodaDiQuestoAccount(item, profilo, fogliLocali)) {
            saltati.add(item.id);
            continue;
          }
          if (item.action === "delete") {
            await deleteRemoteRapportino(item.rapportinoId);
            await pushCampatePending(item.rapportinoId);
            cancellati += 1;
          } else if (item.action === "campate") {
            await pushCampatePending(item.rapportinoId);
          } else {
            const rapportino = await db.rapportini.get(item.rapportinoId);
            if (!rapportino) {
              await deleteRemoteRapportino(item.rapportinoId);
              await db.syncQueue.delete(item.id);
              processed += 1;
              cancellati += 1;
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

  // I successivi scalano di uno: il pull subito dopo porta i numeri nuovi su questo dispositivo.
  if (autenticato && cancellati > 0) await compattaNumeri();

  const completo = richiestoCompleto || serveControlloCompleto();

  if (autenticato && (completo || processed > 0 || !riparazioniFatte)) {
    if ((await unisciCampateDoppie()) > 0) await pushCampatePending();
  }

  let pulled = 0;
  let pullError: string | null = null;
  if (autenticato) {
    try {
      await pullReferenceData(completo);
      if (completo) {
        // Cancellazioni e fogli cambiati da un solo elenco leggero (id + data).
        const vivi = await versioniRapportiniRemote();
        const rimossi = await pullDeletedRapportini(vivi);
        pulled = (await pullRapportini(true, vivi)) + rimossi;
        segnaControlloCompleto();
      } else {
        pulled = await pullRapportini(false);
      }
    } catch (error) {
      pullError =
        error instanceof Error ? error.message.slice(0, 280) : "Lettura dal server non riuscita.";
      console.warn("Pull Supabase non riuscito:", error);
    }
  }

  if (autenticato && !pullError && (completo || pulled > 0 || !riparazioniFatte)) {
    // Solo il tecnico ha tutti i fogli: per un operatore i fogli degli altri non
    // sono sul telefono e le loro campate sembrerebbero orfane. Serve anche una
    // lettura riuscita, altrimenti mancano fogli appena arrivati sul server.
    let sistemateDopo = 0;
    if (profilo?.ruolo === "tecnico") {
      sistemateDopo += await ripristinaCampateOrfane();
      sistemateDopo += await riallineaCampateDaRapportini();
    }
    sistemateDopo += await unisciCampateDoppie();
    if (sistemateDopo > 0) await pushCampatePending();
    riparazioniFatte = true;
  }

  if (autenticato) {
    await riparaRapportiniSenzaCoda(true, profilo);
    void precaricaFirmeRecenti(profilo).catch((error) =>
      console.warn("Firme recenti non scaricate:", error),
    );
  }

  return { processed, pending: await pendingDiQuestoAccount(), pulled, pullError };
}

/** Coda di un altro account sullo stesso telefono: non si invia e non si conta nel badge. */
export function voceCodaDiQuestoAccount(
  item: SyncQueueItem,
  session: Session | null,
  rapportini: Rapportino[],
) {
  if (item.action === "campate") return true;
  if (!session || session.ruolo === "tecnico") return true;
  const foglio = rapportini.find((r) => r.id === item.rapportinoId);
  if (!foglio) return true;
  return rapportinoVisibile(foglio, session);
}

/**
 * Un operatore non deve conservare sul telefono i rapportini degli altri, nemmeno
 * quelli scaricati prima che la visibilità venisse ristretta. Si toccano solo i
 * record già sincronizzati, così il lavoro non ancora inviato resta al suo posto.
 */
export async function purgaRapportiniAltrui(session: Session | null) {
  if (!session || session.ruolo === "tecnico") return 0;

  const daRimuovere = (
    await db.rapportini
      .where("syncStatus")
      .equals("synced")
      .filter((r) => !rapportinoVisibile(r, session))
      .primaryKeys()
  ).map(String);

  if (daRimuovere.length > 0) {
    await db.rapportini.bulkDelete(daRimuovere);
    await eliminaFirme(daRimuovere);
  }
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
