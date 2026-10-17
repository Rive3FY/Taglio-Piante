import type { Linea, Prestazione, Rapportino } from "./types";
import { preparaOfficialSchede, testoPdfPronto } from "./fillScheda";
import { scaricaBlob } from "./download";
import { mostraEsito } from "./esitoSalvataggio";
import { formatDate } from "./format";

export function toggleId(scelti: string[], id: string) {
  return scelti.includes(id) ? scelti.filter((x) => x !== id) : [...scelti, id];
}

/** Accende o spegne un gruppo senza toccare gli id fuori dal gruppo. */
export function toggleGruppo(scelti: string[], ids: string[]) {
  if (ids.length === 0) return scelti;
  const tutti = ids.every((id) => scelti.includes(id));
  if (tutti) {
    const via = new Set(ids);
    return scelti.filter((id) => !via.has(id));
  }
  const presenti = new Set(scelti);
  const aggiunti = ids.filter((id) => !presenti.has(id));
  return aggiunti.length === 0 ? scelti : [...scelti, ...aggiunti];
}

export function testoSelezione(n: number) {
  return n === 1 ? "1 selezionato" : `${n} selezionati`;
}

function ordinaPerData(lista: Rapportino[]) {
  return [...lista].sort(
    (a, b) => a.dataLavoro.localeCompare(b.dataLavoro) || a.numero.localeCompare(b.numero, "it"),
  );
}

function nomeFileSchede(lista: Rapportino[], ok: number) {
  const giorni = [...new Set(lista.map((r) => r.dataLavoro))].filter(Boolean).sort();
  if (giorni.length <= 1) return `Schede_taglio_${giorni[0] ?? "fogli"}.pdf`;
  return `Schede_taglio_${giorni[0]}_${giorni[giorni.length - 1]}_${ok}fogli.pdf`;
}

function testoQuando(lista: Rapportino[]) {
  const giorni = [...new Set(lista.map((r) => r.dataLavoro))].filter(Boolean);
  if (giorni.length === 1) return `del ${formatDate(giorni[0]!)}`;
  if (giorni.length > 1) return `di ${giorni.length} giorni`;
  return undefined;
}

/** Un unico PDF con i fogli scelti, in ordine di data. Il download parte dal popup. */
export async function scaricaRapportiniScelti(
  lista: Rapportino[],
  lineaDi: Map<string, Linea>,
  prestazioni: Prestazione[],
) {
  const ordinati = ordinaPerData(lista);
  if (ordinati.length === 0) return;
  const pdf = await preparaOfficialSchede(
    ordinati.map((item) => ({ item, linea: lineaDi.get(item.lineaId) })),
    prestazioni,
  );
  if (!pdf) return;
  const nome = nomeFileSchede(ordinati, pdf.ok);
  mostraEsito({
    titolo: "PDF pronto",
    testo: testoPdfPronto(pdf, testoQuando(ordinati)),
    dopo: "resta",
    azione: {
      etichetta: "Scarica PDF",
      esegui: () => scaricaBlob(pdf.bytes, nome, "application/pdf"),
    },
  });
}
