import { CAMPATA_PRIORITA_LABEL, type RapportinoCampata } from "@/lib/types";
import { mostraCampata } from "./normalize";
import { pianoAccoppiaFratelli, readPianoLavoro } from "./pianoLavoro";

export type CampataDaChiudere = {
  chiave: string;
  etichetta: string;
};

/** Fogli vecchi senza flag: il taglio si considera finito. */
export function esitoETerminato(esito: Pick<RapportinoCampata, "terminata">) {
  return esito.terminata !== false;
}

function chiaveEsito(e: Pick<RapportinoCampata, "normalizzata" | "priorita">) {
  const n = mostraCampata(e.normalizzata);
  if (pianoAccoppiaFratelli(readPianoLavoro())) return n;
  return `${n}|${e.priorita ?? ""}`;
}

function etichettaEsito(e: Pick<RapportinoCampata, "normalizzata" | "originale" | "priorita">) {
  const base = mostraCampata(e.normalizzata || e.originale);
  if (!e.priorita || pianoAccoppiaFratelli(readPianoLavoro())) return base;
  return `${base} · ${CAMPATA_PRIORITA_LABEL[e.priorita]}`;
}

/**
 * Span distinti (non le basi) su cui chiedere se il taglio è finito.
 * Col piano «entrambe» urgente e differibile dello stesso span sono una domanda sola;
 * altrimenti restano due interventi distinti.
 */
export function campatePerDomandaTerminata(esiti: RapportinoCampata[]): CampataDaChiudere[] {
  const out: CampataDaChiudere[] = [];
  const visti = new Set<string>();
  for (const e of esiti) {
    if (e.tipo === "base") continue;
    const etichetta = etichettaEsito(e);
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
