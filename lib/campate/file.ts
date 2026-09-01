import { parseCsvCampate, parseTestoCampate, type ParseCampateResult } from "./parse";

async function testoDaPdf(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pezzi: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const riga = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    pezzi.push(riga);
  }
  return pezzi.join(" ");
}

export async function parseFileCampate(file: File): Promise<ParseCampateResult> {
  const nome = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (nome.endsWith(".csv") || nome.endsWith(".txt") || file.type.includes("csv") || file.type.includes("text")) {
    const testo = new TextDecoder("utf-8").decode(buffer);
    return parseCsvCampate(testo) ?? parseTestoCampate(testo);
  }

  if (nome.endsWith(".pdf") || file.type === "application/pdf") {
    const testo = await testoDaPdf(buffer);
    const daCsv = parseCsvCampate(testo);
    if (daCsv && daCsv.riconosciute.length > 0) return daCsv;
    return parseTestoCampate(testo);
  }

  const testo = new TextDecoder("utf-8").decode(buffer);
  const daCsv = parseCsvCampate(testo);
  if (daCsv && daCsv.riconosciute.length > 0) return daCsv;
  return parseTestoCampate(testo);
}
