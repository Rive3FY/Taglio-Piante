import type { RapportinoCampata } from "@/lib/types";
import { mostraCampata } from "./normalize";

export type CampataDaChiudere = {
  chiave: string;
  etichetta: string;
};

/** Fogli vecchi senza flag: il taglio si considera finito. */
export function esitoETerminato(esito: Pick<RapportinoCampata, "terminata">) {
  return esito.terminata !== false;
}

function chiaveEsito(e: Pick<RapportinoCampata, "normalizzata">) {
  return mostraCampata(e.normalizzata);
}

/**
 * Span distinti (non le basi) su cui chiedere se il taglio è finito.
 * Urgente e differibile della stessa campata sono una domanda sola: il foglio
 * le chiude insieme.
 */
export function campatePerDomandaTerminata(esiti: RapportinoCampata[]): CampataDaChiudere[] {
  const out: CampataDaChiudere[] = [];
  const visti = new Set<string>();
  for (const e of esiti) {
    if (e.tipo === "base") continue;
    const etichetta = mostraCampata(e.normalizzata || e.originale);
    if (!etichetta) continue;
    const chiave = chiaveEsito(e);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    out.push({ chiave, etichetta });
  }
  return out;
}

export function applicaScelteTerminata(
  esiti: RapportinoCampata[],
  scelte: Record<string, boolean>,
): RapportinoCampata[] {
  return esiti.map((e) => {
    if (e.tipo === "base") return { ...e, terminata: true };
    const scelta = scelte[chiaveEsito(e)];
    if (typeof scelta !== "boolean") return e;
    return { ...e, terminata: scelta };
  });
}
