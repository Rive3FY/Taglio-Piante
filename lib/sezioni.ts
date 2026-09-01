import type { Rapportino, RapportinoStato, Session } from "./types";

export type SezioneKey = "bozze" | "in-attesa" | "archiviati";

export type Sezione = {
  key: SezioneKey;
  kicker: string;
  titolo: string;
  descrizione: string;
  vuoto: string;
  stati: RapportinoStato[];
};

export const SEZIONI: Sezione[] = [
  {
    key: "bozze",
    kicker: "Locale",
    titolo: "Bozze",
    descrizione: "Rapportini iniziati e non ancora inviati.",
    vuoto: "Nessuna bozza locale.",
    stati: ["bozza", "da_prendere"],
  },
  {
    key: "in-attesa",
    kicker: "Inviati",
    titolo: "In attesa",
    descrizione: "Già inviati al tecnico, in attesa di verifica.",
    vuoto: "Nessun rapportino in attesa.",
    stati: ["in_attesa"],
  },
  {
    key: "archiviati",
    kicker: "Chiusi",
    titolo: "Archiviati",
    descrizione: "Chiusi dal tecnico e conservati sulla linea.",
    vuoto: "Nessun rapportino archiviato.",
    stati: ["archiviato"],
  },
];

export function sezioneDa(key: string) {
  return SEZIONI.find((s) => s.key === key);
}

/**
 * Il tecnico vede tutto, l'operatore solo i rapportini che ha creato.
 * I rapportini vecchi non hanno il proprietario: per quelli vale il nome in presoDa.
 */
export function rapportinoVisibile(item: Rapportino, session: Session | null) {
  if (!session) return false;
  if (session.ruolo === "tecnico") return true;
  if (item.ownerId) return item.ownerId === session.userId;
  return !item.presoDa || item.presoDa === session.nome;
}

export function rapportiniDellaSezione(
  rapportini: Rapportino[],
  sezione: Sezione,
  session: Session | null,
) {
  return rapportini.filter(
    (r) => sezione.stati.includes(r.stato) && rapportinoVisibile(r, session),
  );
}
