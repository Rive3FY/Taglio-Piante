import type { Linea, RapportinoStato, SyncStatus } from "./types";
import { STATO_LABEL, SYNC_LABEL } from "./types";

export function formatDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDistInt(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function statoLabel(stato: RapportinoStato) {
  return STATO_LABEL[stato];
}

export function syncLabel(status: SyncStatus) {
  return SYNC_LABEL[status];
}

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function lineaDescrizione(linea?: Linea | null) {
  if (!linea) return "";
  if (linea.tensioneKv) return `${linea.tensioneKv} kV ${linea.nome}`;
  return linea.nome;
}

/** Le prime due cifre del codice dicono la tensione della linea. */
const TENSIONE_DA_PREFISSO: Record<string, number> = {
  "21": 380,
  "22": 220,
  "23": 150,
  "24": 60,
};

export const TENSIONI = [380, 220, 150, 60] as const;

export function tensioneDaCodice(codice?: string | null) {
  if (!codice) return undefined;
  return TENSIONE_DA_PREFISSO[codice.trim().slice(0, 2).toUpperCase()];
}

export function tensioneLinea(linea?: Linea | null) {
  if (!linea) return undefined;
  if (linea.tensioneKv) return linea.tensioneKv;
  return tensioneDaCodice(linea.codice);
}

export function tensioneLabel(kv?: number) {
  return kv ? `${kv} kV` : "Altro";
}

export function lineaKicker(linea: Linea) {
  const parti = [linea.codice];
  const kv = tensioneLinea(linea);
  if (kv) parti.push(tensioneLabel(kv));
  if (linea.zona) parti.push(linea.zona);
  return parti.join(" · ");
}

export function campataLabel(c: { codice: string; tipo: string; daSupporto: string; aSupporto: string }) {
  const tipo = c.tipo === "base" ? "Base" : "Campata";
  return `${c.codice} · ${tipo} ${c.daSupporto}–${c.aSupporto}`;
}

export function numeroRapportino(seq: number) {
  const year = new Date().getFullYear();
  return `RT-${year}-${String(seq).padStart(4, "0")}`;
}
