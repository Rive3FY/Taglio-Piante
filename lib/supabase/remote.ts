import { unisciCampataLocaleRemoto } from "@/lib/campate/merge";
import {
  conFirme,
  db,
  eliminaFirme,
  FIRMA_SEPARATA,
  salvaRapportino,
  segnaPercorsiFirme,
} from "@/lib/db";
import type { CampataLavoro, Rapportino } from "@/lib/types";
import { getSupabase, isSupabaseConfigured } from "./client";
import {
  campataLavoroToRow,
  campataStoricoToRow,
  dittaToRow,
  lineaToRow,
  prestazioneToRow,
  rapportinoToRow,
  rowToCampataLavoro,
  rowToCampataStorico,
  rowToDitta,
  rowToImportCampate,
  rowToLinea,
  rowToOperatore,
  rowToPrestazione,
  rowToRapportino,
  type RapportinoRow,
} from "./mappers";
import { SEED_DITTE, SEED_LINEE, SEED_PRESTAZIONI } from "@/lib/seed";
import { readSession } from "@/lib/session";

const CURSOR_PREFIX = "rt.pull.";
const LEGACY_PULL_KEY = "rt.lastPullAt";
const SIGNATURE_BUCKET = "firme";
const PULL_OVERLAP_MS = 5 * 60 * 1000;
const PULL_PAGE = 1000;
/** Id per richiesta con `in(...)`: resta sotto i limiti di lunghezza dell'indirizzo. */
const ID_PER_RICHIESTA = 150;
/**
 * Il controllo completo (tutte le righe, cancellazioni comprese) costa: si fa al
 * primo accesso dell'account sul dispositivo e poi ogni tanto. Nel mezzo arriva
 * solo ciò che è cambiato dall'ultima lettura.
 */
const FULL_PULL_EVERY_MS = 30 * 60 * 1000;

/**
 * I cursori sono per account e ruolo: un altro utente sullo stesso telefono, o lo
 * stesso utente promosso a tecnico, vede righe diverse e deve ripartire da zero.
 */
function cursorKey(nome: "rapportini" | "campate" | "storico" | "completo") {
  const profilo = readSession();
  const chi = profilo ? `${profilo.userId}.${profilo.ruolo}` : "anon";
  return `${CURSOR_PREFIX}${chi}.${nome}`;
}

function leggiCursore(nome: Parameters<typeof cursorKey>[0]) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(cursorKey(nome));
}

function scriviCursore(nome: Parameters<typeof cursorKey>[0], iso: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cursorKey(nome), iso);
}

/** Azzera i cursori di tutti gli account: al prossimo giro si rilegge tutto. */
export function clearPullCursor() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_PULL_KEY);
  const chiavi: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(CURSOR_PREFIX)) chiavi.push(k);
  }
  for (const k of chiavi) localStorage.removeItem(k);
}

/** Vero se tocca il controllo completo: primo accesso, dopo 30 minuti o su richiesta. */
export function serveControlloCompleto() {
  const ultimo = leggiCursore("completo");
  if (!ultimo) return true;
  const t = new Date(ultimo).getTime();
  return !Number.isFinite(t) || Date.now() - t > FULL_PULL_EVERY_MS;
}

export function segnaControlloCompleto() {
  scriviCursore("completo", new Date().toISOString());
}

function pullCursorWithOverlap(iso: string) {
  return new Date(new Date(iso).getTime() - PULL_OVERLAP_MS).toISOString();
}

function maxIso(a: string | null, b: string) {
  if (!a) return b;
  return new Date(b) > new Date(a) ? b : a;
}

function colonnaDaErrore(message: string) {
  const m =
    message.match(/could not find the ['"]([a-z0-9_]+)['"] column/i) ||
    message.match(/column ['"]([a-z0-9_]+)['"] of ['"]\w+['"]/i) ||
    message.match(/column ['"]([a-z0-9_]+)['"]/i) ||
    message.match(/['"]([a-z0-9_]+)['"] column of/i);
  return m?.[1] ?? null;
}

/** Traduce gli errori PostgREST/RLS in messaggi utili sul campo. */
export function messaggioErroreSupabase(message: string) {
  if (/row-level security|violates row-level security/i.test(message)) {
    return "Permesso negato sul database (policy RLS). In Supabase → SQL esegui tutto supabase/schema.sql, poi verifica che il tuo account abbia un profilo con ruolo corretto.";
  }
  if (/schema cache|does not exist|could not find the/i.test(message)) {
    return "Database non aggiornato rispetto all’app. In Supabase → SQL esegui supabase/schema.sql (servono anche dist_int, est_int, nord_int, da_non_tagliare e rinvio_mese sulle campate).";
  }
  if (/foreign key constraint|violates foreign key/i.test(message)) {
    return "Dati non allineati: manca la linea collegata sul database. Sincronizza le anagrafiche o riesegui supabase/schema.sql.";
  }
  return message;
}

async function upsertOmettendoColonneMancanti(
  tabella: string,
  rows: Record<string, unknown>[],
  opts?: { ignoreDuplicates?: boolean },
) {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return;

  let payload = rows;
  const upsertOpts = opts?.ignoreDuplicates ? { ignoreDuplicates: true } : undefined;
  for (let i = 0; i < 8; i += 1) {
    const { error } = await supabase.from(tabella).upsert(payload, upsertOpts);
    if (!error) return;
    const col = colonnaDaErrore(error.message);
    if (!col || payload.every((row) => !(col in row))) {
      throw new Error(messaggioErroreSupabase(error.message));
    }
    payload = payload.map((row) => {
      const copia = { ...row };
      delete copia[col];
      return copia;
    });
  }
  throw new Error("Invio non riuscito: il database non è allineato con l’app.");
}

/** Scrive le campate su Supabase. Se manca una colonna (es. attenzionare), ritenta senza. */
export async function upsertCampateLavoro(
  rows: ReturnType<typeof campataLavoroToRow>[],
  opts?: { vietatoOmettere?: string[] },
) {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return;

  let payload = rows as unknown as Record<string, unknown>[];
  for (let i = 0; i < 8; i += 1) {
    const { error } = await supabase.from("campate_lavoro").upsert(payload);
    if (!error) return;
    const col = colonnaDaErrore(error.message);
    if (!col || payload.every((row) => !(col in row))) {
      throw new Error(messaggioErroreSupabase(error.message));
    }
    if (opts?.vietatoOmettere?.includes(col)) {
      throw new Error(messaggioErroreSupabase(error.message));
    }
    payload = payload.map((row) => {
      const copia = { ...row };
      delete copia[col];
      return copia;
    });
  }
  throw new Error("Invio non riuscito: il database non è allineato con l’app.");
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta?.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadSignature(rapportinoId: string, kind: "operatore" | "terna", dataUrl?: string) {
  const supabase = getSupabase();
  if (!supabase || !dataUrl?.startsWith("data:image")) return undefined;
  if (dataUrl === FIRMA_SEPARATA) throw new Error("Firma non caricata: invio rimandato.");
  // Nome nuovo a ogni firma: se il percorso non cambia, anche l'immagine è la stessa.
  const path = `${rapportinoId}/${kind}-${Date.now()}.png`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(SIGNATURE_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/png",
  });
  if (error) throw new Error(error.message);
  return path;
}

async function downloadSignature(path?: string | null) {
  if (!path) return undefined;
  const supabase = getSupabase();
  if (!supabase) return undefined;
  try {
    // Bucket privato: il download passa dalle policy, non da un URL pubblico.
    const { data, error } = await supabase.storage.from(SIGNATURE_BUCKET).download(path);
    if (error || !data) return undefined;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(data);
    });
  } catch {
    return undefined;
  }
}

export async function pushRapportino(item: Rapportino) {
  const supabase = getSupabase();
  if (!supabase) return;

  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const authUid = authSession?.user?.id;

  const conImmagini = await conFirme(item, { obbligatorie: true });
  const giaInviate = await db.firme.get(item.id);
  const firmaOperatorePath =
    giaInviate?.operatorePath && conImmagini.firmaOperatore === giaInviate.operatore
      ? giaInviate.operatorePath
      : await uploadSignature(item.id, "operatore", conImmagini.firmaOperatore);
  const firmaTernaPath =
    giaInviate?.ternaPath && conImmagini.firmaTerna === giaInviate.terna
      ? giaInviate.ternaPath
      : await uploadSignature(item.id, "terna", conImmagini.firmaTerna);
  if (giaInviate) {
    await segnaPercorsiFirme(item.id, { operatorePath: firmaOperatorePath, ternaPath: firmaTernaPath });
  }

  const row = rapportinoToRow(item, {
    firmaOperatore: firmaOperatorePath,
    firmaTerna: firmaTernaPath,
  });

  const owner_id = item.ownerId ?? authUid ?? null;
  if (!owner_id) {
    throw new Error(
      "Impossibile inviare il rapportino: manca il proprietario. Esci e accedi di nuovo, poi riprova.",
    );
  }

  const now = new Date().toISOString();
  await upsertOmettendoColonneMancanti("rapportini", [
    { ...row, owner_id, deleted_at: null, updated_at: now } as Record<string, unknown>,
  ]);
  // Il numero di un foglio già presente lo tiene il server (può averlo rinumerato).
  const { data: salvato } = await supabase
    .from("rapportini")
    .select("numero")
    .eq("id", item.id)
    .maybeSingle();
  const numero = (salvato as { numero?: string } | null)?.numero;
  await db.rapportini.update(item.id, {
    updatedAt: now,
    ...(numero && numero !== item.numero ? { numero } : {}),
  });
}

/** Chiude i buchi di numerazione lasciati dai rapportini cancellati. */
export async function compattaNumeri() {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("compatta_numeri");
  if (error) {
    // Funzione non ancora installata sul database: la numerazione resta com'è.
    console.warn("Rinumerazione non riuscita:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}

export async function deleteRemoteRapportino(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("rapportini")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function pushCampateEliminate() {
  const supabase = getSupabase();
  if (!supabase) return;

  let daEliminare: { id: string }[] = [];
  try {
    daEliminare = await db.campateDeleteQueue.toArray();
  } catch (error) {
    console.warn("Coda eliminazione campate non disponibile:", error);
    return;
  }
  if (daEliminare.length === 0) return;

  const ids = daEliminare.map((r) => r.id);
  await supabase.from("campate_storico").delete().in("campata_id", ids);
  const { error } = await supabase.from("campate_lavoro").delete().in("id", ids);
  if (error) throw new Error(error.message);
  await db.campateDeleteQueue.bulkDelete(ids);
}

async function fetchCampateRemoteByIds(ids: string[]) {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return new Map<string, CampataLavoro>();

  const out = new Map<string, CampataLavoro>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data, error } = await supabase.from("campate_lavoro").select("*").in("id", slice);
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    for (const row of data ?? []) {
      const campata = rowToCampataLavoro(row as Parameters<typeof rowToCampataLavoro>[0]);
      out.set(campata.id, campata);
    }
  }
  return out;
}

async function fogliInCancellazione() {
  const ids = new Set<string>();
  try {
    for (const q of await db.syncQueue.toArray()) {
      if (q.action === "delete") ids.add(q.rapportinoId);
    }
  } catch {
    // coda non disponibile: si unisce senza quel segnale
  }
  return ids;
}

export async function pushCampatePending(rapportinoId?: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  if (rapportinoId) {
    const { error } = await supabase.from("campate_storico").delete().eq("rapportino_id", rapportinoId);
    if (error && !/column|rapportino_id/i.test(error.message)) throw new Error(error.message);
  }

  const rows = await db.campateLavoro
    .filter((c) => c.syncStatus === "pending" || c.syncStatus === "error")
    .toArray();

  if (rows.length > 0) {
    const remote = await fetchCampateRemoteByIds(rows.map((c) => c.id));
    const fogliEliminati = await fogliInCancellazione();
    if (rapportinoId) fogliEliminati.add(rapportinoId);
    const daInviare = rows.map((locale) => {
      const altro = remote.get(locale.id);
      return altro ? unisciCampataLocaleRemoto(locale, altro, { fogliEliminati }) : locale;
    });

    // Senza da_non_tagliare il tecnico vedrebbe la campata come normale, senza
    // rinvio_mese o attenzionare la riga sparirebbe dall'elenco parallelo: meglio
    // fallire con un messaggio chiaro che perdere il segno in silenzio.
    // Data d'invio, non di modifica: un foglio chiuso offline giorni fa deve
    // comparire nella lettura a cursore degli altri dispositivi.
    const inviateIl = new Date().toISOString();
    await upsertCampateLavoro(
      daInviare.map((c) => ({ ...campataLavoroToRow(c), updated_at: inviateIl })),
      { vietatoOmettere: ["da_non_tagliare", "anno", "rinvio_mese", "attenzionare", "est_int"] },
    );

    const ids = new Set(daInviare.map((c) => c.id));
    const storico = (await db.campateStorico.toArray()).filter((s) => ids.has(s.campataId));
    if (storico.length > 0) {
      try {
        await upsertOmettendoColonneMancanti(
          "campate_storico",
          storico.map(campataStoricoToRow) as unknown as Record<string, unknown>[],
          { ignoreDuplicates: true },
        );
      } catch (error) {
        console.warn("Storico campate non inviato:", error);
      }
    }

    await db.campateLavoro.bulkPut(
      daInviare.map((c) => ({ ...c, syncStatus: "synced" as const, updatedAt: inviateIl })),
    );
  }

  try {
    await pushCampateEliminate();
  } catch (error) {
    if (rows.length === 0) throw error;
    console.warn("Eliminazione campate remote non riuscita:", error);
  }
}

/**
 * Solo id e data di modifica: poche decine di byte a riga. Nel controllo completo
 * dice cosa è cambiato e cosa è sparito, senza riscaricare l'archivio intero.
 */
export function versioniRapportiniRemote() {
  return versioniRemote("rapportini", "updated_at");
}

async function versioniRemote(
  tabella: "rapportini" | "campate_lavoro" | "campate_storico",
  colonna: "updated_at" | "created_at",
) {
  const supabase = getSupabase();
  const out = new Map<string, string>();
  if (!supabase) return out;
  for (let from = 0; ; from += PULL_PAGE) {
    let query = supabase
      .from(tabella)
      .select(`id, ${colonna}`)
      .order("id")
      .range(from, from + PULL_PAGE - 1);
    if (tabella === "rapportini") query = query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of rows) out.set(String(r.id), String(r[colonna] ?? ""));
    if (rows.length < PULL_PAGE) break;
  }
  return out;
}

/** Versioni locali lette dall'indice: le firme non vengono caricate in memoria. */
async function versioniRapportiniLocali() {
  const out = new Map<string, string>();
  await db.rapportini.orderBy("updatedAt").eachKey((key, cursor) => {
    out.set(String(cursor.primaryKey), String(key));
  });
  return out;
}

async function righePerId(tabella: string, ids: string[]) {
  const supabase = getSupabase();
  const all: Record<string, unknown>[] = [];
  if (!supabase) return all;
  for (let i = 0; i < ids.length; i += ID_PER_RICHIESTA) {
    const { data, error } = await supabase
      .from(tabella)
      .select("*")
      .in("id", ids.slice(i, i + ID_PER_RICHIESTA));
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    all.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return all;
}

function istante(iso: string | undefined | null) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Senza `vivi` legge le novità dal cursore. Con `vivi` (controllo completo)
 * confronta le versioni e scarica solo i fogli nuovi o cambiati.
 */
export async function pullRapportini(completo = false, vivi?: Map<string, string>) {
  const supabase = getSupabase();
  if (!supabase) return 0;

  // Archivio locale vuoto (dati del browser cancellati): il cursore non vale più.
  const vuoto = (await db.rapportini.count()) === 0;
  const lastPull = completo || vuoto ? null : leggiCursore("rapportini");

  let rows: RapportinoRow[] = [];
  let newest = lastPull;
  if (!lastPull && vivi) {
    const locali = await versioniRapportiniLocali();
    const inAttesa = new Set(
      (await db.rapportini.where("syncStatus").equals("pending").primaryKeys()).map(String),
    );
    const daScaricare: string[] = [];
    for (const [id, ts] of vivi) {
      newest = maxIso(newest, ts);
      if (inAttesa.has(id)) continue;
      const locale = locali.get(id);
      if (locale == null || istante(ts) > istante(locale)) daScaricare.push(id);
    }
    rows = (await righePerId("rapportini", daScaricare)) as RapportinoRow[];
  } else {
    for (let from = 0; ; from += PULL_PAGE) {
      let query = supabase
        .from("rapportini")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .range(from, from + PULL_PAGE - 1);
      if (lastPull) {
        query = query.gte("updated_at", pullCursorWithOverlap(lastPull));
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const page = (data ?? []) as RapportinoRow[];
      rows.push(...page);
      if (page.length < PULL_PAGE) break;
    }
  }
  let merged = 0;

  for (const row of rows) {
    const local = await db.rapportini.get(row.id);
    newest = maxIso(newest, row.updated_at);
    if (local?.syncStatus === "pending") continue;

    // Stessa versione già in locale, firme comprese: niente da riscaricare.
    const giaAggiornato =
      local &&
      local.syncStatus === "synced" &&
      new Date(row.updated_at).getTime() <= new Date(local.updatedAt).getTime() &&
      (!row.firma_operatore_path || Boolean(local.firmaOperatore)) &&
      (!row.firma_terna_path || Boolean(local.firmaTerna));
    if (giaAggiornato) continue;

    // Stesso file sul server dell'immagine già qui (es. foglio solo rinumerato): niente download.
    const firmeLocali = local ? await db.firme.get(row.id) : undefined;
    const firmaOperatore =
      row.firma_operatore_path && firmeLocali?.operatorePath === row.firma_operatore_path
        ? firmeLocali.operatore
        : await downloadSignature(row.firma_operatore_path);
    const firmaTerna =
      row.firma_terna_path && firmeLocali?.ternaPath === row.firma_terna_path
        ? firmeLocali.terna
        : await downloadSignature(row.firma_terna_path);
    const remote = rowToRapportino(row, { firmaOperatore, firmaTerna });

    if (!local || new Date(remote.updatedAt) >= new Date(local.updatedAt)) {
      await salvaRapportino(remote);
      await segnaPercorsiFirme(row.id, {
        operatorePath: firmaOperatore ? row.firma_operatore_path ?? undefined : undefined,
        ternaPath: firmaTerna ? row.firma_terna_path ?? undefined : undefined,
      });
      merged += 1;
    }
  }

  if (newest) {
    scriviCursore("rapportini", newest);
  } else if (!lastPull) {
    scriviCursore("rapportini", new Date().toISOString());
  }

  return merged;
}

/**
 * Il pull a cursore non vede le cancellazioni: ciò che è synced in locale ma non
 * è più vivo sul server si toglie. Si lavora sulle chiavi, senza leggere i fogli.
 */
export async function pullDeletedRapportini(vivi: Map<string, string>) {
  const tutti = (await db.rapportini.toCollection().primaryKeys()).map(String);
  const nonInviati = new Set(
    (await db.rapportini.where("syncStatus").anyOf("pending", "error").primaryKeys()).map(String),
  );
  const daTogliere = tutti.filter((id) => !nonInviati.has(id) && !vivi.has(id));
  if (daTogliere.length === 0) return 0;
  await db.rapportini.bulkDelete(daTogliere);
  await eliminaFirme(daTogliere);
  return daTogliere.length;
}

/** PostgREST restituisce al massimo ~1000 righe a chiamata: senza pagine si perdono campate. */
async function fetchAllRows(tabella: string) {
  const supabase = getSupabase();
  if (!supabase) return { data: [] as Record<string, unknown>[], error: null as { message: string } | null };
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PULL_PAGE) {
    const { data, error } = await supabase
      .from(tabella)
      .select("*")
      .order("id")
      .range(from, from + PULL_PAGE - 1);
    if (error) return { data: null, error };
    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PULL_PAGE) break;
  }
  return { data: all, error: null };
}

async function fetchRowsSince(tabella: string, colonna: string, since: string) {
  const supabase = getSupabase();
  if (!supabase) return { data: [] as Record<string, unknown>[], error: null as { message: string } | null };
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PULL_PAGE) {
    const { data, error } = await supabase
      .from(tabella)
      .select("*")
      .gte(colonna, since)
      .order(colonna, { ascending: true })
      .range(from, from + PULL_PAGE - 1);
    if (error) return { data: null, error };
    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows);
    if (rows.length < PULL_PAGE) break;
  }
  return { data: all, error: null };
}

function piuRecente(rows: Record<string, unknown>[], colonna: string, attuale: string | null) {
  let newest = attuale;
  for (const row of rows) {
    const v = row[colonna];
    if (typeof v === "string") newest = maxIso(newest, v);
  }
  return newest;
}

export async function pullReferenceData(completo = false) {
  const supabase = getSupabase();
  if (!supabase) return;

  // I profili portano con sé le firme: si rileggono solo nel controllo completo.
  const mancano = (await db.linee.count()) === 0 || (await db.operatori.count()) === 0;
  const skipAnagrafiche = !completo && !mancano;

  if (skipAnagrafiche) {
    await pullCampateLavoro(completo);
    return;
  }

  const [lineeRes, ditteRes, prestRes, profiliRes] = await Promise.all([
    supabase.from("linee").select("*"),
    supabase.from("ditte").select("*"),
    supabase.from("prestazioni").select("*"),
    supabase.from("profili").select("user_id, nome, email, ruolo, firma, updated_at"),
  ]);

  if (lineeRes.error) throw new Error(lineeRes.error.message);
  if (ditteRes.error) throw new Error(ditteRes.error.message);
  if (prestRes.error) throw new Error(prestRes.error.message);

  if ((lineeRes.data ?? []).length > 0) {
    const linee = (lineeRes.data ?? []).map(rowToLinea);
    // Le linee si gestiscono solo dall'area tecnico: il remoto è la fonte di verità,
    // così le eliminazioni arrivano anche sugli altri dispositivi.
    const idsRemoti = new Set(linee.map((l) => l.id));
    const rimosse = (await db.linee.toArray())
      .filter((l) => !idsRemoti.has(l.id))
      .map((l) => l.id);
    if (rimosse.length > 0) await db.linee.bulkDelete(rimosse);
    await db.linee.bulkPut(linee);
  }

  if ((ditteRes.data ?? []).length > 0) {
    await db.ditte.bulkPut((ditteRes.data ?? []).map(rowToDitta));
  }

  if ((prestRes.data ?? []).length > 0) {
    await db.prestazioni.bulkPut((prestRes.data ?? []).map(rowToPrestazione));
  }
  const { allineaPrestazioniLocali } = await import("@/lib/db");
  await allineaPrestazioniLocali();
  await upsertCatalogoPrestazioni();

  // I profili si controllano per ultimi: se falliscono, linee e anagrafiche sono già aggiornate.
  if (profiliRes.error) throw new Error(profiliRes.error.message);

  const operatori = (profiliRes.data ?? []).map(rowToOperatore);
  const remoteIds = new Set(operatori.map((o) => o.id));
  const locali = await db.operatori.toArray();
  const rimossi = locali.filter((o) => !remoteIds.has(o.id)).map((o) => o.id);
  if (rimossi.length > 0) await db.operatori.bulkDelete(rimossi);
  if (operatori.length > 0) await db.operatori.bulkPut(operatori);

  await pullCampateLavoro(completo);
}

export async function pullCampateLavoro(completo = false) {
  const supabase = getSupabase();
  if (!supabase) return;

  const vuoto = (await db.campateLavoro.count()) === 0;
  const sinceCampate = completo || vuoto ? null : leggiCursore("campate");
  const sinceStorico = completo || vuoto ? null : leggiCursore("storico");
  const tombstones = new Set((await db.campateDeleteQueue.toArray()).map((t) => t.id));

  let campateRighe: Record<string, unknown>[];
  let storicoRighe: Record<string, unknown>[];
  let importRighe: Record<string, unknown>[] = [];
  let versioniCampate: Map<string, string> | null = null;
  let versioniStorico: Map<string, string> | null = null;

  if (sinceCampate && sinceStorico) {
    const [campRes, stoRes] = await Promise.all([
      fetchRowsSince("campate_lavoro", "updated_at", pullCursorWithOverlap(sinceCampate)),
      fetchRowsSince("campate_storico", "created_at", pullCursorWithOverlap(sinceStorico)),
    ]);
    if (campRes.error || stoRes.error) {
      throw new Error(messaggioErroreSupabase(campRes.error?.message ?? stoRes.error?.message ?? ""));
    }
    campateRighe = campRes.data ?? [];
    storicoRighe = stoRes.data ?? [];
  } else {
    // Controllo completo: prima l'elenco leggero, poi solo le righe che mancano o sono cambiate.
    const [verCamp, idsStorico, impRes] = await Promise.all([
      versioniRemote("campate_lavoro", "updated_at"),
      versioniRemote("campate_storico", "created_at"),
      fetchAllRows("import_campate"),
    ]);
    if (impRes.error) throw new Error(messaggioErroreSupabase(impRes.error.message));
    versioniCampate = verCamp;
    versioniStorico = idsStorico;
    importRighe = impRes.data ?? [];

    const localiCamp = new Map<string, string>();
    await db.campateLavoro.orderBy("updatedAt").eachKey((key, cursor) => {
      localiCamp.set(String(cursor.primaryKey), String(key));
    });
    const campDaScaricare = [...verCamp]
      .filter(([id, ts]) => {
        if (tombstones.has(id)) return false;
        const locale = localiCamp.get(id);
        return locale == null || istante(locale) !== istante(ts);
      })
      .map(([id]) => id);
    const nonInviate = (
      await db.campateLavoro.filter((c) => c.syncStatus !== "synced").primaryKeys()
    ).map(String);
    for (const id of nonInviate) {
      if (verCamp.has(id) && !campDaScaricare.includes(id)) campDaScaricare.push(id);
    }

    const storicoLocale = new Set((await db.campateStorico.toCollection().primaryKeys()).map(String));
    const stoDaScaricare = [...idsStorico.keys()].filter((id) => !storicoLocale.has(id));

    [campateRighe, storicoRighe] = await Promise.all([
      righePerId("campate_lavoro", campDaScaricare),
      righePerId("campate_storico", stoDaScaricare),
    ]);
  }

  const remote = campateRighe.map((row) =>
    rowToCampataLavoro(row as Parameters<typeof rowToCampataLavoro>[0]),
  );
  // Le cancellazioni si vedono solo confrontando l'elenco intero: si fa nel controllo completo.
  if (versioniCampate && versioniCampate.size > 0) {
    const idsRemoti = versioniCampate;
    const sincronizzate = (
      await db.campateLavoro.filter((c) => c.syncStatus === "synced").primaryKeys()
    ).map(String);
    const daRimuovere = sincronizzate.filter((id) => !idsRemoti.has(id) && !tombstones.has(id));
    if (daRimuovere.length > 0) await db.campateLavoro.bulkDelete(daRimuovere);
  }
  if (remote.length > 0) {
    const localiById = new Map(
      (await db.campateLavoro.bulkGet(remote.map((c) => c.id)))
        .filter((c): c is CampataLavoro => Boolean(c))
        .map((c) => [c.id, c]),
    );

    const fogliEliminati = await fogliInCancellazione();
    const daScrivere: CampataLavoro[] = [];
    for (const altra of remote) {
      if (tombstones.has(altra.id)) continue;
      const locale = localiById.get(altra.id);
      if (locale && (locale.syncStatus === "pending" || locale.syncStatus === "error")) {
        daScrivere.push(unisciCampataLocaleRemoto(locale, altra, { fogliEliminati }));
        continue;
      }
      // Riscrivere righe identiche fa ridisegnare elenchi e torte per niente.
      if (locale && locale.updatedAt === altra.updatedAt && locale.syncStatus === "synced") continue;
      daScrivere.push(altra);
    }
    if (daScrivere.length > 0) await db.campateLavoro.bulkPut(daScrivere);
  }

  if (storicoRighe.length > 0) {
    await db.campateStorico.bulkPut(
      storicoRighe.map((row) => rowToCampataStorico(row as Parameters<typeof rowToCampataStorico>[0])),
    );
  }
  if (importRighe.length > 0) {
    await db.importCampate.bulkPut(
      importRighe.map((row) => rowToImportCampate(row as Parameters<typeof rowToImportCampate>[0])),
    );
  }

  let nuovoCursoreCampate = piuRecente(campateRighe, "updated_at", sinceCampate);
  let nuovoCursoreStorico = piuRecente(storicoRighe, "created_at", sinceStorico);
  if (versioniCampate) {
    for (const ts of versioniCampate.values()) nuovoCursoreCampate = maxIso(nuovoCursoreCampate, ts);
  }
  if (versioniStorico) {
    for (const ts of versioniStorico.values()) nuovoCursoreStorico = maxIso(nuovoCursoreStorico, ts);
  }
  const adesso = new Date().toISOString();
  scriviCursore("campate", nuovoCursoreCampate ?? adesso);
  scriviCursore("storico", nuovoCursoreStorico ?? adesso);
}

export async function upsertCatalogoPrestazioni() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("prestazioni").upsert(SEED_PRESTAZIONI.map(prestazioneToRow));
  if (error) throw new Error(messaggioErroreSupabase(error.message));
}

export async function seedRemoteReferenceData() {
  const supabase = getSupabase();
  if (!supabase) return false;

  await upsertCatalogoPrestazioni();

  const { count } = await supabase.from("linee").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return false;

  const { error: lineeError } = await supabase.from("linee").upsert(SEED_LINEE.map(lineaToRow));
  if (lineeError) throw new Error(lineeError.message);

  const { error: ditteError } = await supabase.from("ditte").upsert(SEED_DITTE.map(dittaToRow));
  if (ditteError) throw new Error(ditteError.message);

  return true;
}

export async function fetchNextNumero() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const year = new Date().getFullYear();
  const prefix = `RT-${year}-`;
  // Funzione lato database: legge il massimo su tutti i rapportini, non solo sui propri.
  const { data, error } = await supabase.rpc("prossimo_numero", { prefisso: prefix });

  if (error) throw new Error(error.message);

  const last = (data as string | null) ?? undefined;
  const seq = last ? Number(last.slice(prefix.length)) : 0;
  if (Number.isNaN(seq)) return `${prefix}0001`;
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

/** Serve a scoprire due fogli creati offline con lo stesso numero su telefoni diversi. */
export async function idsConNumero(numero: string) {
  const supabase = getSupabase();
  if (!supabase || !numero) return [];
  const { data, error } = await supabase
    .from("rapportini")
    .select("id")
    .eq("numero", numero)
    .is("deleted_at", null);
  if (error) throw new Error(messaggioErroreSupabase(error.message));
  return (data ?? []).map((row) => String((row as { id: string }).id));
}

export function supabaseReady() {
  return isSupabaseConfigured() && typeof navigator !== "undefined" && navigator.onLine;
}

/** Senza account autenticato le policy RLS bloccano tutto: meglio non tentare nemmeno. */
export async function supabaseAutenticato() {
  if (!supabaseReady()) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  const inScadenza =
    !session || (session.expires_at != null && session.expires_at * 1000 < Date.now() + 60_000);
  if (inScadenza) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session ?? session;
    } catch {
      // resta la sessione che c’è, se ancora valida
    }
  }
  if (!session) return false;
  if (session.expires_at != null && session.expires_at * 1000 < Date.now()) return false;
  return true;
}
