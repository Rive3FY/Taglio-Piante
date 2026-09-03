import { normalizzaCampata } from "./normalize";
import { parseNumeroMetri } from "./geo";
import type { CampataPriorita } from "@/lib/types";

export type RigaImportBruta = {
  originale: string;
  normalizzata: string;
  priorita: CampataPriorita;
  codiceLinea: string;
  nomeLinea: string;
  distInt?: number;
  estInt?: number;
  nordInt?: number;
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
 * Riga operativa LIDAR. Dopo codice-campata c’è la distanza interna, poi la priorità.
 * I trattini dopo la campata possono essere assenti nel PDF (solo spazi).
 */
const RIGA =
  /([A-Z0-9]+)-([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*-*\s*([\d.,]+)\s+(URGENTE|DIFFERIBILE)\s+([\d.,]+)\s+([\d.,]+)\s+\1\s+(.+?)(?=\s+[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*\s*-*\s*[\d.,]+\s+(?:URGENTE|DIFFERIBILE)|\s*$)/gi;

export function parseDistInt(raw: string) {
  let t = raw.trim();
  if (!t) return undefined;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function indiceColonnaDist(header: string[]) {
  return header.findIndex((h) => {
    if (h === "dist int" || h === "dist_int" || h === "dist" || h === "distanza") return true;
    return h.includes("dist") && h.includes("int");
  });
}

function pulisciTesto(raw: string) {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Evita String.matchAll: su WebKit `for...of` lì diventa «undefined is not a function». */
function occorrenze(regex: RegExp, testo: string) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    out.push(m);
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return out;
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
  for (const m of occorrenze(RIGA, testo)) {
    n += 1;
    const codiceLinea = m[1].toUpperCase();
    const originale = m[2];
    const distInt = parseDistInt(m[3]);
    const priorita = PRIORITA[m[4].toUpperCase()];
    const estInt = parseNumeroMetri(m[5] ?? "");
    const nordInt = parseNumeroMetri(m[6] ?? "");
    const nomeLinea = m[7].replace(HEADER, "").trim().replace(/\s+/g, " ");
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
      estInt,
      nordInt,
      riga: n,
    });
  }

  if (riconosciute.length === 0) {
    scartate.push({
      riga: 0,
      testo: testo.slice(0, 120),
      motivo: haIntestazione
        ? "Intestazione trovata ma nessuna riga nel formato atteso (codice-campata, priorità, linea)."
        : "Formato non riconosciuto. Serve un file come il fac-simile LIDAR (colonne Campata, Dist int, Priorità, Linea, Nome linea).",
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
  const iDist = indiceColonnaDist(header);
  const iPrio = header.findIndex((h) => h.includes("prior"));
  const iLinea = header.findIndex((h) => h === "linea" || h === "codice linea" || h === "codice");
  const iNome = header.findIndex((h) => h.includes("nome") && h.includes("linea"));
  const iEst = header.findIndex(
    (h) =>
      h === "c. est int" ||
      h === "c.est int" ||
      h === "est int" ||
      h === "easting" ||
      (h.includes("est") && h.includes("int") && !h.includes("nord")),
  );
  const iNord = header.findIndex(
    (h) =>
      h === "c. nord int" ||
      h === "c.nord int" ||
      h === "nord int" ||
      h === "northing" ||
      (h.includes("nord") && h.includes("int")),
  );
  if (iCampata < 0 || iPrio < 0 || iLinea < 0) return null;

  const riconosciute: RigaImportBruta[] = [];
  const scartate: RigaImportScartata[] = [];
  righe.slice(1).forEach((line, idx) => {
    const cols = splitCsv(line, sep);
    const campataCell = cols[iCampata] ?? "";
    const distInt = iDist >= 0 ? parseDistInt(cols[iDist] ?? "") : undefined;
    const estInt = iEst >= 0 ? parseNumeroMetri(cols[iEst] ?? "") : undefined;
    const nordInt = iNord >= 0 ? parseNumeroMetri(cols[iNord] ?? "") : undefined;
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
      estInt,
      nordInt,
      riga: idx + 2,
    });
  });
  return { riconosciute, scartate };
}

/** Sceglie il parser che restituisce più distanze (Dist int), poi più righe. */
export function parseMiglioreCampate(...candidati: (ParseCampateResult | null | undefined)[]) {
  const ok = candidati.filter((c): c is ParseCampateResult => Boolean(c && c.riconosciute.length > 0));
  if (ok.length === 0) return null;
  return ok.sort((a, b) => {
    const distA = a.riconosciute.filter((r) => r.distInt != null).length;
    const distB = b.riconosciute.filter((r) => r.distInt != null).length;
    if (distB !== distA) return distB - distA;
    return b.riconosciute.length - a.riconosciute.length;
  })[0];
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
