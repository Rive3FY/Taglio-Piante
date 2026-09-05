"use client";

import JSZip from "jszip";
import { formatDate, todayIso } from "@/lib/format";
import { scaricaBlob } from "@/lib/download";
import { arrotondaEuro, etichettaUnita } from "./listino";
import { etichettaMese, type LineaContabile, type PrestazioniMese, type VoceContabile } from "./aggrega";

function xml(valore: unknown) {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Colonna = { w: number; titolo: string };
type RigaFoglio = { valori: unknown[]; stili: number[]; altezza: number };
type Foglio = { nome: string; titolo?: string; colonne: Colonna[]; righe: RigaFoglio[] };

const COLONNE_LINEA: Colonna[] = [
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

const COLONNE_RIEPILOGO: Colonna[] = [
  { w: 14, titolo: "Codice linea" },
  { w: 30, titolo: "Nome linea" },
  { w: 18, titolo: "Rapportini campate" },
  { w: 16, titolo: "Rapportini basi" },
  { w: 16, titolo: "Importo campate" },
  { w: 14, titolo: "Importo basi" },
  { w: 16, titolo: "Importo linea" },
];

const COLONNE_MESE_LINEA: Colonna[] = [
  { w: 14, titolo: "Codice linea" },
  { w: 28, titolo: "Nome linea" },
  { w: 12, titolo: "Sezione" },
  { w: 13, titolo: "Prestazione" },
  { w: 52, titolo: "Descrizione" },
  { w: 10, titolo: "U.M." },
  { w: 16, titolo: "Quantità" },
  { w: 16, titolo: "Prezzo unitario" },
  { w: 14, titolo: "Importo" },
];

const COLONNE_MESE_TOTALE: Colonna[] = [
  { w: 12, titolo: "Sezione" },
  { w: 13, titolo: "Prestazione" },
  { w: 52, titolo: "Descrizione" },
  { w: 10, titolo: "U.M." },
  { w: 16, titolo: "Quantità" },
  { w: 16, titolo: "Prezzo unitario" },
  { w: 14, titolo: "Importo" },
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

function unita(v: { unitaMisura: string }) {
  return etichettaUnita(v.unitaMisura) || v.unitaMisura;
}

async function creaXlsx(fogli: Foglio[]) {
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

  const sheets = fogli.map((foglio) => {
    const intestazioni: RigaFoglio[] = [];
    if (foglio.titolo) {
      intestazioni.push({ valori: [foglio.titolo], stili: [STILE.totale], altezza: 22 });
    }
    intestazioni.push({
      valori: foglio.colonne.map((c) => c.titolo),
      stili: foglio.colonne.map(() => STILE.header),
      altezza: 22,
    });

    const righe = [...intestazioni, ...foglio.righe];
    const ultimaCol = letteraColonna(foglio.colonne.length - 1);
    const cols = foglio.colonne
      .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w}" customWidth="1"/>`)
      .join("");

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

    const blocco = intestazioni.length;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${ultimaCol}${Math.max(1, righe.length)}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${blocco}" topLeftCell="A${blocco + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;
  });

  const sst = testi
    .map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`)
    .join("");

  const idStili = `rId${fogli.length + 1}`;
  const idTesti = `rId${fogli.length + 2}`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${fogli
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("\n")}
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
${fogli
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  )
  .join("\n")}
<Relationship Id="${idStili}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="${idTesti}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${fogli
      .map((f, i) => `<sheet name="${xml(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets>
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
  for (const [i, sheet] of sheets.entries()) {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheet);
  }

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

  const righe: RigaFoglio[] = [
    ...linea.voci.map((v) => ({
      valori: [
        linea.codiceLinea,
        linea.nomeLinea,
        v.codice,
        v.descrizione,
        unita(v),
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
  const bytes = await creaXlsx([{ nome: "Prestazioni", colonne: COLONNE_LINEA, righe }]);
  scaricaBlob(
    bytes,
    `prestazioni_${slug}_fino_${finoA}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function rigaVoceLinea(
  linea: { codiceLinea: string; nomeLinea: string },
  sezione: string,
  v: VoceContabile,
): RigaFoglio {
  return {
    valori: [
      linea.codiceLinea,
      linea.nomeLinea,
      sezione,
      v.codice,
      v.descrizione,
      unita(v),
      v.quantita,
      v.prezzoUnitario,
      v.importo,
    ],
    stili: [0, 0, 0, 0, STILE.wrap, 0, STILE.numero, STILE.euro, STILE.euro],
    altezza: altezzaDescrizione(v.descrizione),
  };
}

function rigaVoceTotale(sezione: string, v: VoceContabile): RigaFoglio {
  return {
    valori: [sezione, v.codice, v.descrizione, unita(v), v.quantita, v.prezzoUnitario, v.importo],
    stili: [0, 0, STILE.wrap, 0, STILE.numero, STILE.euro, STILE.euro],
    altezza: altezzaDescrizione(v.descrizione),
  };
}

function rigaTotale(valori: unknown[], colonneEuro: number[]): RigaFoglio {
  return {
    valori,
    stili: valori.map((valore, i) =>
      colonneEuro.includes(i)
        ? STILE.totaleEuro
        : typeof valore === "number"
          ? STILE.totaleNumero
          : STILE.totale,
    ),
    altezza: 22,
  };
}

function sommaCampo(numeri: (number | null)[]) {
  if (numeri.some((n) => n == null)) return null;
  return arrotondaEuro(numeri.reduce((s: number, n) => s + (n ?? 0), 0));
}

/**
 * Un solo file per il mese: riepilogo per linea, dettaglio linea per linea e totali del mese.
 * Le basi restano una sezione a parte, come a schermo, ma dentro la stessa linea.
 */
export async function scaricaPrestazioniMeseExcel(dati: PrestazioniMese, estrattoIl = todayIso()) {
  const titolo = `Prestazioni ${etichettaMese(dati.mese)} · estratto il ${formatDate(estrattoIl)}`;

  const riepilogo: RigaFoglio[] = [
    ...dati.perLinea.map((l) => ({
      valori: [
        l.codiceLinea,
        l.nomeLinea,
        l.rapportini,
        l.rapportiniBasi,
        l.importo,
        l.importoBasi,
        l.importoTotale,
      ],
      stili: [0, 0, STILE.numero, STILE.numero, STILE.euro, STILE.euro, STILE.euro],
      altezza: 20,
    })),
    rigaTotale(
      [
        "",
        `Totale ${etichettaMese(dati.mese)}`,
        dati.perLinea.reduce((s, l) => s + l.rapportini, 0),
        dati.perLinea.reduce((s, l) => s + l.rapportiniBasi, 0),
        sommaCampo(dati.perLinea.map((l) => l.importo)),
        sommaCampo(dati.perLinea.map((l) => l.importoBasi)),
        dati.importo,
      ],
      [4, 5, 6],
    ),
  ];

  const perLinea: RigaFoglio[] = [];
  for (const l of dati.perLinea) {
    for (const v of l.voci) perLinea.push(rigaVoceLinea(l, "Campate", v));
    for (const v of l.vociBasi) perLinea.push(rigaVoceLinea(l, "Basi", v));
    perLinea.push(
      rigaTotale(
        [l.codiceLinea, l.nomeLinea, "", "", "Totale linea", "", "", "", l.importoTotale],
        [8],
      ),
    );
  }

  const totali: RigaFoglio[] = [
    ...dati.voci.map((v) => rigaVoceTotale("Campate", v)),
    ...dati.vociBasi.map((v) => rigaVoceTotale("Basi", v)),
    rigaTotale(
      ["", "", `Totale ${etichettaMese(dati.mese)}`, "", "", "", dati.importo],
      [6],
    ),
  ];

  const bytes = await creaXlsx([
    { nome: "Riepilogo", titolo, colonne: COLONNE_RIEPILOGO, righe: riepilogo },
    { nome: "Per linea", titolo, colonne: COLONNE_MESE_LINEA, righe: perLinea },
    { nome: "Totale mese", titolo, colonne: COLONNE_MESE_TOTALE, righe: totali },
  ]);
  scaricaBlob(
    bytes,
    `prestazioni_${dati.mese}_per-linea.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
