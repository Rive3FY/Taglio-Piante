import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Linea, Prestazione, Rapportino } from "./types";
import { formatDate, lineaDescrizione } from "./format";

const QTY_X = 562;

const QTY_Y: Record<string, number> = {
  "1.1": 543.9,
  "1.2": 526.4,
  "1.3": 508.9,
  "2.1": 491.4,
  "2.2": 473.8,
  "2.3": 456.3,
  "2.4": 429,
  "2.5": 391.2,
  "3.1": 363.2,
  "3.2": 345.7,
  "3.3": 328.2,
  "3.4": 308.6,
  "3.5": 281.6,
  "5.2": 256.6,
  "5.3": 239.1,
  "5.4": 221.6,
  "6.1": 204.1,
  "6.2": 186.6,
  "6.3": 169,
};

let templateCache: ArrayBuffer | null = null;

async function loadTemplate() {
  if (!templateCache) {
    const res = await fetch("/scheda-taglio.pdf");
    if (!res.ok) throw new Error("Impossibile caricare il foglio ufficiale.");
    templateCache = await res.arrayBuffer();
  }
  return templateCache.slice(0);
}

function safeText(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"');
}

function dataUrlToBytes(dataUrl: string) {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function fillOfficialScheda(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const { item, linea, prestazioni } = opts;
  const pdf = await PDFDocument.load(await loadTemplate());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.08, 0.12, 0.18);

  const write = (text: string, x: number, y: number, size = 9) => {
    const value = safeText(text).trim();
    if (!value) return;
    try {
      page.drawText(value, { x, y, size, font, color: ink });
    } catch {
      page.drawText(value.replace(/[^\x20-\x7E]/g, " "), { x, y, size, font, color: ink });
    }
  };

  const writeInBox = (text: string, box: { x: number; y: number; w: number; h: number }, size: number) => {
    const value = safeText(text).trim();
    if (!value) return;
    let drawn = value;
    let width = 0;
    try {
      width = font.widthOfTextAtSize(drawn, size);
    } catch {
      drawn = value.replace(/[^\x20-\x7E]/g, " ");
      width = font.widthOfTextAtSize(drawn, size);
    }
    const x = box.x + Math.max(0, (box.w - width) / 2);
    const y = box.y + (box.h - size) / 2 + size * 0.18;
    write(drawn, x, y, size);
  };

  write(linea?.codice ?? "", 40, 778, 10);
  write(lineaDescrizione(linea), 268, 778, 9);
  write(item.campata, 524, 778, 10);
  write(formatDate(item.dataLavoro), 56, 747.2, 9);
  write(item.dipendenteTerna, 252, 747.2, 9);
  write(item.rappresentanteDitta, 58, 717.2, 9);
  write(item.ditta, 298, 717.2, 9);

  writeInBox(formatDate(item.dataLavoro), { x: 23.3, y: 85.2, w: 72.2, h: 15.6 }, 10);
  if (item.nOperatori > 0) {
    writeInBox(String(item.nOperatori), { x: 494.2, y: 100.8, w: 41.6, h: 15.6 }, 11);
  }

  const qtyById = new Map(item.righe.map((r) => [r.prestazioneId, r.quantita]));
  for (const p of prestazioni) {
    const q = qtyById.get(p.id);
    const y = QTY_Y[p.codice];
    if (!y || !q || q <= 0) continue;
    write(String(q), QTY_X, y, 9);
  }

  async function stamp(dataUrl: string | undefined, box: { x: number; y: number; w: number; h: number }) {
    if (!dataUrl?.startsWith("data:image")) return;
    try {
      const img = await pdf.embedPng(dataUrlToBytes(dataUrl));
      const scale = Math.min(box.w / img.width, box.h / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      page.drawImage(img, {
        x: box.x,
        y: box.y,
        width,
        height,
      });
    } catch {
      // firma non incorporabile
    }
  }

  // Giallo: Il Rappresentante TERNA / Il Designato TERNA (sinistra).
  // Fucsia: Il Rappresentante della Ditta / Il Designato Ditta (destra).
  await stamp(item.firmaTerna, { x: 32, y: 598, w: 250, h: 22 });
  await stamp(item.firmaOperatore, { x: 318, y: 598, w: 250, h: 22 });
  await stamp(item.firmaTerna, { x: 80, y: 52, w: 170, h: 20 });
  await stamp(item.firmaOperatore, { x: 420, y: 52, w: 150, h: 20 });

  const bytes = await pdf.save();
  return bytes;
}

export async function downloadOfficialScheda(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const bytes = await fillOfficialScheda(opts);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Scheda_taglio_${opts.item.numero}_${opts.linea?.codice ?? "linea"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function officialSchedaObjectUrl(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const bytes = await fillOfficialScheda(opts);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
