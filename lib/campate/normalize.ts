/**
 * Numero di campata come lo scrive l’operatore e il LIDAR.
 * 22 resta 22 (non diventa 21-22). Un intervallo già espanso 21-22 si riduce
 * a 22, così i dati vecchi restano allineati. Forme speciali (78\2 80) restano
 * com’è, spazi compresi.
 */
export function normalizzaCampata(valore: string) {
  const pulito = valore.trim().replace(/–/g, "-").replace(/\s+/g, " ");
  if (!pulito) return "";

  const intervallo = pulito.match(/^(\d+)\s*-\s*(\d+)$/);
  if (intervallo) return String(Number(intervallo[2]));

  const conLettera = pulito.match(/^(\d+)\s*\/\s*([a-z]+)$/i);
  if (conLettera) return `${Number(conLettera[1])}/${conLettera[2].toUpperCase()}`;

  // Sostegno con lettere attaccate o staccate: 14DB e 14 db sono la stessa base.
  const conSuffisso = pulito.match(/^(\d+)\s*([a-z][a-z0-9]*)$/i);
  if (conSuffisso) return `${Number(conSuffisso[1])}${conSuffisso[2].toUpperCase()}`;

  const soloCifre = pulito.replace(/\s/g, "");
  if (/^\d+$/.test(soloCifre)) return String(Number(soloCifre));

  return pulito;
}

export function stessaNormalizzata(a: string, b: string) {
  return normalizzaCampata(a) === normalizzaCampata(b);
}

/** Testo da mostrare in elenco e sul foglio: sempre il numero canonico. */
export function mostraCampata(valore: string) {
  return normalizzaCampata(valore) || valore.trim();
}

export function chiaveCampata(codiceLinea: string, normalizzata: string, priorita?: string | null) {
  const prio = priorita?.trim() || "_";
  return `${codiceLinea.trim().toUpperCase()}|${normalizzaCampata(normalizzata)}|${prio}`;
}

export function idCampataLavoro(
  codiceLinea: string,
  normalizzata: string,
  priorita?: string | null,
  tipo?: string | null,
  anno?: number | null,
) {
  const slug = `${codiceLinea}_${normalizzaCampata(normalizzata)}_${priorita || "x"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const prefix = tipo === "base" ? "clb" : "cl";
  const y = anno ?? 2026;
  // Le righe 2026 tengono l’id storico, senza anno, così non si spezzano i collegamenti.
  return y === 2026 ? `${prefix}_${slug}` : `${prefix}_${y}_${slug}`;
}

/** La barra davanti alle lettere fa parte del sostegno: 17/A e 14/DB restano un pezzo solo. */
const SOSTEGNO_CON_LETTERA = /(\d)\s*\/\s*([a-z]+)(?![a-z0-9])/gi;
const BARRA_PROTETTA = "\u0001";

/**
 * Spezza il campo libero del rapportino: 22, 23 / 54, 17/A oppure 78\2 80.
 * Anche «22 23» e «22 e 23» sono due campate: unite diventerebbero la 2223.
 */
export function spezzaCampateTesto(testo: string) {
  return testo
    .replace(SOSTEGNO_CON_LETTERA, (_, n: string, l: string) => `${n}${BARRA_PROTETTA}${l}`)
    .split(/[,;/|\n]+|\s+e\s+/i)
    .flatMap((p) => {
      if (/^\s*\d+(\s+\d+)+\s*$/.test(p)) return p.trim().split(/\s+/);
      // 78\2 80 resta un pezzo solo. 14DB 15A sono due sostegni.
      if (p.includes("\\")) return [p];
      const pezzi = p.trim().split(/\s+/).filter(Boolean);
      if (pezzi.length > 1 && pezzi.every((x) => /\d/.test(x))) return pezzi;
      return [p];
    })
    .map((p) => p.split(BARRA_PROTETTA).join("/").trim())
    .filter(Boolean);
}

/** Più numeri sullo stesso foglio: 21-22, 22-23 → 22, 23. */
export function mostraTestoCampate(testo: string) {
  const pezzi = spezzaCampateTesto(testo).map(mostraCampata).filter(Boolean);
  return pezzi.length > 0 ? pezzi.join(", ") : testo.trim();
}
