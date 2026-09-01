/**
 * Il file tecnico indica spesso solo la seconda estremità della campata.
 * 22 → 21-22, 055 → 54-55. Se il valore è già un intervallo, si lascia così.
 */
export function normalizzaCampata(valore: string) {
  const pulito = valore.trim().replace(/–/g, "-").replace(/\s+/g, "");
  if (!pulito) return "";

  const intervallo = pulito.match(/^(\d+)\s*-\s*(\d+)$/);
  if (intervallo) return `${Number(intervallo[1])}-${Number(intervallo[2])}`;

  const pezzi = pulito.replace(/-+$/g, "").split("-").filter(Boolean);
  const primoNumero = pezzi.find((p) => /^\d+$/.test(p));
  if (!primoNumero) return pulito.replace(/-+$/g, "");

  const n = Number(primoNumero);
  const base = n > 0 ? `${n - 1}-${n}` : String(n);
  const extra = pezzi.filter((p) => p !== primoNumero);
  return extra.length > 0 ? `${base}/${extra.join("-")}` : base;
}

export function chiaveCampata(codiceLinea: string, normalizzata: string, priorita?: string | null) {
  const prio = priorita?.trim() || "_";
  return `${codiceLinea.trim().toUpperCase()}|${normalizzata}|${prio}`;
}

export function idCampataLavoro(
  codiceLinea: string,
  normalizzata: string,
  priorita?: string | null,
  tipo?: string | null,
) {
  const slug = `${codiceLinea}_${normalizzata}_${priorita || "x"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return tipo === "base" ? `clb_${slug}` : `cl_${slug}`;
}

/** Spezza il campo libero del rapportino in bianco: 21-22, 22-23 / 54-55. */
export function spezzaCampateTesto(testo: string) {
  return testo
    .split(/[,;/|\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
