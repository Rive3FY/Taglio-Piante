const LARGHEZZA_MAX = 700;
const SOGLIA_BIANCO = 235;

function caricaImmagine(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Immagine non leggibile."));
    };
    img.src = url;
  });
}

/**
 * Prepara la firma per il PDF: toglie lo sfondo bianco, ritaglia i margini
 * e ridimensiona, così sul foglio ufficiale resta solo il tratto.
 */
export async function normalizzaFirma(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Scegli un file immagine (PNG o JPG).");
  }

  const img = await caricaImmagine(file);
  const base = document.createElement("canvas");
  base.width = img.naturalWidth;
  base.height = img.naturalHeight;
  const ctx = base.getContext("2d");
  if (!ctx) throw new Error("Elaborazione immagine non disponibile.");
  ctx.drawImage(img, 0, 0);

  const pixels = ctx.getImageData(0, 0, base.width, base.height);
  const dati = pixels.data;

  let minX = base.width;
  let minY = base.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < base.height; y += 1) {
    for (let x = 0; x < base.width; x += 1) {
      const i = (y * base.width + x) * 4;
      const chiaro = dati[i] > SOGLIA_BIANCO && dati[i + 1] > SOGLIA_BIANCO && dati[i + 2] > SOGLIA_BIANCO;
      if (chiaro || dati[i + 3] < 24) {
        dati[i + 3] = 0;
        continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) throw new Error("L’immagine sembra vuota: usa una firma su sfondo chiaro.");

  ctx.putImageData(pixels, 0, 0);

  const margine = 6;
  const sx = Math.max(0, minX - margine);
  const sy = Math.max(0, minY - margine);
  const sw = Math.min(base.width - sx, maxX - minX + margine * 2);
  const sh = Math.min(base.height - sy, maxY - minY + margine * 2);

  const scala = Math.min(1, LARGHEZZA_MAX / sw);
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scala);
  out.height = Math.round(sh * scala);
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Elaborazione immagine non disponibile.");
  outCtx.drawImage(base, sx, sy, sw, sh, 0, 0, out.width, out.height);

  const dataUrl = out.toDataURL("image/png");
  if (dataUrl.length > 900_000) {
    throw new Error("Immagine troppo pesante: ritaglia la firma e riprova.");
  }
  return dataUrl;
}
