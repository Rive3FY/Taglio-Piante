/** Conversione C. est int / C. nord int (metri) → WGS84 per Google Maps. */

export type PuntoWgs84 = {
  lat: number;
  lng: number;
  zona: 32 | 33;
  datum: "WGS84";
  epsg: "EPSG:32632" | "EPSG:32633";
  incerto: boolean;
  etichetta: string;
};

const TOKEN_32 = [
  "torino", "milano", "genova", "firenze", "bologna", "parma", "modena", "piacenza",
  "cagliari", "sassari", "oristano", "nuoro", "olbia", "aosta", "novara", "alessandria",
  "savona", "la spezia", "livorno", "pisa", "lucca", "prato", "arezzo", "siena",
  "piemonte", "lombardia", "liguria", "toscana", "emilia", "sardegna", "valle d'aosta",
];

const TOKEN_33 = [
  "napoli", "maddaloni", "caserta", "salerno", "avellino", "benevento", "nola", "acerra",
  "bari", "lecce", "foggia", "taranto", "brindisi", "potenza", "matera", "pescara",
  "chieti", "l'aquila", "teramo", "campobasso", "isernia", "ancona", "ascoli", "macerata",
  "palermo", "catania", "messina", "siracusa", "trapani", "reggio", "catanzaro", "cosenza",
  "roma", "latina", "frosinone", "rieti", "viterbo", "perugia", "terni",
  "venezia", "padova", "treviso", "vicenza", "verona", "udine", "trieste",
  "campania", "puglia", "basilicata", "abruzzo", "molise", "marche", "lazio", "umbria",
  "sicilia", "calabria", "veneto", "friuli",
];

export function parseNumeroMetri(raw: string) {
  let t = raw.trim();
  if (!t) return undefined;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function utmWgs84(easting: number, northing: number, zona: 32 | 33) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = easting - 500000;
  const y = northing;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);
  const sinf = Math.sin(fp);
  const cosf = Math.cos(fp);
  const tanf = Math.tan(fp);
  const c1 = ep2 * cosf * cosf;
  const t1 = tanf * tanf;
  const n1 = a / Math.sqrt(1 - e2 * sinf * sinf);
  const r1 = (a * (1 - e2)) / (1 - e2 * sinf * sinf) ** 1.5;
  const d = x / (n1 * k0);
  const lat =
    fp -
    ((n1 * tanf) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lon0 = (((zona - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const lon =
    lon0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
      cosf;
  return { lat: (lat * 180) / Math.PI, lng: (lon * 180) / Math.PI };
}

function inBox(lat: number, lng: number, sud: number, nord: number, ovest: number, est: number) {
  return lat >= sud && lat <= nord && lng >= ovest && lng <= est;
}

function punteggioItalia(lat: number, lng: number, zona: 32 | 33) {
  const inZona = zona === 32 ? lng >= 6 && lng < 12.2 : lng >= 11.8 && lng <= 18.6;
  if (!inZona || lat < 36.4 || lat > 47.2) return 0;
  let s = 1;
  if (inBox(lat, lng, 37.7, 47.1, 6.6, 18.52)) s += 3;
  if (inBox(lat, lng, 38.85, 41.32, 8.08, 9.84)) s += 3;
  if (inBox(lat, lng, 36.64, 38.32, 12.4, 15.7)) s += 3;
  return s;
}

function hintDaNome(nome?: string): 32 | 33 | null {
  const t = (nome ?? "").toLowerCase();
  if (!t) return null;
  const h32 = TOKEN_32.some((p) => t.includes(p));
  const h33 = TOKEN_33.some((p) => t.includes(p));
  if (h32 && !h33) return 32;
  if (h33 && !h32) return 33;
  return null;
}

function eUtmPlausibile(est: number, nord: number) {
  return est > 160000 && est < 850000 && nord > 3_950_000 && nord < 5_250_000;
}

export function wgs84DaEstNord(
  est?: number | null,
  nord?: number | null,
  nomeLinea?: string,
): PuntoWgs84 | null {
  if (est == null || nord == null || !eUtmPlausibile(est, nord)) return null;

  const c32 = { ...utmWgs84(est, nord, 32), zona: 32 as const };
  const c33 = { ...utmWgs84(est, nord, 33), zona: 33 as const };
  const s32 = punteggioItalia(c32.lat, c32.lng, 32);
  const s33 = punteggioItalia(c33.lat, c33.lng, 33);
  const hint = hintDaNome(nomeLinea);

  let scelto = s33 >= s32 ? c33 : c32;
  let incerto = Math.abs(s33 - s32) < 2 && s32 > 0 && s33 > 0;

  if (hint === 32 && s32 > 0) {
    scelto = c32;
    incerto = s33 > 0 && Math.abs(s33 - s32) < 2;
  } else if (hint === 33 && s33 > 0) {
    scelto = c33;
    incerto = s32 > 0 && Math.abs(s33 - s32) < 2;
  }

  if (s32 === 0 && s33 === 0) return null;

  const epsg = scelto.zona === 32 ? "EPSG:32632" : "EPSG:32633";
  const etichetta = incerto
    ? `Ipotesi UTM ${scelto.zona}N WGS84. L’altra zona cade ancora in Italia: controlla il punto.`
    : `UTM ${scelto.zona}N WGS84 (${epsg})`;

  return {
    lat: scelto.lat,
    lng: scelto.lng,
    zona: scelto.zona,
    datum: "WGS84",
    epsg,
    incerto,
    etichetta,
  };
}

export function urlGoogleMaps(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
