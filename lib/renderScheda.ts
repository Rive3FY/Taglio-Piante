"use client";

import { fillOfficialScheda } from "./fillScheda";
import type { Linea, Prestazione, Rapportino } from "./types";

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

function canvasToBlobUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Anteprima non generata."));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.88,
    );
  });
}

export async function pagineDaPdf(bytes: Uint8Array) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(bytes.byteLength);
  data.set(bytes);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1.5;
  const targetCssWidth =
    typeof window !== "undefined" ? Math.min(window.innerWidth - 24, 820) : 820;
  const urls: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = (targetCssWidth * dpr) / base.width;
    const viewport = page.getViewport({ scale: Math.max(1.15, scale) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Anteprima non disponibile su questo telefono.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    urls.push(await canvasToBlobUrl(canvas));
  }
  return urls;
}

export async function officialSchedaPagine(opts: {
  item: Rapportino;
  linea?: Linea;
  prestazioni?: Prestazione[] | null;
}) {
  const bytes = await fillOfficialScheda(opts);
  return pagineDaPdf(bytes);
}
