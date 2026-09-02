"use client";

import JSZip from "jszip";
import { formatDate, todayIso } from "@/lib/format";
import { scaricaBlob } from "@/lib/download";
import { etichettaUnita } from "./listino";
import type { LineaContabile } from "./aggrega";

function xml(valore: unknown) {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COLONNE = [
  { w: 14, titolo: "Codice linea" },
  { w: 28, titolo: "Nome linea" },
  { w: 13, titolo: "Prestazione" },
  { w: 52, titolo: "Descrizione" },
  { w: 10, titolo: "U.M." },
  { w: 16, titolo: "Quantità totale" },
  { w: 16, titolo: "Prezzo unitario" },
  { w: 14, titolo: "Importo" },
  { w: 13, titolo: "Rapportini" },
  { w: 18, titolo: "Ultimo rapportino" },
  { w: 14, titolo: "Estratto il" },
];

const STILE = {
  header: 1,
  wrap: 2,
  euro: 3,
  numero: 4,
  totale: 5,
  totaleEuro: 6,
  totaleNumero: 7,
} as const;

function letteraColonna(indice: number) {
  return String.fromCharCode(65 + indice);
}

function altezzaDescrizione(testo: string) {
  const linee = Math.max(1, Math.ceil(testo.length / 46));
  return Math.min(78, 20 + linee * 15);
}

async function creaXlsx(righe: { valori: unknown[]; stili: number[]; altezza: number }[]) {
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

  const ultimaCol = letteraColonna(COLONNE.length - 1);
  const ultimaRiga = righe.length;
  const cols = COLONNE.map(
    (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w}" customWidth="1"/>`,
  ).join("");

  const sheetRows = righe.map((riga, rIdx) => {
    const r = rIdx + 1;
    const celle = riga.valori.map((valore, cIdx) => {
      const rif = `${letteraColonna(cIdx)}${r}`;
      const stile = riga.stili[cIdx] ?? 0;
      if (typeof valore === "number" && Number.isFinite(valore)) {
        return `<c r="${rif}" s="${stile}"><v>${valore}</v></c>`;
      }
      if (valore == null || valore === "") {
        return `<c r="${rif}" s="${stile}"/>`;
      }
      const id = testoId(String(valore));
      return `<c r="${rif}" t="s" s="${stile}"><v>${id}</v></c>`;
    });
    return `<row r="${r}" ht="${riga.altezza}" customHeight="1">${celle.join("")}</row>`;
  });

  const sst = testi
    .map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`)
    .join("");

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
<sheets><sheet name="Prestazioni" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F3EC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
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
  <dimension ref="A1:${ultimaCol}${ultimaRiga}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`,
  );

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
}

export async function scaricaPrestazioniLineaExcel(
  linea: LineaContabile & { ultimaData?: string },
  finoA = todayIso(),
) {
  const ultimo = linea.ultimaData ? formatDate(linea.ultimaData) : "";
  const estratto = formatDate(finoA);
  const um = (v: { unitaMisura: string }) => etichettaUnita(v.unitaMisura) || v.unitaMisura;

  const headerStili = COLONNE.map(() => STILE.header);
  const righe = [
    {
      valori: COLONNE.map((c) => c.titolo),
      stili: headerStili,
      altezza: 22,
    },
    ...linea.voci.map((v) => ({
      valori: [
        linea.codiceLinea,
        linea.nomeLinea,
        v.codice,
        v.descrizione,
        um(v),
        v.quantita,
        v.prezzoUnitario,
        v.importo,
        linea.rapportini,
        ultimo,
        estratto,
      ],
      stili: [
        0,
        0,
        0,
        STILE.wrap,
        0,
        STILE.numero,
        STILE.euro,
        STILE.euro,
        STILE.numero,
        0,
        0,
      ],
      altezza: altezzaDescrizione(v.descrizione),
    })),
    {
      valori: [
        linea.codiceLinea,
        linea.nomeLinea,
        "",
        "Totale linea",
        "",
        "",
        "",
        linea.importo,
        linea.rapportini,
        ultimo,
        estratto,
      ],
      stili: [
        STILE.totale,
        STILE.totale,
        STILE.totale,
        STILE.totale,
        STILE.totale,
        STILE.totale,
        STILE.totale,
        STILE.totaleEuro,
        STILE.totaleNumero,
        STILE.totale,
        STILE.totale,
      ],
      altezza: 22,
    },
  ];

  const slug = linea.codiceLinea.replace(/[^\w.-]+/g, "_");
  const bytes = await creaXlsx(righe);
  scaricaBlob(
    bytes,
    `prestazioni_${slug}_fino_${finoA}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
