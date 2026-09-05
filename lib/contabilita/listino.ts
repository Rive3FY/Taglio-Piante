/**
 * Prezziario di contratto, voci del foglio ufficiale.
 * CAD del listino = caduno = n. sul foglio.
 * Voci in mq (1.1 / 1.2 / 1.3 / 1.5): sul rapportino si indicano i metri quadri,
 * il prezzo è ogni 100 mq → importo = (mq / 100) × prezzo, arrotondato a 2 decimali.
 * 1.4: prezzo al metro. 6.1 / 6.2: prezzo al metro cubo.
 * I prezzi si possono cambiare da Report → Prezzi; restano su questo dispositivo.
 */
const KEY = "rt.listino";
const EVENTO = "listino-aggiornato";

export const LISTINO: Record<string, number> = {
  "1.1": 20.8,
  "1.2": 16.64,
  "1.3": 14.69,
  "1.4": 5.9,
  "1.5": 5.67,
  "2.1": 10.58,
  "2.2": 14.02,
  "2.3": 55.66,
  "2.4": 985.56,
  "2.5": 7.22,
  "3.1": 3.31,
  "3.2": 6.64,
  "3.3": 13.23,
  "3.4": 707.04,
  "3.5": 5.46,
  "4.1": 12.06,
  "4.2": 14.16,
  "4.3": 27.85,
  "5.1": 7.57,
  "5.2": 11.37,
  "5.3": 22.76,
  "5.4": 30.29,
  "5.5": 0.39,
  "5.6": 0.36,
  "5.7": 1.21,
  "6.1": 31.17,
  "6.2": 44.91,
  "6.3": 0.15,
};

function leggiSovrascritte(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [codice, valore] of Object.entries(parsed)) {
      const n = typeof valore === "number" ? valore : Number(valore);
      if (Number.isFinite(n) && n >= 0) out[codice] = arrotondaEuro(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function listinoEffettivo(): Record<string, number> {
  return { ...LISTINO, ...leggiSovrascritte() };
}

export function prezzoChiamata(codice: string) {
  const n = listinoEffettivo()[codice];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function parsePrezzo(raw: string) {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return arrotondaEuro(n);
}

export function salvaListino(prezzi: Record<string, number>) {
  const puliti: Record<string, number> = {};
  for (const [codice, n] of Object.entries(prezzi)) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) puliti[codice] = arrotondaEuro(n);
  }
  localStorage.setItem(KEY, JSON.stringify(puliti));
  window.dispatchEvent(new Event(EVENTO));
}

export function ripristinaListinoContratto() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENTO));
}

export function listinoDiversoDalContratto() {
  const attuale = listinoEffettivo();
  return Object.keys({ ...LISTINO, ...attuale }).some((codice) => attuale[codice] !== LISTINO[codice]);
}

export function arrotondaEuro(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Superficie: quantità = mq totali, prezzo listino = ogni 100 mq. */
export function eUnitaMq(unitaMisura: string, codice = "") {
  const n = unitaMisura
    .trim()
    .toLowerCase()
    .replaceAll("°", "")
    .replaceAll("m²", "mq")
    .replaceAll("m2", "mq");
  if (n.includes("mq")) return true;
  return codice === "1.1" || codice === "1.2" || codice === "1.3" || codice === "1.5";
}

export function importoVoce(quantita: number, codice: string, unitaMisura: string) {
  const prezzo = prezzoChiamata(codice);
  if (prezzo == null) return null;
  const base = eUnitaMq(unitaMisura, codice) ? quantita / 100 : quantita;
  return arrotondaEuro(base * prezzo);
}

export function listinoCaricato() {
  return Object.keys(LISTINO).length > 0;
}

/** Unità come sul rapportino, in forma breve per la contabilità. */
export function etichettaUnita(unitaMisura: string) {
  const n = unitaMisura.trim().toLowerCase().replaceAll("°", "");
  if (n === "n" || n === "n." || n === "cad") return "n.";
  if (n === "g" || n === "g.") return "G";
  if (n === "m" || n === "ml") return "m";
  if (n === "mc" || n === "m3" || n === "m³") return "m³";
  if (n === "kg") return "kg";
  if (n.includes("mq") || n.includes("m²") || n.includes("m2")) return "100 mq";
  return unitaMisura || "—";
}
