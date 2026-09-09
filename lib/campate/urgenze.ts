import type { CampataPriorita } from "@/lib/types";

/**
 * Oggi si lavora solo sulle differibili: le urgenze restano nel database
 * (il file del tecnico si importa sempre intero) ma non si vedono in elenco,
 * nei contatori, nelle torte e negli scarichi.
 *
 * Per rimetterle basta questa riga a true: l’app torna a mostrarle e a
 * lavorarle come le differibili, senza toccare i dati.
 */
export const URGENZE_VISIBILI = false;

export const PRIORITA_VISIBILI: CampataPriorita[] = URGENZE_VISIBILI
  ? ["urgente", "differibile"]
  : ["differibile"];

export function prioritaVisibile(priorita?: CampataPriorita | null) {
  if (URGENZE_VISIBILI) return true;
  return priorita !== "urgente";
}

/** Toglie le urgenze da una lista di campate, basi comprese (le basi non hanno priorità). */
export function soloCampateVisibili<T extends { priorita?: CampataPriorita | null }>(lista: T[]) {
  if (URGENZE_VISIBILI) return lista;
  return lista.filter((c) => prioritaVisibile(c.priorita));
}
