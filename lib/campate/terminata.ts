import type { RapportinoCampata } from "@/lib/types";

export type CampataDaChiudere = {
  chiave: string;
  etichetta: string;
};

/** Fogli vecchi senza flag: il taglio si considera finito. */
export function esitoETerminato(esito: Pick<RapportinoCampata, "terminata">) {
  return esito.terminata !== false;
}

/**
 * Span distinti (non le basi) su cui chiedere se il taglio è finito.
 * Urgente e differibile dello stesso span si chiudono insieme: una domanda sola.
 */
export function campatePerDomandaTerminata(esiti: RapportinoCampata[]): CampataDaChiudere[] {
  const out: CampataDaChiudere[] = [];
  const visti = new Set<string>();
  for (const e of esiti) {
    if (e.tipo === "base") continue;
    const etichetta = (e.normalizzata || e.originale).trim();
    if (!etichetta) continue;
    if (visti.has(e.normalizzata)) continue;
    visti.add(e.normalizzata);
    out.push({ chiave: e.normalizzata, etichetta });
  }
  return out;
}

export function applicaScelteTerminata(
  esiti: RapportinoCampata[],
  scelte: Record<string, boolean>,
): RapportinoCampata[] {
  return esiti.map((e) => {
    if (e.tipo === "base") return { ...e, terminata: true };
    const scelta = scelte[e.normalizzata];
    if (typeof scelta !== "boolean") return e;
    return { ...e, terminata: scelta };
  });
}
