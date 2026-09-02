"use client";

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Linea, Prestazione, Rapportino } from "./types";
import { lineaDescrizione } from "./format";
import { scaricaBlob } from "./download";
import {
  SCHEDA_AL_SIG_DITTA,
  SCHEDA_AL_SIG_REP,
  SCHEDA_FIRME,
  SCHEDA_FOOTER,
  SCHEDA_HEADER,
  SCHEDA_IN_DATA,
  SCHEDA_IN_DATA_TERNA,
  schedaQtyBox,
  type Box,
  type LineText,
} from "./schedaLayout";

let templateCache: Uint8Array | null = null;

async function loadTemplateBytes(): Promise<Uint8Array> {
  if (!templateCache) {
    const res = await fetch("/scheda-taglio.pdf", { cache: "no-store" });
    if (!res.ok) throw new Error("Impossibile caricare il foglio ufficiale.");
    templateCache = new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(templateCache);
}

function safeText(value?: string | null) {
  return (value ?? "")
    .replace(/—/g, "-")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"');
}

function dataUrlToBytes(dataUrl: string) {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Data sul foglio ufficiale: 12/08/26, come sul cartaceo. */
function formatSchedaDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(-2)}`;
}

type Writer = {
  writeInBox: (text: string | null | undefined, box: Box, size: number) => void;
  writeFit: (text: string | null | undefined, box: Box, maxSize: number) => void;
  writeOnLine: (
    text: string | null | undefined,
    line: LineText,
    uppercase?: boolean,
  ) => void;
};

function createWriter(
  page: ReturnType<PDFDocument["getPages"]>[number],
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
): Writer {
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

  const writeInBox = (text: string | null | undefined, box: Box, size: number) => {
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

  const writeFit = (text: string | null | undefined, box: Box, maxSize: number) => {
    const value = safeText(text).trim();
    if (!value) return;
    const minSize = 5.5;
    const lineGap = (size: number) => size * 1.12;
    const spezza = (size: number) => {
      const parole = value.split(/,\s*/);
      const righe: string[] = [""];
      for (let i = 0; i < parole.length; i += 1) {
        const pezzo = parole[i]!.trim();
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
    for (let i = 0; i < righe.length; i += 1) {
      const riga = righe[i]!;
      const width = misura(riga, size);
      const x = box.x + Math.max(0, (box.w - width) / 2);
      write(riga, x, y, size);
      y += lineGap(size);
    }
  };

  const writeOnLine = (
    text: string | null | undefined,
    line: LineText,
    uppercase = false,
  ) => {
    const raw = safeText(text).trim();
    if (!raw) return;
    let value = (uppercase ? raw.toUpperCase() : raw).replace(/\s+/g, " ");
    let size = line.size;
    while (size > 6 && misura(value, size) > line.maxW) size -= 0.3;
    if (misura(value, size) > line.maxW) {
      while (value.length > 1 && misura(`${value.slice(0, -1)}.`, size) > line.maxW) {
        value = value.slice(0, -1);
      }
      value = `${value}.`;
    }
    write(value, line.x, line.y, size);
  };

  return { writeInBox, writeFit, writeOnLine };
}

export async function fillOfficialScheda(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni?: Prestazione[] | null;
}) {
  const { item, linea } = opts;
  const prestazioni = asArray(opts.prestazioni);

  try {
    const pdf = await PDFDocument.load(await loadTemplateBytes());
    const page = pdf.getPages()[0];
    if (!page) throw new Error("Il foglio ufficiale non contiene pagine.");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const w = createWriter(page, font);

    w.writeInBox(linea?.codice ?? "", SCHEDA_HEADER.codice, 10);
    w.writeFit(lineaDescrizione(linea), SCHEDA_HEADER.descr, 12);
    w.writeInBox(item.campata ?? "", SCHEDA_HEADER.campata, 12);

    w.writeOnLine(formatSchedaDate(item.dataLavoro ?? ""), SCHEDA_IN_DATA);
    w.writeOnLine(item.dipendenteTerna, SCHEDA_IN_DATA_TERNA, true);
    w.writeOnLine(item.rappresentanteDitta, SCHEDA_AL_SIG_REP, true);
    w.writeOnLine(item.ditta, SCHEDA_AL_SIG_DITTA, true);
    w.writeInBox(formatSchedaDate(item.dataLavoro ?? ""), SCHEDA_FOOTER.date, 9);
    if (item.nOperatori > 0) {
      w.writeInBox(String(item.nOperatori), SCHEDA_FOOTER.nOperatori, 11);
    }

    const qtyById = new Map(asArray(item.righe).map((r) => [r.prestazioneId, r.quantita]));
    for (let i = 0; i < prestazioni.length; i += 1) {
      const p = prestazioni[i]!;
      const q = qtyById.get(p.id);
      const box = schedaQtyBox(p.codice);
      if (!box || !q || q <= 0) continue;
      w.writeInBox(String(q), box, 10);
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Compilazione foglio PDF non riuscita: ${msg}`);
  }
}

export async function downloadOfficialScheda(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni?: Prestazione[] | null;
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
  filename: string,
  prestazioni?: Prestazione[] | null,
) {
  const lista = asArray(fogli);
  const prest = asArray(prestazioni);
  if (lista.length === 0) return;

  if (lista.length === 1) {
    await downloadOfficialScheda({ ...lista[0]!, prestazioni: prest });
    return;
  }

  const merged = await PDFDocument.create();
  let ok = 0;
  let ultimoErrore = "";

  for (let i = 0; i < lista.length; i += 1) {
    const foglio = lista[i]!;
    try {
      const bytes = await fillOfficialScheda({ ...foglio, prestazioni: prest });
      const src = await PDFDocument.load(bytes);
      const count = src.getPageCount();
      const indices = count > 0 ? Array.from({ length: count }, (_, idx) => idx) : [0];
      const pagine = merged.copyPages(src, indices);
      if (!Array.isArray(pagine)) throw new Error("Unione PDF non riuscita.");
      for (let j = 0; j < pagine.length; j += 1) merged.addPage(pagine[j]!);
      ok += 1;
    } catch (e) {
      ultimoErrore = e instanceof Error ? e.message : "foglio non generato";
    }
  }

  if (ok === 0) throw new Error(ultimoErrore || "Nessun foglio da scaricare.");
  const bytes = await merged.save();
  scaricaBlob(bytes, filename, "application/pdf");
}

export async function officialSchedaObjectUrl(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni?: Prestazione[] | null;
}) {
  const bytes = await fillOfficialScheda(opts);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
