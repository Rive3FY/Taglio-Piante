/**
 * Prezziario di contratto, solo voci presenti sul rapportino.
 * CAD del listino = caduno = n. sul foglio.
 * Voci in mq (1.1 / 1.2 / 1.3): sul rapportino si indicano i metri quadri,
 * il prezzo è ogni 100 mq → importo = (mq / 100) × prezzo, arrotondato a 2 decimali.
 * 6.1 / 6.2: il prezzo è al metro cubo.
 */
export const LISTINO: Record<string, number> = {
  "1.1": 20.8,
  "1.2": 16.64,
  "1.3": 14.69,
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
  "5.2": 11.37,
  "5.3": 22.76,
  "5.4": 30.29,
  "6.1": 31.17,
  "6.2": 44.91,
  "6.3": 0.15,
};

export function prezzoChiamata(codice: string) {
  const n = LISTINO[codice];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
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
  return codice === "1.1" || codice === "1.2" || codice === "1.3";
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
  if (n === "mc" || n === "m3" || n === "m³") return "m³";
  if (n === "kg") return "kg";
  if (n.includes("mq") || n.includes("m²") || n.includes("m2")) return "100 mq";
  return unitaMisura || "—";
}
