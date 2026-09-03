import JSZip from "jszip";
import { formatDate, formatDistInt, todayIso } from "@/lib/format";
import {
  CAMPATA_ORIGINE_LABEL,
  CAMPATA_PRIORITA_LABEL,
  CAMPATA_STATO_LABEL,
  CAMPATA_TIPO_LABEL,
  etichettaRinvio,
  type CampataLavoro,
  type CampataOrigine,
  type CampataPriorita,
  type CampataStatoLavoro,
} from "@/lib/types";
import { scaricaBlob } from "@/lib/download";
import { annoDi } from "./anno";

function xml(valore: unknown) {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Colonna = { w: number; titolo: string };

const COLONNE: Colonna[] = [
  { w: 10, titolo: "Anno" },
  { w: 10, titolo: "Tipo" },
  { w: 14, titolo: "Codice linea" },
  { w: 28, titolo: "Nome linea" },
  { w: 12, titolo: "Campata" },
  { w: 12, titolo: "Distanza" },
  { w: 14, titolo: "Est int" },
  { w: 14, titolo: "Nord int" },
  { w: 8, titolo: "kV" },
  { w: 12, titolo: "Originale" },
  { w: 14, titolo: "Priorità" },
  { w: 14, titolo: "Stato" },
  { w: 12, titolo: "Origine" },
  { w: 14, titolo: "Data taglio" },
  { w: 18, titolo: "Operatore" },
  { w: 16, titolo: "Da attenzionare" },
  { w: 16, titolo: "Da non tagliare" },
  { w: 36, titolo: "Note" },
];

/** Colonne in più solo nel file dell’elenco parallelo «Da riprendere». */
const COLONNE_RINVIO: Colonna[] = [
  { w: 18, titolo: "Da riprendere" },
  { w: 14, titolo: "Ripresa fatta" },
  { w: 36, titolo: "Note ripresa" },
];

function letteraColonna(indice: number) {
  let n = indice;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

async function creaXlsx(righe: string[][], colonne: Colonna[]) {
  const testi: string[] = [];
  const indiceTesto = new Map<string, number>();
  const testoId = (valore: string) => {
    const esistente = indiceTesto.get(valore);
    if (esistente != null) return esistente;
    const id = testi.length;
    testi.push(valore);
    indiceTesto.set(valore, id);
    return id;
  };

  const ultimaCol = letteraColonna(colonne.length - 1);
  const cols = colonne.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w}" customWidth="1"/>`).join("");
  const sheetRows = righe.map((valori, rIdx) => {
    const r = rIdx + 1;
    const celle = valori.map((valore, cIdx) => {
      const rif = `${letteraColonna(cIdx)}${r}`;
      const stile = rIdx === 0 ? 1 : 0;
      const id = testoId(valore);
      return `<c r="${rif}" t="s" s="${stile}"><v>${id}</v></c>`;
    });
    return `<row r="${r}">${celle.join("")}</row>`;
  });
  const sst = testi.map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`).join("");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Campate" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F3EC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
  </cellXfs>
</styleSheet>`,
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${testi.length}" uniqueCount="${testi.length}">${sst}</sst>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${ultimaCol}${righe.length}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`,
  );

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export function nomeFileVistaCampate(filtri: {
  linea?: string;
  stato?: CampataStatoLavoro | "tutte";
  priorita?: CampataPriorita | "tutte";
  anno?: number;
  prefisso?: string;
}) {
  const parti = [filtri.prefisso ?? "campate"];
  if (filtri.anno) parti.push(String(filtri.anno));
  if (filtri.linea) parti.push(filtri.linea);
  if (filtri.stato && filtri.stato !== "tutte") parti.push(filtri.stato);
  if (filtri.priorita && filtri.priorita !== "tutte") parti.push(filtri.priorita);
  parti.push(todayIso());
  return `${parti.join("_")}.xlsx`;
}

function rigaRinvio(c: CampataLavoro) {
  return [
    etichettaRinvio(c),
    c.rinvioFattaIl ? formatDate(c.rinvioFattaIl.slice(0, 10)) : "",
    c.rinvioNote ?? "",
  ];
}

function rigaVista(c: CampataLavoro) {
  return [
    String(annoDi(c)),
    c.tipo === "base" ? CAMPATA_TIPO_LABEL.base : CAMPATA_TIPO_LABEL.campata,
    c.codiceLinea,
    c.nomeLinea,
    c.normalizzata,
    c.distInt != null ? formatDistInt(c.distInt) : "",
    c.estInt != null ? String(c.estInt) : "",
    c.nordInt != null ? String(c.nordInt) : "",
    c.tensioneKv != null ? String(c.tensioneKv) : "",
    c.originale,
    c.priorita ? CAMPATA_PRIORITA_LABEL[c.priorita] : "",
    CAMPATA_STATO_LABEL[c.stato],
    CAMPATA_ORIGINE_LABEL[c.origine],
    c.dataTaglio ? formatDate(c.dataTaglio) : "",
    c.operatore ?? "",
    c.attenzionare ? "sì" : "",
    c.daNonTagliare || c.stato === "tralasciata" ? "sì" : "",
    c.note ?? "",
  ];
}

export function ordinaVistaExport(campate: CampataLavoro[]) {
  return [...campate].sort(
    (a, b) =>
      a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
      (a.tipo === "base" ? 1 : 0) - (b.tipo === "base" ? 1 : 0) ||
      a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }) ||
      (a.priorita ?? "").localeCompare(b.priorita ?? ""),
  );
}

export async function bytesVistaCampate(campate: CampataLavoro[], opts?: { rinvio?: boolean }) {
  const colonne = opts?.rinvio ? [...COLONNE, ...COLONNE_RINVIO] : COLONNE;
  const righe = ordinaVistaExport(campate).map((c) =>
    opts?.rinvio ? [...rigaVista(c), ...rigaRinvio(c)] : rigaVista(c),
  );
  return creaXlsx([colonne.map((c) => c.titolo), ...righe], colonne);
}

export async function scaricaVistaCampate(
  campate: CampataLavoro[],
  filtri: {
    linea?: string;
    stato?: CampataStatoLavoro | "tutte";
    priorita?: CampataPriorita | "tutte";
    origine?: CampataOrigine | "tutte";
    anno?: number;
    prefisso?: string;
    rinvio?: boolean;
  },
) {
  const bytes = await bytesVistaCampate(campate, { rinvio: filtri.rinvio });
  scaricaBlob(
    bytes,
    nomeFileVistaCampate(filtri),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
