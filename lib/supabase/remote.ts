import { db } from "@/lib/db";
import type { Rapportino } from "@/lib/types";
import { getSupabase, isSupabaseConfigured } from "./client";
import {
  dittaToRow,
  lineaToRow,
  prestazioneToRow,
  rapportinoToRow,
  rowToDitta,
  rowToLinea,
  rowToOperatore,
  rowToPrestazione,
  rowToRapportino,
  type RapportinoRow,
} from "./mappers";
import { SEED_DITTE, SEED_LINEE, SEED_PRESTAZIONI } from "@/lib/seed";

const LAST_PULL_KEY = "rt.lastPullAt";
const SIGNATURE_BUCKET = "firme";

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
  const path = `${rapportinoId}/${kind}.png`;
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

  const firmaOperatorePath = await uploadSignature(item.id, "operatore", item.firmaOperatore);
  const firmaTernaPath = await uploadSignature(item.id, "terna", item.firmaTerna);

  const row = rapportinoToRow(item, {
    firmaOperatore: firmaOperatorePath,
    firmaTerna: firmaTernaPath,
  });

  const { error } = await supabase.from("rapportini").upsert({
    ...row,
    deleted_at: null,
  });
  if (error) throw new Error(error.message);
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

export async function pullRapportini() {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const lastPull =
    typeof window !== "undefined" ? localStorage.getItem(LAST_PULL_KEY) : null;

  let query = supabase
    .from("rapportini")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true });

  if (lastPull) {
    query = query.gte("updated_at", lastPull);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RapportinoRow[];
  let merged = 0;

  for (const row of rows) {
    const local = await db.rapportini.get(row.id);
    if (local?.syncStatus === "pending") continue;

    const firmaOperatore = await downloadSignature(row.firma_operatore_path);
    const firmaTerna = await downloadSignature(row.firma_terna_path);
    const remote = rowToRapportino(row, { firmaOperatore, firmaTerna });

    if (!local || new Date(remote.updatedAt) >= new Date(local.updatedAt)) {
      await db.rapportini.put(remote);
      merged += 1;
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_PULL_KEY, new Date().toISOString());
  }

  return merged;
}

export async function pullDeletedRapportini() {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const lastPull =
    typeof window !== "undefined" ? localStorage.getItem(LAST_PULL_KEY) : null;
  if (!lastPull) return 0;

  const { data, error } = await supabase
    .from("rapportini")
    .select("id, updated_at")
    .not("deleted_at", "is", null)
    .gte("updated_at", lastPull);

  if (error) throw new Error(error.message);

  let removed = 0;
  for (const row of data ?? []) {
    const local = await db.rapportini.get(row.id);
    if (!local || local.syncStatus === "pending") continue;
    await db.rapportini.delete(row.id);
    removed += 1;
  }
  return removed;
}

let lastReferencePullAt = 0;

export async function pullReferenceData() {
  const supabase = getSupabase();
  if (!supabase) return;

  const now = Date.now();
  if (now - lastReferencePullAt < 5 * 60 * 1000) return;
  lastReferencePullAt = now;

  const [lineeRes, ditteRes, prestRes, profiliRes] = await Promise.all([
    supabase.from("linee").select("*"),
    supabase.from("ditte").select("*"),
    supabase.from("prestazioni").select("*"),
    supabase.from("profili").select("user_id, nome, email, ruolo, firma, updated_at"),
  ]);

  if (lineeRes.error) throw new Error(lineeRes.error.message);
  if (ditteRes.error) throw new Error(ditteRes.error.message);
  if (prestRes.error) throw new Error(prestRes.error.message);
  if (profiliRes.error) throw new Error(profiliRes.error.message);

  if ((lineeRes.data ?? []).length > 0) {
    await db.linee.bulkPut((lineeRes.data ?? []).map(rowToLinea));
  }

  if ((ditteRes.data ?? []).length > 0) {
    await db.ditte.bulkPut((ditteRes.data ?? []).map(rowToDitta));
  }

  if ((prestRes.data ?? []).length > 0) {
    await db.prestazioni.bulkPut((prestRes.data ?? []).map(rowToPrestazione));
  }

  const operatori = (profiliRes.data ?? []).map(rowToOperatore);
  const remoteIds = new Set(operatori.map((o) => o.id));
  const locali = await db.operatori.toArray();
  const rimossi = locali.filter((o) => !remoteIds.has(o.id)).map((o) => o.id);
  if (rimossi.length > 0) await db.operatori.bulkDelete(rimossi);
  if (operatori.length > 0) await db.operatori.bulkPut(operatori);
}

export async function seedRemoteReferenceData() {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { count } = await supabase.from("linee").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return false;

  const { error: lineeError } = await supabase.from("linee").upsert(SEED_LINEE.map(lineaToRow));
  if (lineeError) throw new Error(lineeError.message);

  const { error: ditteError } = await supabase.from("ditte").upsert(SEED_DITTE.map(dittaToRow));
  if (ditteError) throw new Error(ditteError.message);

  const { error: prestError } = await supabase
    .from("prestazioni")
    .upsert(SEED_PRESTAZIONI.map(prestazioneToRow));
  if (prestError) throw new Error(prestError.message);

  return true;
}

export async function fetchNextNumero() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const year = new Date().getFullYear();
  const prefix = `RT-${year}-`;
  const { data, error } = await supabase
    .from("rapportini")
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const last = data?.[0]?.numero as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) : 0;
  if (Number.isNaN(seq)) return `${prefix}0001`;
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
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
  return Boolean(data.session);
}
