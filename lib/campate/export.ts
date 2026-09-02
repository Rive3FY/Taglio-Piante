import { formatDate, formatDistInt, todayIso } from "@/lib/format";
import {
  CAMPATA_ORIGINE_LABEL,
  CAMPATA_PRIORITA_LABEL,
  CAMPATA_STATO_LABEL,
  type CampataLavoro,
  type CampataOrigine,
  type CampataPriorita,
  type CampataStatoLavoro,
} from "@/lib/types";
import { scaricaBlob } from "@/lib/download";

function cella(valore: unknown) {
  const testo = valore == null ? "" : String(valore);
  return `"${testo.replace(/"/g, '""')}"`;
}

export function nomeFileVistaCampate(filtri: {
  linea?: string;
  stato?: CampataStatoLavoro | "tutte";
  priorita?: CampataPriorita | "tutte";
}) {
  const parti = ["campate"];
  if (filtri.linea) parti.push(filtri.linea);
  if (filtri.stato && filtri.stato !== "tutte") parti.push(filtri.stato);
  if (filtri.priorita && filtri.priorita !== "tutte") parti.push(filtri.priorita);
  parti.push(todayIso());
  return `${parti.join("_")}.csv`;
}

export function scaricaVistaCampate(
  campate: CampataLavoro[],
  filtri: {
    linea?: string;
    stato?: CampataStatoLavoro | "tutte";
    priorita?: CampataPriorita | "tutte";
    origine?: CampataOrigine | "tutte";
  },
) {
  const header = [
    "Codice linea",
    "Nome linea",
    "Campata",
    "Distanza",
    "kV",
    "Originale",
    "Priorità",
    "Stato",
    "Origine",
    "Data taglio",
    "Operatore",
    "Da attenzionare",
    "Da non tagliare",
    "Note",
  ];
  const righe = campate.map((c) =>
    [
      c.codiceLinea,
      c.nomeLinea,
      c.normalizzata,
      c.distInt != null ? formatDistInt(c.distInt) : "",
      c.tensioneKv ?? "",
      c.originale,
      c.priorita ? CAMPATA_PRIORITA_LABEL[c.priorita] : "",
      CAMPATA_STATO_LABEL[c.stato],
      CAMPATA_ORIGINE_LABEL[c.origine],
      c.dataTaglio ? formatDate(c.dataTaglio) : "",
      c.operatore ?? "",
      c.attenzionare ? "sì" : "",
      c.daNonTagliare || c.stato === "tralasciata" ? "sì" : "",
      c.note ?? "",
    ]
      .map(cella)
      .join(";"),
  );
  const csv = `\uFEFFsep=;\n${[header.map(cella).join(";"), ...righe].join("\n")}`;
  scaricaBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), nomeFileVistaCampate(filtri));
}
