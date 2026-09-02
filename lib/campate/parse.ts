import { normalizzaCampata } from "./normalize";
import type { CampataPriorita } from "@/lib/types";

export type RigaImportBruta = {
  originale: string;
  normalizzata: string;
  priorita: CampataPriorita;
  codiceLinea: string;
  nomeLinea: string;
  distInt?: number;
  riga: number;
};

export type RigaImportScartata = {
  riga: number;
  testo: string;
  motivo: string;
};

export type ParseCampateResult = {
  riconosciute: RigaImportBruta[];
  scartate: RigaImportScartata[];
};

const PRIORITA: Record<string, CampataPriorita> = {
  URGENTE: "urgente",
  DIFFERIBILE: "differibile",
};

/** Intestazione del fac-simile LIDAR: Campata, Dist int, Priorità, coordinate, Linea, Nome linea. */
const HEADER =
  /campata\s+dist\s*int\s+priorit[aà]\s+c\.\s*est\s*int\s+c\.\s*nord\s*int\s+linea\s+nome\s+linea/i;

/**
 * Riga operativa. Il primo token è `{codice}-{estremo}---` (a volte con un suffisso tipo 054-5 o 999-CAS).
 * Non dipende dai nomi delle linee né dai numeri del fac-simile: è il formato del file.
 */
const RIGA =
  /([A-Z0-9]+)-([A-Z0-9]+(?:-[A-Z0-9]+)*)-+\s+([\d.,]+)\s+(URGENTE|DIFFERIBILE)\s+[\d.,]+\s+[\d.,]+\s+\1\s+(.+?)(?=\s+[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*-+\s+[\d.,]+\s+(?:URGENTE|DIFFERIBILE)|\s*$)/gi;

function parseDistInt(raw: string) {
  const t = raw.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function pulisciTesto(raw: string) {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTestoCampate(raw: string): ParseCampateResult {
  const testo = pulisciTesto(raw);
  const riconosciute: RigaImportBruta[] = [];
  const scartate: RigaImportScartata[] = [];

  if (!testo) {
    return { riconosciute, scartate: [{ riga: 0, testo: "", motivo: "Il file è vuoto." }] };
  }

  const haIntestazione = HEADER.test(testo);
  let n = 0;
  RIGA.lastIndex = 0;
  for (const m of testo.matchAll(RIGA)) {
    n += 1;
    const codiceLinea = m[1].toUpperCase();
    const originale = m[2];
    const distInt = parseDistInt(m[3]);
    const priorita = PRIORITA[m[4].toUpperCase()];
    const nomeLinea = m[5].replace(HEADER, "").trim().replace(/\s+/g, " ");
    const normalizzata = normalizzaCampata(originale);
    if (!priorita) {
      scartate.push({ riga: n, testo: m[0].slice(0, 80), motivo: "Priorità non riconosciuta." });
      continue;
    }
    if (!normalizzata) {
      scartate.push({ riga: n, testo: m[0].slice(0, 80), motivo: "Campata non normalizzabile." });
      continue;
    }
    riconosciute.push({
      originale,
      normalizzata,
      priorita,
      codiceLinea,
      nomeLinea,
      distInt,
      riga: n,
    });
  }

  if (riconosciute.length === 0) {
    scartate.push({
      riga: 0,
      testo: testo.slice(0, 120),
      motivo: haIntestazione
        ? "Intestazione trovata ma nessuna riga nel formato atteso (codice-campata, priorità, linea)."
        : "Formato non riconosciuto. Serve un file come il fac-simile LIDAR (colonne Campata, Priorità, Linea, Nome linea).",
    });
  }

  return { riconosciute, scartate };
}

export function parseCsvCampate(raw: string): ParseCampateResult | null {
  const righe = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (righe.length < 2) return null;
  const sep = righe[0].includes(";") && !righe[0].includes(",") ? ";" : ",";
  const header = splitCsv(righe[0], sep).map((h) => h.trim().toLowerCase());
  const iCampata = header.findIndex((h) => h === "campata" || h.includes("campata"));
  const iDist = header.findIndex((h) => h === "dist int" || h === "dist_int" || (h.includes("dist") && h.includes("int")));
  const iPrio = header.findIndex((h) => h.includes("prior"));
  const iLinea = header.findIndex((h) => h === "linea" || h === "codice linea" || h === "codice");
  const iNome = header.findIndex((h) => h.includes("nome") && h.includes("linea"));
  if (iCampata < 0 || iPrio < 0 || iLinea < 0) return null;

  const riconosciute: RigaImportBruta[] = [];
  const scartate: RigaImportScartata[] = [];
  righe.slice(1).forEach((line, idx) => {
    const cols = splitCsv(line, sep);
    const campataCell = cols[iCampata] ?? "";
    const distInt = iDist >= 0 ? parseDistInt(cols[iDist] ?? "") : undefined;
    const prioCell = (cols[iPrio] ?? "").trim().toUpperCase();
    const codiceCell = (cols[iLinea] ?? "").trim().toUpperCase();
    const nome = (iNome >= 0 ? cols[iNome] : "").trim();
    const priorita = PRIORITA[prioCell];
    const originale = estraiOriginaleDaCella(campataCell, codiceCell);
    const normalizzata = normalizzaCampata(originale || campataCell);
    if (!priorita || !codiceCell || !normalizzata) {
      scartate.push({
        riga: idx + 2,
        testo: line.slice(0, 80),
        motivo: !priorita ? "Priorità assente o non valida." : "Codice linea o campata mancanti.",
      });
      return;
    }
    riconosciute.push({
      originale: originale || campataCell.trim(),
      normalizzata,
      priorita,
      codiceLinea: codiceCell,
      nomeLinea: nome,
      distInt,
      riga: idx + 2,
    });
  });
  return { riconosciute, scartate };
}

function estraiOriginaleDaCella(cella: string, codiceLinea: string) {
  const t = cella.trim();
  const pref = `${codiceLinea}-`;
  if (codiceLinea && t.toUpperCase().startsWith(pref)) {
    return t.slice(pref.length).replace(/-+$/g, "");
  }
  return t.replace(/-+$/g, "");
}

function splitCsv(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quote = false;
  for (const ch of line) {
    if (ch === '"') {
      quote = !quote;
      continue;
    }
    if (ch === sep && !quote) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
