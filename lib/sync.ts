import { compattaCodaSync, db, enqueueSync, nextNumero } from "@/lib/db";
import { rapportinoVisibile } from "@/lib/sezioni";
import { readSession } from "@/lib/session";
import type { Rapportino, Session, SyncQueueItem } from "@/lib/types";
import {
  SCADENZA_GIRO,
  conScadenza,
  eDiRete,
  messaggioErrore,
  segnalaScambioFallito,
} from "@/lib/net";
import {
  deleteRemoteRapportino,
  idsConNumero,
  pullDeletedRapportini,
  pullRapportini,
  pullReferenceData,
  pushCampatePending,
  pushRapportino,
  statoAutenticazione,
} from "@/lib/supabase/remote";
import { ripristinaCampateOrfane, unisciCampateDoppie } from "@/lib/campate/apply";

export type SyncResult = {
  processed: number;
  pending: number;
  pulled: number;
  pullError: string | null;
  /** Voci ferme su un errore che non si risolve ritentando da solo. */
  bloccate: number;
  /** La passata si è fermata perché la linea non reggeva. */
  interrotta: boolean;
};

/** Dopo tanti tentativi andati male per un motivo che non è la linea, si smette. */
const MAX_TENTATIVI_DATI = 5;
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;

const MESSAGGIO_LINEA = "Linea troppo debole: invio ripreso appena il segnale regge.";
const MESSAGGIO_SESSIONE =
  "Sessione scaduta: rientra con lo stesso account per inviare il lavoro rimasto sul telefono.";

let syncInCorso: Promise<SyncResult> | null = null;
/** Vero finché il giro precedente non si è davvero concluso, anche se la UI ha smesso di aspettarlo. */
let giroAncoraVivo = false;

function risultatoVuoto(extra?: Partial<SyncResult>): SyncResult {
  return {
    processed: 0,
    pending: 0,
    pulled: 0,
    pullError: null,
    bloccate: 0,
    interrotta: false,
    ...extra,
  };
}

/** Attesa crescente con un pizzico di casualità, così i tablet non ripartono tutti insieme. */
function prossimoTentativo(attempts: number) {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
  const jitter = base * 0.25 * Math.random();
  return new Date(Date.now() + base + jitter).toISOString();
}

function tocca(item: SyncQueueItem) {
  if (!item.nextAttemptAt) return true;
  return new Date(item.nextAttemptAt).getTime() <= Date.now();
}

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
async function riparaRapportiniSenzaCoda(session: Session | null) {
  const inCoda = new Set((await db.syncQueue.toArray()).map((i) => i.rapportinoId));
  const tutti = await db.rapportini.toArray();
  for (const r of tutti) {
    if (r.syncStatus !== "pending" && r.syncStatus !== "error") continue;
    if (inCoda.has(r.id)) continue;
    if (!rapportinoVisibile(r, session)) continue;
    try {
      await pushRapportino(r);
      await db.rapportini.update(r.id, { syncStatus: "synced" });
    } catch (errore) {
      if (eDiRete(errore)) throw errore;
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
  const tutti = (await db.rapportini.toArray())
    .filter((r) => rapportinoVisibile(r, session))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
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

/**
 * Un giro per volta. Se il precedente sfora la scadenza non si resta appesi a
 * lui: chi chiede riceve subito una risposta, e un nuovo giro parte solo quando
 * il vecchio si è davvero concluso. Prima bastava una fetch impantanata perché
 * la pillola restasse su «Invio…» per sempre e il tocco non facesse più nulla.
 */
export async function processSyncQueue(opts?: { manuale?: boolean }): Promise<SyncResult> {
  if (syncInCorso) return syncInCorso;

  if (giroAncoraVivo) {
    return risultatoVuoto({
      pending: await contaCoda("pending"),
      bloccate: await contaCoda("bloccate"),
      pullError: MESSAGGIO_LINEA,
      interrotta: true,
    });
  }

  giroAncoraVivo = true;
  const giro = eseguiSyncQueue(opts?.manuale === true).finally(() => {
    giroAncoraVivo = false;
  });

  syncInCorso = conScadenza(giro, SCADENZA_GIRO, "La sincronizzazione")
    .catch(async (errore: unknown) => {
      segnalaScambioFallito(errore);
      console.warn("Giro di sincronizzazione non concluso:", errore);
      return risultatoVuoto({
        pending: await contaCoda("pending"),
        bloccate: await contaCoda("bloccate"),
        pullError: eDiRete(errore) ? MESSAGGIO_LINEA : messaggioErrore(errore).slice(0, 280),
        interrotta: true,
      });
    })
    .finally(() => {
      syncInCorso = null;
    });

  return syncInCorso;
}

async function contaCoda(cosa: "pending" | "bloccate") {
  try {
    const profilo = readSession();
    const fogli = await db.rapportini.toArray();
    const coda = await db.syncQueue.toArray();
    return coda.filter(
      (i) =>
        voceCodaDiQuestoAccount(i, profilo, fogli) && (cosa === "pending" || i.bloccato === true),
    ).length;
  } catch {
    return 0;
  }
}

/** In una finestra di rete corta deve partire prima il foglio firmato, poi le campate. */
function ordineDiInvio(a: SyncQueueItem, b: SyncQueueItem) {
  const peso = (i: SyncQueueItem) => (i.action === "campate" ? 1 : 0);
  return peso(a) - peso(b) || a.createdAt.localeCompare(b.createdAt);
}

async function registraFallimento(item: SyncQueueItem, errore: unknown, diRete: boolean) {
  const attempts = item.attempts + 1;
  await db.syncQueue.update(item.id, {
    attempts,
    lastError: (diRete ? MESSAGGIO_LINEA : messaggioErrore(errore)).slice(0, 280),
    nextAttemptAt: prossimoTentativo(attempts),
    bloccato: !diRete && attempts >= MAX_TENTATIVI_DATI,
  });

  // Senza linea il rapportino non ha nulla che non va: resta «da inviare».
  // Il rosso si accende solo quando è il contenuto a non andare giù.
  if (item.action !== "delete" && !diRete) {
    await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
  }
}

async function inviaVoce(item: SyncQueueItem) {
  if (item.action === "delete") {
    await deleteRemoteRapportino(item.rapportinoId);
    await pushCampatePending(item.rapportinoId);
    return;
  }
  if (item.action === "campate") {
    await pushCampatePending(item.rapportinoId);
    return;
  }
  const rapportino = await db.rapportini.get(item.rapportinoId);
  if (!rapportino) {
    await deleteRemoteRapportino(item.rapportinoId);
    return;
  }
  await pushRapportino(rapportino);
}

async function eseguiSyncQueue(manuale: boolean): Promise<SyncResult> {
  await compattaCodaSync();

  const profilo = readSession();
  const fogliLocali = await db.rapportini.toArray();
  const conteggi = async () => ({
    pending: await contaCoda("pending"),
    bloccate: await contaCoda("bloccate"),
  });

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return risultatoVuoto(await conteggi());
  }

  const auth = await statoAutenticazione();

  if (auth === "non-configurato") {
    // Nessun server collegato: la coda non si tocca, altrimenti il lavoro
    // sparirebbe senza essere mai stato inviato da nessuna parte.
    const c = await conteggi();
    return risultatoVuoto({
      ...c,
      pullError:
        c.pending > 0 ? "Server non collegato: i dati restano solo su questo dispositivo." : null,
    });
  }

  if (auth === "irraggiungibile") {
    const c = await conteggi();
    return risultatoVuoto({
      ...c,
      pullError: c.pending > 0 ? MESSAGGIO_LINEA : null,
      interrotta: true,
    });
  }

  if (auth === "scaduta") {
    const c = await conteggi();
    return risultatoVuoto({ ...c, pullError: c.pending > 0 ? MESSAGGIO_SESSIONE : null });
  }

  try {
    await risolviNumeriDuplicati(true, profilo);
  } catch (errore) {
    if (!eDiRete(errore)) throw errore;
    // Senza risposta dal server i numeri restano come sono: si riprova al giro dopo.
  }

  const falliti = new Set<string>();
  const saltati = new Set<string>();
  let processed = 0;
  let interrotta = false;

  while (!interrotta) {
    const items = (await db.syncQueue.orderBy("createdAt").toArray())
      .filter((i) => !falliti.has(i.id) && !saltati.has(i.id))
      .filter((i) => manuale || (!i.bloccato && tocca(i)))
      .sort(ordineDiInvio);
    if (items.length === 0) break;

    for (const item of items) {
      if (!voceCodaDiQuestoAccount(item, profilo, fogliLocali)) {
        saltati.add(item.id);
        continue;
      }
      try {
        await inviaVoce(item);
        await db.syncQueue.delete(item.id);
        processed += 1;
        if (item.action !== "delete") await allineaStatoSyncRapportino(item.rapportinoId);
      } catch (errore) {
        falliti.add(item.id);
        const diRete = eDiRete(errore);
        await registraFallimento(item, errore, diRete);
        if (diRete) {
          // La linea non regge: insistere con le altre voci significa solo
          // collezionare scadenze una dopo l'altra.
          interrotta = true;
          break;
        }
      }
    }
  }

  let pulled = 0;
  let pullError: string | null = null;

  // Leggere dal server dopo un invio fallito significa rischiare di riportare
  // indietro roba vecchia: prima si manda, poi si legge.
  if (!interrotta) {
    try {
      const sistematePrima = (await ripristinaCampateOrfane()) + (await unisciCampateDoppie());
      if (sistematePrima > 0) await pushCampatePending();

      await pullReferenceData();
      const rimossi = await pullDeletedRapportini({ forza: manuale });
      pulled = (await pullRapportini()) + rimossi;

      const sistemateDopo = (await ripristinaCampateOrfane()) + (await unisciCampateDoppie());
      if (sistemateDopo > 0) await pushCampatePending();

      await riparaRapportiniSenzaCoda(profilo);
    } catch (errore) {
      const diRete = eDiRete(errore);
      interrotta = interrotta || diRete;
      pullError = diRete ? MESSAGGIO_LINEA : messaggioErrore(errore).slice(0, 280);
      console.warn("Scambio col server non completato:", errore);
    }
  } else if (processed === 0) {
    pullError = MESSAGGIO_LINEA;
  }

  const c = await conteggi();
  if (!pullError && c.bloccate > 0) {
    pullError =
      (await primoErroreBloccante()) ?? "Alcune modifiche non vengono accettate dal server.";
  }

  return { processed, pulled, pullError, interrotta, ...c };
}

async function primoErroreBloccante() {
  try {
    const coda = await db.syncQueue.toArray();
    return coda.find((i) => i.bloccato && i.lastError)?.lastError ?? null;
  } catch {
    return null;
  }
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

  const tutti = await db.rapportini.toArray();
  const daRimuovere = tutti
    .filter((r) => r.syncStatus === "synced" && !rapportinoVisibile(r, session))
    .map((r) => r.id);

  if (daRimuovere.length > 0) await db.rapportini.bulkDelete(daRimuovere);
  return daRimuovere.length;
}

