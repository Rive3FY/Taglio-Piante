import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Linea, Prestazione, Rapportino } from "./types";
import { formatDate, lineaDescrizione } from "./format";
import { scaricaBlob } from "./download";

/** Colonna quantità sul nuovo foglio ufficiale (716×1015 pt). */
const QTY_X = 668;

const QTY_Y: Record<string, number> = {
  "1.1": 717.9,
  "1.2": 696.2,
  "1.3": 674.5,
  "1.4": 652.9,
  "1.5": 631.2,
  "2.1": 609.5,
  "2.2": 587.8,
  "2.3": 566.1,
  "2.4": 536.2,
  "2.5": 498,
  "3.1": 468.2,
  "3.2": 445.7,
  "3.3": 424.6,
  "3.4": 401.7,
  "3.5": 368.9,
  "4.1": 340.5,
  "4.2": 321.7,
  "4.3": 302.9,
  "5.1": 284.1,
  "5.2": 265.4,
  "5.3": 246.6,
  "5.4": 227.7,
  "5.5": 208.9,
  "5.6": 190.1,
  "5.7": 171.3,
  "6.1": 152.6,
  "6.2": 133.8,
  "6.3": 113.1,
};

/** Firme CONSEGNA: tra la nota legale (y≈794) e le didascalie (y≈773). */
const FIRMA_CONSEGNA_TERNA = { x: 24, y: 786, w: 132, h: 20 };
const FIRMA_CONSEGNA_DITTA = { x: 398, y: 786, w: 162, h: 20 };

/** Firme in chiusura: tra «Data / N° operatori» (y≈81) e «Il Designato …» (y≈54). */
const FIRMA_DESIGNATO_TERNA = { x: 96, y: 56, w: 132, h: 26 };
const FIRMA_DESIGNATO_DITTA = { x: 560, y: 56, w: 158, h: 26 };

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

  const writeFit = (text: string, box: { x: number; y: number; w: number; h: number }, maxSize: number) => {
    const value = safeText(text).trim();
    if (!value) return;
    const minSize = 5.5;
    const lineGap = (size: number) => size * 1.12;
    const misura = (s: string, size: number) => {
      try {
        return font.widthOfTextAtSize(s, size);
      } catch {
        return font.widthOfTextAtSize(s.replace(/[^\x20-\x7E]/g, " "), size);
      }
    };
    const spezza = (size: number) => {
      const parole = value.split(/,\s*/);
      const righe: string[] = [""];
      for (const p of parole) {
        const pezzo = p.trim();
        if (!pezzo) continue;
        const candidato = righe[righe.length - 1] ? `${righe[righe.length - 1]}, ${pezzo}` : pezzo;
        if (misura(candidato, size) <= box.w || !righe[righe.length - 1]) {
          righe[righe.length - 1] = candidato;
        } else {
          righe.push(pezzo);
        }
      }
      return righe.filter(Boolean);
    };
    let size = maxSize;
    let righe = [value];
    while (size >= minSize) {
      if (misura(value, size) <= box.w) {
        righe = [value];
        break;
      }
      righe = spezza(size);
      const altezza = righe.length * lineGap(size);
      const troppoLarghe = righe.some((r) => misura(r, size) > box.w);
      if (!troppoLarghe && altezza <= box.h) break;
      size -= 0.4;
    }
    const totH = righe.length * lineGap(size);
    let y = box.y + Math.max(0, (box.h - totH) / 2) + size * 0.18;
    for (const riga of righe) {
      write(riga, box.x, y, size);
      y += lineGap(size);
    }
  };

  write(linea?.codice ?? "", 48, 942, 10);
  write(lineaDescrizione(linea), 323, 942, 9);
  writeFit(item.campata, { x: 618, y: 934, w: 88, h: 22 }, 10);
  write(formatDate(item.dataLavoro), 68, 917.6, 9);
  write(item.dipendenteTerna, 303, 917.6, 9);
  write(item.rappresentanteDitta, 70, 881.5, 9);
  write(item.ditta, 359, 881.5, 9);

  writeInBox(formatDate(item.dataLavoro), { x: 88, y: 62, w: 92, h: 16 }, 10);
  if (item.nOperatori > 0) {
    writeInBox(String(item.nOperatori), { x: 520, y: 62, w: 48, h: 16 }, 11);
  }

  const qtyById = new Map(item.righe.map((r) => [r.prestazioneId, r.quantita]));
  for (const p of prestazioni) {
    const q = qtyById.get(p.id);
    const y = QTY_Y[p.codice];
    if (!y || !q || q <= 0) continue;
    write(String(q), QTY_X, y, 9);
  }

  async function stamp(
    dataUrl: string | undefined,
    box: { x: number; y: number; w: number; h: number },
    align: "center" | "bottom" = "center",
  ) {
    if (!dataUrl?.startsWith("data:image")) return;
    try {
      const img = await pdf.embedPng(dataUrlToBytes(dataUrl));
      const scale = Math.min(box.w / img.width, box.h / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      const y =
        align === "bottom" ? box.y : box.y + Math.max(0, (box.h - height) / 2);
      page.drawImage(img, {
        x: box.x + (box.w - width) / 2,
        y,
        width,
        height,
      });
    } catch {
      // firma non incorporabile
    }
  }

  await stamp(item.firmaTerna, FIRMA_CONSEGNA_TERNA, "bottom");
  await stamp(item.firmaOperatore, FIRMA_CONSEGNA_DITTA, "bottom");
  await stamp(item.firmaTerna, FIRMA_DESIGNATO_TERNA);
  await stamp(item.firmaOperatore, FIRMA_DESIGNATO_DITTA);

  const bytes = await pdf.save();
  return bytes;
}

export async function downloadOfficialScheda(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni: Prestazione[];
}) {
  const bytes = await fillOfficialScheda(opts);
  scaricaBlob(
    bytes,
    `Scheda_taglio_${opts.item.numero}_${opts.linea?.codice ?? "linea"}.pdf`,
    "application/pdf",
  );
}

export async function downloadOfficialSchede(
  fogli: { item: Rapportino; linea?: Linea }[],
  prestazioni: Prestazione[],
  filename: string,
) {
  if (fogli.length === 0) return;
  if (fogli.length === 1) {
    await downloadOfficialScheda({ ...fogli[0], prestazioni });
    return;
  }
  const merged = await PDFDocument.create();
  let ok = 0;
  let ultimoErrore = "";
  for (const foglio of fogli) {
    try {
      const bytes = await fillOfficialScheda({ ...foglio, prestazioni });
      const src = await PDFDocument.load(bytes);
      const pagine = await merged.copyPages(src, src.getPageIndices());
      for (const pagina of pagine) merged.addPage(pagina);
      ok += 1;
    } catch (e) {
      ultimoErrore = e instanceof Error ? e.message : "foglio non generato";
    }
  }
  if (ok === 0) {
    throw new Error(ultimoErrore || "Nessun foglio da scaricare.");
  }
  const bytes = await merged.save();
  scaricaBlob(bytes, filename, "application/pdf");
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
