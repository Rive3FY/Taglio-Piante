import type { Rapportino } from "@/lib/types";

export const SENZA_PREPOSTO = "__senza__";

export type GruppoPreposto = {
  chiave: string;
  nome: string;
  /** Come è stato scritto il nome sui fogli (es. «Pirozzi», «Pirozzi Mario»). */
  varianti: string[];
};

const PAROLE_VUOTE = new Set(["sig", "sigr", "sigra", "signor", "signore", "geom", "il", "la"]);

function tokens(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !PAROLE_VUOTE.has(t));
}

function contenuto(a: string[], b: string[]) {
  return a.length > 0 && a.every((t) => b.includes(t));
}

/**
 * Il Sig. del foglio è scritto a mano: «Pirozzi», «PIROZZI MARIO» e «Sig. Pirozzi»
 * sono la stessa persona. Due nomi stanno insieme se le parole dell'uno sono tutte nell'altro.
 */
export function raggruppaPreposti(rapportini: Rapportino[]) {
  const conteggio = new Map<string, number>();
  for (const r of rapportini) {
    const nome = (r.rappresentanteDitta ?? "").trim().replace(/\s+/g, " ");
    if (!nome || tokens(nome).length === 0) continue;
    conteggio.set(nome, (conteggio.get(nome) ?? 0) + 1);
  }

  const nomi = [...conteggio.keys()];
  const padre = nomi.map((_, i) => i);
  const trova = (i: number): number => (padre[i] === i ? i : (padre[i] = trova(padre[i]!)));
  const tok = nomi.map(tokens);
  for (let i = 0; i < nomi.length; i += 1) {
    for (let j = i + 1; j < nomi.length; j += 1) {
      if (contenuto(tok[i]!, tok[j]!) || contenuto(tok[j]!, tok[i]!)) padre[trova(i)] = trova(j);
    }
  }

  const perRadice = new Map<number, string[]>();
  nomi.forEach((n, i) => {
    const r = trova(i);
    perRadice.set(r, [...(perRadice.get(r) ?? []), n]);
  });

  const gruppi: GruppoPreposto[] = [...perRadice.values()].map((varianti) => {
    const ordinate = [...varianti].sort(
      (a, b) => (conteggio.get(b) ?? 0) - (conteggio.get(a) ?? 0) || b.length - a.length,
    );
    const nome = ordinate[0]!;
    return { chiave: tokens(nome).sort().join(" "), nome, varianti: ordinate };
  });
  return gruppi.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export function chiavePreposto(r: Rapportino, gruppi: GruppoPreposto[]) {
  const nome = (r.rappresentanteDitta ?? "").trim().replace(/\s+/g, " ");
  if (!nome) return SENZA_PREPOSTO;
  return gruppi.find((g) => g.varianti.includes(nome))?.chiave ?? SENZA_PREPOSTO;
}

export function nomePreposto(chiave: string, gruppi: GruppoPreposto[]) {
  if (chiave === SENZA_PREPOSTO) return "Senza preposto";
  return gruppi.find((g) => g.chiave === chiave)?.nome ?? chiave;
}
