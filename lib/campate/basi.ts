import type { Prestazione, Rapportino, RapportinoCampata } from "@/lib/types";
import { uid } from "@/lib/format";
import { normalizzaCampata, spezzaCampateTesto } from "./normalize";

/** Pulizia basamento sul foglio ufficiale: 5.1–5.4. */
export const CODICI_PULIZIA_BASE = new Set(["5.1", "5.2", "5.3", "5.4"]);

export function isBaseLavoro(c: { tipo?: string }) {
  return c.tipo === "base";
}

export function quantitaVociBase(item: Pick<Rapportino, "righe">, prestazioni: Prestazione[]) {
  const qty = new Map<string, number>();
  for (const p of prestazioni) {
    if (!CODICI_PULIZIA_BASE.has(p.codice)) continue;
    qty.set(p.codice, 0);
  }
  for (const r of item.righe ?? []) {
    const p = prestazioni.find((x) => x.id === r.prestazioneId);
    if (!p || !CODICI_PULIZIA_BASE.has(p.codice)) continue;
    const q = Number(r.quantita);
    if (!q) continue;
    qty.set(p.codice, (qty.get(p.codice) ?? 0) + q);
  }
  return [...qty.values()].filter((n) => n > 0);
}

function quantitaBasiArrotondate(item: Pick<Rapportino, "righe">, prestazioni: Prestazione[]) {
  return quantitaVociBase(item, prestazioni).map((q) => Math.round(Number(q))).filter((q) => q > 0);
}

export function haVociBase(item: Pick<Rapportino, "righe">, prestazioni: Prestazione[]) {
  return quantitaBasiArrotondate(item, prestazioni).length > 0;
}

/**
 * Quanti numeri distinti ci sono nel box: 22 → 1; 22-23 → 2; 22-23-24-25-26 → 5.
 * Non si espande l’intervallo: 22-26 sono due numeri, non cinque.
 */
export function numeriDaTestoCampata(testo: string) {
  const visti = new Set<string>();
  const out: string[] = [];
  for (const pezzo of testo.split(/[,;/|\n]+/)) {
    for (const n of numeriDiPezzo(pezzo)) {
      if (visti.has(n)) continue;
      visti.add(n);
      out.push(n);
    }
  }
  return out;
}

function numeriDiPezzo(pezzo: string) {
  const pulito = pezzo.trim().replace(/–/g, "-").replace(/\s+/g, "");
  if (!pulito) return [];
  const parti = pulito.split("-").filter(Boolean);
  if (parti.length === 0 || !parti.every((p) => /^\d+$/.test(p))) return [];
  return parti.map((p) => String(Number(p)));
}

/**
 * Basi solo se i numeri nel box coincidono con la quantità in 5.1–5.4
 * (una voce, o la somma). Si possono aggiungere altre chiamate: restano
 * sul foglio basi e non chiudono campate.
 */
export function eLavoroBasi(testo: string, item: Pick<Rapportino, "righe">, prestazioni: Prestazione[]) {
  const n = numeriDaTestoCampata(testo).length;
  if (n === 0) return false;
  const voci = quantitaBasiArrotondate(item, prestazioni);
  if (voci.length === 0) return false;
  if (voci.some((q) => q === n)) return true;
  const somma = voci.reduce((a, b) => a + b, 0);
  return somma === n;
}

/** 5.1–5.4 senza i numeri giusti nel box: non è né base né campata. */
export function messaggioIncoerenzaBasi(
  testo: string,
  item: Pick<Rapportino, "righe">,
  prestazioni: Prestazione[],
) {
  const voci = quantitaBasiArrotondate(item, prestazioni);
  if (voci.length === 0) return null;
  const n = numeriDaTestoCampata(testo).length;
  if (eLavoroBasi(testo, item, prestazioni)) return null;
  const somma = voci.reduce((a, b) => a + b, 0);
  const qtyTxt = voci.length === 1 ? String(voci[0]) : `${voci.join(" + ")} = ${somma}`;
  if (n === 0) {
    return `Hai segnato ${qtyTxt} in 5.1–5.4 ma nel box non ci sono i numeri dei sostegni. Per le basi indica i numeri (es. 22) in quantità uguale alla chiamata.`;
  }
  return `Hai segnato ${qtyTxt} in 5.1–5.4 e ${n} ${n === 1 ? "sostegno" : "sostegni"} nel box. I numeri devono coincidere: correggi la quantità o i sostegni.`;
}

export function foglioEBasi(
  item: Pick<Rapportino, "campata" | "esitiCampate" | "righe">,
  prestazioni: Prestazione[] = [],
) {
  const esiti = item.esitiCampate ?? [];
  if (esiti.length > 0 && esiti.every((e) => e.tipo === "base")) return true;
  if (prestazioni.length > 0 && eLavoroBasi(item.campata ?? "", item, prestazioni)) return true;
  return esiti.some((e) => e.tipo === "base");
}

/** «Base 82» se è un foglio basi, altrimenti «Campata 22-23». */
export function etichettaOggettoFoglio(
  item: Pick<Rapportino, "campata" | "esitiCampate" | "righe">,
  prestazioni: Prestazione[] = [],
) {
  const testo = (item.campata ?? "").trim();
  if (!testo) return "";
  if (!foglioEBasi(item, prestazioni)) return `Campata ${testo}`;
  const n = numeriDaTestoCampata(testo).length;
  return `${n === 1 ? "Base" : "Basi"} ${testo}`;
}

export function esitiClassificati(
  testo: string,
  item: Pick<Rapportino, "righe">,
  prestazioni: Prestazione[],
  pianificati?: RapportinoCampata[],
): RapportinoCampata[] {
  const comeBasi =
    eLavoroBasi(testo, item, prestazioni) ||
    Boolean(pianificati?.length && pianificati.every((e) => e.tipo === "base"));
  if (comeBasi) {
    const numeri = numeriDaTestoCampata(testo);
    const elenco = numeri.length > 0 ? numeri : (pianificati ?? []).map((e) => e.normalizzata);
    return elenco.filter(Boolean).map((n) => ({
      id: uid("es"),
      originale: n,
      normalizzata: n,
      esito: "tagliata" as const,
      tipo: "base" as const,
    }));
  }
  const campate = (pianificati ?? []).filter((e) => e.tipo !== "base");
  if (campate.length > 0) return campate.map((e) => ({ ...e, tipo: "campata" as const }));
  return spezzaCampateTesto(testo)
    .map((pezzo) => ({
      id: uid("es"),
      originale: pezzo,
      normalizzata: normalizzaCampata(pezzo),
      esito: "tagliata" as const,
      tipo: "campata" as const,
    }))
    .filter((e) => e.normalizzata);
}
