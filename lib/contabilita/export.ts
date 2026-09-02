import { formatDate, todayIso } from "@/lib/format";
import { scaricaBlob } from "@/lib/download";
import { etichettaUnita } from "./listino";
import type { LineaContabile } from "./aggrega";

function cella(valore: unknown) {
  const testo = valore == null ? "" : String(valore);
  return `"${testo.replace(/"/g, '""')}"`;
}

function numeroCsv(n: number | null) {
  if (n == null) return "";
  return String(n).replace(".", ",");
}

export function scaricaPrestazioniLineaExcel(
  linea: LineaContabile & { ultimaData?: string },
  finoA = todayIso(),
) {
  const header = [
    "Codice linea",
    "Nome linea",
    "Prestazione",
    "Descrizione",
    "U.M.",
    "Quantità totale",
    "Prezzo unitario",
    "Importo",
    "Rapportini",
    "Ultimo rapportino",
    "Estratto il",
  ];
  const coda = [
    linea.rapportini,
    linea.ultimaData ? formatDate(linea.ultimaData) : "",
    formatDate(finoA),
  ];
  const righe = linea.voci.map((v) =>
    [
      linea.codiceLinea,
      linea.nomeLinea,
      v.codice,
      v.descrizione,
      etichettaUnita(v.unitaMisura) || v.unitaMisura,
      numeroCsv(v.quantita),
      numeroCsv(v.prezzoUnitario),
      numeroCsv(v.importo),
      ...coda,
    ]
      .map(cella)
      .join(";"),
  );
  const totale = [
    linea.codiceLinea,
    linea.nomeLinea,
    "",
    "Totale linea",
    "",
    "",
    "",
    numeroCsv(linea.importo),
    ...coda,
  ]
    .map(cella)
    .join(";");
  const csv = `\uFEFFsep=;\n${[header.map(cella).join(";"), ...righe, totale].join("\n")}`;
  const slug = linea.codiceLinea.replace(/[^\w.-]+/g, "_");
  scaricaBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `prestazioni_${slug}_fino_${finoA}.csv`,
  );
}
