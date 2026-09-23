import { wgs84DaEstNord } from "@/lib/campate/geo";
import { campataETagliata, type CampataLavoro, type CampataPriorita } from "@/lib/types";

export type PuntoMappa = {
  lat: number;
  lng: number;
  tagliata: boolean;
};

export type RiepilogoMappa = {
  punti: PuntoMappa[];
  senzaCoordinate: number;
  daTagliare: number;
  tagliate: number;
};

const ROSSO = { r: 198, g: 54, b: 42 };
const ROSSO_CALDO = { r: 255, g: 186, b: 176 };
const VERDE = { r: 34, g: 140, b: 78 };
const VERDE_CALDO = { r: 176, g: 236, b: 198 };
const SFONDO = { r: 16, g: 16, b: 24 };

/** Campate del piano, senza le basi: il rosso è da tagliare, il verde è già chiusa. */
export function riepilogoMappa(campate: CampataLavoro[], priorita: CampataPriorita): RiepilogoMappa {
  const punti: PuntoMappa[] = [];
  let senzaCoordinate = 0;
  let daTagliare = 0;
  let tagliate = 0;
  for (const c of campate) {
    if (c.tipo === "base" || c.priorita !== priorita) continue;
    const tagliata = campataETagliata(c);
    if (tagliata) tagliate += 1;
    else daTagliare += 1;
    const punto = wgs84DaEstNord(c.estInt, c.nordInt, c.nomeLinea);
    if (!punto) {
      senzaCoordinate += 1;
      continue;
    }
    punti.push({ lat: punto.lat, lng: punto.lng, tagliata });
  }
  return { punti, senzaCoordinate, daTagliare, tagliate };
}

function lerp(da: number, a: number, t: number) {
  return da + (a - da) * t;
}

function sopra(base: number, colore: number, alpha: number) {
  return base * (1 - alpha) + colore * alpha;
}

/** Dove rosso e verde si incontrano il colore schiarisce, così restano visibili entrambi. */
function schermo(base: number, colore: number, alpha: number) {
  const acceso = 255 - ((255 - base) * (255 - colore)) / 255;
  return base * (1 - alpha) + acceso * alpha;
}

/**
 * Macchie di densità, come la heatmap di una partita: più campate vicine, più la macchia è calda.
 * Il raggio è di qualche chilometro, così una zona di lavoro diventa una nuvola e non un puntino.
 */
export function rasterDensita(punti: PuntoMappa[], cols: number, rows: number) {
  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    data[o] = SFONDO.r;
    data[o + 1] = SFONDO.g;
    data[o + 2] = SFONDO.b;
    data[o + 3] = 255;
  }
  if (punti.length === 0 || cols < 2 || rows < 2) return data;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of punti) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const cos = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const padLat = Math.max((maxLat - minLat) * 0.16, 0.05);
  const padLng = Math.max((maxLng - minLng) * 0.16, 0.05 / cos);
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  const spanLngKm = (maxLng - minLng) * 111 * cos;
  const spanLatKm = (maxLat - minLat) * 111;
  const aspetto = spanLngKm / Math.max(spanLatKm, 0.001);
  const aspettoTela = cols / rows;

  let mapW = cols;
  let mapH = rows;
  let ox = 0;
  let oy = 0;
  if (aspetto > aspettoTela) {
    mapH = Math.max(1, Math.round(cols / aspetto));
    oy = Math.floor((rows - mapH) / 2);
  } else {
    mapW = Math.max(1, Math.round(rows * aspetto));
    ox = Math.floor((cols - mapW) / 2);
  }

  const rosso = new Float32Array(cols * rows);
  const verde = new Float32Array(cols * rows);
  const kmPerPx = spanLngKm / mapW;
  const sigmaPx = Math.min(26, Math.max(3.4, 4.5 / Math.max(kmPerPx, 0.001)));
  const raggio = Math.ceil(sigmaPx * 3);
  const inv = 1 / (2 * sigmaPx * sigmaPx);

  for (const p of punti) {
    const x = ox + ((p.lng - minLng) / (maxLng - minLng)) * (mapW - 1);
    const y = oy + ((maxLat - p.lat) / (maxLat - minLat)) * (mapH - 1);
    const griglia = p.tagliata ? verde : rosso;
    const x0 = Math.max(0, Math.floor(x - raggio));
    const x1 = Math.min(cols - 1, Math.ceil(x + raggio));
    const y0 = Math.max(0, Math.floor(y - raggio));
    const y1 = Math.min(rows - 1, Math.ceil(y + raggio));
    const r2 = raggio * raggio;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - y;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        griglia[yy * cols + xx] += Math.exp(-d2 * inv);
      }
    }
  }

  for (let i = 0; i < cols * rows; i++) {
    const tr = 1 - Math.exp(-rosso[i] / 1.15);
    const tv = 1 - Math.exp(-verde[i] / 1.15);
    if (tr < 0.02 && tv < 0.02) continue;
    let r = SFONDO.r;
    let g = SFONDO.g;
    let b = SFONDO.b;
    if (tv >= 0.02) {
      const alpha = Math.min(0.9, 0.22 + tv * 0.7);
      r = sopra(r, lerp(VERDE.r, VERDE_CALDO.r, tv), alpha);
      g = sopra(g, lerp(VERDE.g, VERDE_CALDO.g, tv), alpha);
      b = sopra(b, lerp(VERDE.b, VERDE_CALDO.b, tv), alpha);
    }
    if (tr >= 0.02) {
      const alpha = Math.min(0.92, 0.24 + tr * 0.7);
      r = schermo(r, lerp(ROSSO.r, ROSSO_CALDO.r, tr), alpha);
      g = schermo(g, lerp(ROSSO.g, ROSSO_CALDO.g, tr), alpha);
      b = schermo(b, lerp(ROSSO.b, ROSSO_CALDO.b, tr), alpha);
    }
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  return data;
}
