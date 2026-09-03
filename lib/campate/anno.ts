import { campataETagliata, type CampataLavoro } from "@/lib/types";

/** Piano già in produzione prima della colonna anno. */
export const ANNO_PIANO_INIZIALE = 2026;

export function annoDi(c: Pick<CampataLavoro, "anno">) {
  return c.anno ?? ANNO_PIANO_INIZIALE;
}

export function annoDaDataLavoro(iso?: string | null) {
  if (iso && iso.length >= 4) {
    const y = Number(iso.slice(0, 4));
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

export function annoPianoPiuRecente(campate: CampataLavoro[]) {
  let max = 0;
  for (const c of campate) {
    const a = annoDi(c);
    if (a > max) max = a;
  }
  return max || new Date().getFullYear();
}

export function anniPiani(campate: CampataLavoro[]) {
  const set = new Set<number>();
  for (const c of campate) set.add(annoDi(c));
  return [...set].sort((a, b) => b - a);
}

export function campateDellAnno(campate: CampataLavoro[], anno: number) {
  return campate.filter((c) => annoDi(c) === anno);
}

export function chiaveFisica(codiceLinea: string, normalizzata: string) {
  return `${codiceLinea.trim().toUpperCase()}|${normalizzata}`;
}

/** Anni precedenti in cui la stessa linea+campata risulta già tagliata. */
export function anniTaglioPrecedenti(
  tutte: CampataLavoro[],
  codiceLinea: string,
  normalizzata: string,
  annoCorrente: number,
) {
  const anni = new Set<number>();
  const linea = codiceLinea.trim().toUpperCase();
  for (const c of tutte) {
    if (c.tipo === "base") continue;
    if (c.codiceLinea.trim().toUpperCase() !== linea) continue;
    if (c.normalizzata !== normalizzata) continue;
    const a = annoDi(c);
    if (a >= annoCorrente) continue;
    if (campataETagliata(c)) anni.add(a);
  }
  return [...anni].sort((a, b) => b - a);
}

export function etichettaAnniTaglio(anni: number[]) {
  if (anni.length === 0) return "";
  if (anni.length === 1) return `Già tagliata nel ${anni[0]}`;
  return `Già tagliata nel ${anni.join(", ")}`;
}
