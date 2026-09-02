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

function cellaTesto(testo: unknown, stile?: string) {
  const sid = stile ? ` ss:StyleID="${stile}"` : "";
  return `<Cell${sid}><Data ss:Type="String">${xml(testo)}</Data></Cell>`;
}

function cellaNumero(n: number | null, stile = "num") {
  if (n == null || !Number.isFinite(n)) return cellaTesto("");
  return `<Cell ss:StyleID="${stile}"><Data ss:Type="Number">${n}</Data></Cell>`;
}

const COLONNE = [
  { w: 88, titolo: "Codice linea" },
  { w: 168, titolo: "Nome linea" },
  { w: 72, titolo: "Prestazione" },
  { w: 240, titolo: "Descrizione" },
  { w: 56, titolo: "U.M." },
  { w: 96, titolo: "Quantità totale" },
  { w: 96, titolo: "Prezzo unitario" },
  { w: 88, titolo: "Importo" },
  { w: 72, titolo: "Rapportini" },
  { w: 112, titolo: "Ultimo rapportino" },
  { w: 96, titolo: "Estratto il" },
];

export function scaricaPrestazioniLineaExcel(
  linea: LineaContabile & { ultimaData?: string },
  finoA = todayIso(),
) {
  const ultimo = linea.ultimaData ? formatDate(linea.ultimaData) : "";
  const estratto = formatDate(finoA);
  const um = (v: { unitaMisura: string }) => etichettaUnita(v.unitaMisura) || v.unitaMisura;

  const header = `<Row ss:StyleID="header" ss:Height="22">${COLONNE.map((c) => cellaTesto(c.titolo, "header")).join("")}</Row>`;
  const corpo = linea.voci.map(
    (v) =>
      `<Row ss:Height="20">${[
        cellaTesto(linea.codiceLinea),
        cellaTesto(linea.nomeLinea),
        cellaTesto(v.codice),
        cellaTesto(v.descrizione, "wrap"),
        cellaTesto(um(v)),
        cellaNumero(v.quantita, "qty"),
        cellaNumero(v.prezzoUnitario),
        cellaNumero(v.importo),
        cellaNumero(linea.rapportini, "int"),
        cellaTesto(ultimo),
        cellaTesto(estratto),
      ].join("")}</Row>`,
  );
  const totale = `<Row ss:StyleID="totale" ss:Height="22">${[
    cellaTesto(linea.codiceLinea, "totale"),
    cellaTesto(linea.nomeLinea, "totale"),
    cellaTesto("", "totale"),
    cellaTesto("Totale linea", "totale"),
    cellaTesto("", "totale"),
    cellaTesto("", "totale"),
    cellaTesto("", "totale"),
    cellaNumero(linea.importo, "totaleNum"),
    cellaNumero(linea.rapportini, "totaleInt"),
    cellaTesto(ultimo, "totale"),
    cellaTesto(estratto, "totale"),
  ].join("")}</Row>`;

  const cols = COLONNE.map((c) => `<Column ss:AutoFitWidth="0" ss:Width="${c.w}"/>`).join("");
  const xls = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E7F3EC" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="wrap"><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="qty"><NumberFormat ss:Format="#,##0.##"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="int"><NumberFormat ss:Format="0"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="totale"><Font ss:Bold="1"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="totaleNum"><Font ss:Bold="1"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="totaleInt"><Font ss:Bold="1"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/><NumberFormat ss:Format="0"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
 </Styles>
 <Worksheet ss:Name="Prestazioni">
  <Table ss:DefaultRowHeight="18">${cols}${header}${corpo.join("")}${totale}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const slug = linea.codiceLinea.replace(/[^\w.-]+/g, "_");
  scaricaBlob(
    new Blob(["\uFEFF", xls], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `prestazioni_${slug}_fino_${finoA}.xls`,
  );
}
