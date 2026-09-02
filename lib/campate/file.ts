import {
  parseCsvCampate,
  parseMiglioreCampate,
  parseTestoCampate,
  type ParseCampateResult,
} from "./parse";

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items?: unknown }>;
  }>;
};

type PdfjsApi = {
  getDocument?: (opts: { data: Uint8Array; useSystemFonts?: boolean }) => { promise: Promise<PdfDoc> };
  GlobalWorkerOptions?: { workerSrc: string };
  default?: PdfjsApi;
};

async function bytesDelFile(file: File) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Lettura file non riuscita."));
    reader.readAsArrayBuffer(file);
  });
}

async function testoDaPdf(data: ArrayBuffer) {
  const mod = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfjsApi;
  const pdfjs = typeof mod.getDocument === "function" ? mod : (mod.default ?? mod);
  const getDocument = pdfjs.getDocument;
  if (typeof getDocument !== "function") {
    throw new Error("Lettore PDF non disponibile. Aggiorna l’app e riprova.");
  }
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pezzi: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = Array.isArray(content.items) ? content.items : [];
    const parti: string[] = [];
    for (let k = 0; k < items.length; k += 1) {
      const item = items[k] as { str?: unknown };
      if (item && typeof item.str === "string") parti.push(item.str);
    }
    pezzi.push(parti.join(" "));
  }
  return pezzi.join(" ");
}

function parseTestoGenerico(testo: string): ParseCampateResult {
  return (
    parseMiglioreCampate(parseTestoCampate(testo), parseCsvCampate(testo)) ??
    parseTestoCampate(testo)
  );
}

function eCsvOTesto(file: File) {
  const nome = file.name.toLowerCase();
  const tipo = (file.type || "").toLowerCase();
  return (
    nome.endsWith(".csv") ||
    nome.endsWith(".txt") ||
    tipo.includes("csv") ||
    tipo.includes("text")
  );
}

export async function parseFileCampate(file: File): Promise<ParseCampateResult> {
  const nome = file.name.toLowerCase();
  const buffer = await bytesDelFile(file);

  if (eCsvOTesto(file)) {
    const testo = new TextDecoder("utf-8").decode(buffer);
    return parseTestoGenerico(testo);
  }

  if (nome.endsWith(".pdf") || file.type === "application/pdf") {
    const testo = await testoDaPdf(buffer);
    return parseTestoGenerico(testo);
  }

  const testo = new TextDecoder("utf-8").decode(buffer);
  return parseTestoGenerico(testo);
}
