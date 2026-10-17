import { formatDate, formatDateTime } from "@/lib/format";
import type { CampataLavoro, CampataStorico, ImportCampate, Rapportino } from "@/lib/types";

const EVENTI_NASCITA: Record<string, string> = {
  aggiuntiva_da_rapportino: "aggiunta dal rapportino",
  non_terminata: "aggiunta dal rapportino",
  aggiuntiva_manuale: "aggiunta a mano",
};

/** Da dove arriva una campata: serve a riconoscere quelle che sul campo non esistono. */
export function provenienzaCampata(
  c: CampataLavoro,
  imports: ImportCampate[],
  storico: CampataStorico[],
  rapportini: Rapportino[],
) {
  const parti: string[] = [];
  const imp = c.importId ? imports.find((i) => i.id === c.importId) : undefined;
  if (imp) {
    parti.push(`importata dal file «${imp.fileName}» il ${formatDateTime(imp.createdAt)}`);
  } else if (c.importId) {
    parti.push("importata da un file che non è più in elenco");
  }

  const log = storico
    .filter((s) => s.campataId === c.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const nascita = log.find((s) => EVENTI_NASCITA[s.evento]);
  if (nascita) {
    const foglio = nascita.rapportinoId
      ? rapportini.find((r) => r.id === nascita.rapportinoId)
      : undefined;
    let testo = EVENTI_NASCITA[nascita.evento];
    if (foglio) testo += ` n. ${foglio.numero} del ${formatDate(foglio.dataLavoro)}`;
    else if (nascita.rapportinoId) testo += " (foglio cancellato)";
    if (nascita.operatore) testo += `, ${nascita.operatore}`;
    parti.push(testo);
  }
  if (parti.length === 0) parti.push(`creata il ${formatDateTime(c.createdAt)}, senza file né rapportino`);

  if (c.originale && c.originale.trim() !== c.normalizzata) {
    parti.push(`scritta «${c.originale.trim()}»`);
  }
  if (!c.priorita) parti.push("senza priorità");
  if (c.nonTerminata) parti.push("iniziata e non finita");
  return parti.join(" · ");
}
