import {
  campataDaNonTagliare,
  campataETagliata,
  type CampataLavoro,
  type Prestazione,
  type RapportinoCampata,
  type RapportinoRiga,
} from "@/lib/types";
import { esitiClassificati, isBaseLavoro } from "./basi";
import { normalizzaCampata } from "./normalize";

/**
 * Righe della tabella che quell'esito andrebbe a chiudere.
 * La priorità conta: urgente e differibile sullo stesso span sono due righe distinte.
 */
export function bersagliDiEsito(campateLinea: CampataLavoro[], esito: RapportinoCampata) {
  if (esito.tipo === "base") return [];
  const campate = campateLinea.filter((c) => !isBaseLavoro(c));
  if (esito.campataId) {
    const byId = campate.filter((c) => c.id === esito.campataId);
    if (byId.length > 0) return byId;
  }
  const norm = esito.normalizzata || normalizzaCampata(esito.originale);
  if (!norm) return [];
  return campate.filter((c) => {
    if (c.normalizzata !== norm) return false;
    if (esito.priorita) return c.priorita === esito.priorita;
    return true;
  });
}

/**
 * Campate già «da non tagliare» che impedirebbero il rapportino.
 * Se sullo stesso span resta almeno una priorità da tagliare il foglio si può fare:
 * quella segnata viene semplicemente lasciata stare.
 */
export function campateBloccateDaNonTagliare(
  campateLinea: CampataLavoro[],
  esiti: RapportinoCampata[],
) {
  const out = new Map<string, CampataLavoro>();
  for (const esito of esiti) {
    const bersagli = bersagliDiEsito(campateLinea, esito);
    if (bersagli.length === 0) continue;
    if (bersagli.some((c) => !campataDaNonTagliare(c))) continue;
    for (const c of bersagli) out.set(c.id, c);
  }
  return [...out.values()];
}

export function esitiCheToccanoDaNonTagliare(
  campateLinea: CampataLavoro[],
  testo: string,
  item: { righe?: RapportinoRiga[] },
  prestazioni: Prestazione[],
  pianificati?: RapportinoCampata[],
) {
  const classificati = esitiClassificati(
    testo,
    { righe: item.righe ?? [] },
    prestazioni,
    pianificati,
  );
  return campateBloccateDaNonTagliare(campateLinea, classificati);
}

/** Già chiusa da un foglio precedente: un secondo rapportino (altra giornata) è lecito. */
export function campataGiaChiusaDaFoglio(
  c: Pick<CampataLavoro, "stato" | "daNonTagliare" | "rapportinoId">,
  questoFoglioId?: string,
) {
  if (campataDaNonTagliare(c)) return false;
  if (!campataETagliata(c)) return false;
  if (!c.rapportinoId) return false;
  if (questoFoglioId && c.rapportinoId === questoFoglioId) return false;
  return true;
}

export function campateGiaTagliateDaFoglio(
  campateLinea: CampataLavoro[],
  esiti: RapportinoCampata[],
  questoFoglioId?: string,
) {
  const out = new Map<string, CampataLavoro>();
  for (const esito of esiti) {
    for (const c of bersagliDiEsito(campateLinea, esito)) {
      if (campataGiaChiusaDaFoglio(c, questoFoglioId)) out.set(c.id, c);
    }
  }
  return [...out.values()];
}

export function messaggioCampateGiaTagliate(giaTagliate: CampataLavoro[]) {
  const nomi = [...new Set(giaTagliate.map((c) => c.normalizzata))];
  if (nomi.length === 0) return "";
  const elenco = nomi.join(", ");
  if (nomi.length === 1) {
    return `La campata ${elenco} risulta già tagliata. Puoi fare questo foglio lo stesso (altra giornata): il grafico non la conta due volte, le prestazioni sì.`;
  }
  return `Queste campate risultano già tagliate (${elenco}). Puoi fare il foglio lo stesso: il grafico non le conta due volte, le prestazioni sì.`;
}

export function messaggioCampateDaNonTagliare(bloccate: CampataLavoro[]) {
  const nomi = [...new Set(bloccate.map((c) => c.normalizzata))];
  if (nomi.length === 0) return "";
  if (nomi.length === 1) {
    return `La campata ${nomi[0]} è già «da non tagliare»: non puoi farci un rapportino. Se c’è da tagliare, togli il segno dall’elenco campate.`;
  }
  return `Queste campate sono già «da non tagliare» e non possono entrare in un rapportino: ${nomi.join(", ")}.`;
}
