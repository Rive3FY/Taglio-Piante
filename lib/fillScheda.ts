import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Linea, Prestazione, Rapportino } from "./types";
import { formatDate, lineaDescrizione } from "./format";
import { scaricaBlob } from "./download";
import {
  SCHEDA_AL_SIG_DITTA,
  SCHEDA_AL_SIG_REP,
  SCHEDA_FIRME,
  SCHEDA_FOOTER,
  SCHEDA_HEADER,
  SCHEDA_IN_DATA,
  SCHEDA_IN_DATA_TERNA,
  SCHEDA_QTY,
  type Box,
} from "./schedaLayout";

let templateCache: ArrayBuffer | null = null;

async function loadTemplate() {
  if (!templateCache) {
    if (typeof window === "undefined") {
      const fs = await import("node:fs");
      const path = await import("node:path");
      templateCache = fs.readFileSync(path.join(process.cwd(), "public/scheda-taglio.pdf")).buffer;
    } else {
      const res = await fetch("/scheda-taglio.pdf");
      if (!res.ok) throw new Error("Impossibile caricare il foglio ufficiale.");
      templateCache = await res.arrayBuffer();
    }
  }
  return templateCache.slice(0);
}

function safeText(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"');
}

function dataUrlToBytes(dataUrl: string) {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type Writer = {
  writeInBox: (text: string, box: Box, size: number) => void;
  writeFit: (text: string, box: Box, maxSize: number) => void;
  writeComb: (
    text: string,
    cells: ReadonlyArray<{ x: number; w: number }>,
    row: Pick<Box, "y" | "h">,
    size?: number,
    uppercase?: boolean,
  ) => void;
};

function createWriter(page: ReturnType<PDFDocument["getPages"]>[number], font: Awaited<ReturnType<PDFDocument["embedFont"]>>): Writer {
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

  const misura = (s: string, size: number) => {
    try {
      return font.widthOfTextAtSize(s, size);
    } catch {
      return font.widthOfTextAtSize(s.replace(/[^\x20-\x7E]/g, " "), size);
    }
  };

  const writeInBox = (text: string, box: Box, size: number) => {
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

  const writeFit = (text: string, box: Box, maxSize: number) => {
    const value = safeText(text).trim();
    if (!value) return;
    const minSize = 5.5;
    const lineGap = (size: number) => size * 1.12;
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
      const width = misura(riga, size);
      const x = box.x + Math.max(0, (box.w - width) / 2);
      write(riga, x, y, size);
      y += lineGap(size);
    }
  };

  const writeComb = (
    text: string,
    cells: ReadonlyArray<{ x: number; w: number }>,
    row: Pick<Box, "y" | "h">,
    size = 8.5,
    uppercase = false,
  ) => {
    const raw = safeText(text).trim();
    if (!raw) return;
    const chars = (uppercase ? raw.toUpperCase() : raw).replace(/\s+/g, " ");
    const max = Math.min(chars.length, cells.length);
    for (let i = 0; i < max; i += 1) {
      writeInBox(chars[i]!, { x: cells[i]!.x, y: row.y, w: cells[i]!.w, h: row.h }, size);
    }
  };

  return { writeInBox, writeFit, writeComb };
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
  const w = createWriter(page, font);

  w.writeInBox(linea?.codice ?? "", SCHEDA_HEADER.codice, 10);
  w.writeFit(lineaDescrizione(linea), SCHEDA_HEADER.descr, 12);
  w.writeInBox(item.campata, SCHEDA_HEADER.campata, 12);

  w.writeComb(formatDate(item.dataLavoro), SCHEDA_IN_DATA.cells, SCHEDA_IN_DATA, 8);
  w.writeComb(item.dipendenteTerna, SCHEDA_IN_DATA_TERNA.cells, SCHEDA_IN_DATA_TERNA, 7.5, true);

  w.writeComb(item.rappresentanteDitta, SCHEDA_AL_SIG_REP.cells, SCHEDA_AL_SIG_REP, 8, true);
  w.writeComb(item.ditta, SCHEDA_AL_SIG_DITTA.cells, SCHEDA_AL_SIG_DITTA, 8, true);

  w.writeComb(formatDate(item.dataLavoro), SCHEDA_FOOTER.date.cells, SCHEDA_FOOTER.date, 8);
  if (item.nOperatori > 0) {
    w.writeInBox(String(item.nOperatori), SCHEDA_FOOTER.nOperatori, 11);
  }

  const qtyById = new Map(item.righe.map((r) => [r.prestazioneId, r.quantita]));
  for (const p of prestazioni) {
    const q = qtyById.get(p.id);
    const y = SCHEDA_QTY.y[p.codice];
    if (!y || !q || q <= 0) continue;
    w.writeInBox(String(q), { x: SCHEDA_QTY.x, y, w: SCHEDA_QTY.w, h: SCHEDA_QTY.h }, 10);
  }

  async function stamp(dataUrl: string | undefined, box: Box) {
    if (!dataUrl?.startsWith("data:image")) return;
    try {
      const img = await pdf.embedPng(dataUrlToBytes(dataUrl));
      const scale = Math.min(box.w / img.width, box.h / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      page.drawImage(img, {
        x: box.x + (box.w - width) / 2,
        y: box.y + Math.max(0, (box.h - height) / 2),
        width,
        height,
      });
    } catch {
      // firma non incorporabile
    }
  }

  await stamp(item.firmaTerna, SCHEDA_FIRME.designatoTerna);
  await stamp(item.firmaOperatore, SCHEDA_FIRME.designatoDitta);

  return pdf.save();
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
