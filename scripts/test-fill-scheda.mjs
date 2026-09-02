import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";

const template = fs.readFileSync(path.join(process.cwd(), "public/scheda-taglio.pdf"));
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("scheda-taglio.pdf")) {
    return {
      ok: true,
      arrayBuffer: async () => template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength),
    };
  }
  throw new Error(`fetch non mockato: ${url}`);
};

const { fillOfficialScheda } = await import("../lib/fillScheda.ts");

const item = {
  id: "rap_test",
  numero: "2026-001",
  lineaId: "lin_x",
  campata: "21-22, 22-23",
  dataLavoro: "2026-09-02",
  ditta: "VERDE SRL",
  rappresentanteDitta: "BIANCHI",
  dipendenteTerna: "MARIO ROSSI",
  nOperatori: 4,
  stato: "in_attesa",
  syncStatus: "local",
  righe: [
    { id: "r1", prestazioneId: "p21", quantita: 3 },
    { id: "r2", prestazioneId: "p61", quantita: 12 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const linea = { id: "lin_x", codice: "132L001", nome: "Linea prova tensione 132kV" };
const prestazioni = [
  { id: "p21", codice: "2.1", descrizione: "Taglio", unitaMisura: "N" },
  { id: "p61", codice: "6.1", descrizione: "Trasporto", unitaMisura: "Mc" },
];

const bytes = await fillOfficialScheda({ item, linea, prestazioni: undefined });
fs.writeFileSync("/tmp/scheda-test-new.pdf", bytes);

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = path.join(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
);
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
const page = await doc.getPage(1);
const scale = 1.5;
const viewport = page.getViewport({ scale });
const canvas = createCanvas(viewport.width, viewport.height);
const ctx = canvas.getContext("2d");
await page.render({ canvasContext: ctx, viewport }).promise;
fs.writeFileSync("/tmp/scheda-test-new.png", canvas.toBuffer("image/png"));
console.log("ok");
