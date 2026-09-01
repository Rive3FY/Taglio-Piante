export type Ruolo = "operatore" | "tecnico";

export type CampataTipo = "campata" | "base";

export type RapportinoStato = "bozza" | "da_prendere" | "in_attesa" | "archiviato";

export type SyncStatus = "local" | "pending" | "synced" | "error";

export type Session = {
  userId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
};

export type Linea = {
  id: string;
  codice: string;
  nome: string;
  tensioneKv?: number;
  zona?: string;
};

export type Campata = {
  id: string;
  lineaId: string;
  codice: string;
  tipo: CampataTipo;
  daSupporto: string;
  aSupporto: string;
  note?: string;
};

export type OperatoreTerna = {
  id: string;
  matricola: string;
  nome: string;
  cognome: string;
  ruolo: string;
};

export type Operatore = {
  id: string;
  nome: string;
  email: string;
  ruolo: Ruolo;
  /** Firma personale in PNG: usata come firma TERNA nei rapportini. */
  firma?: string;
  updatedAt: string;
};

export type Ditta = {
  id: string;
  ragioneSociale: string;
  partitaIva?: string;
};

export type Prestazione = {
  id: string;
  codice: string;
  descrizione: string;
  unitaMisura: string;
};

export type RapportinoRiga = {
  id: string;
  prestazioneId: string;
  quantita: number;
};

export type Rapportino = {
  id: string;
  numero: string;
  lineaId: string;
  campata: string;
  dataLavoro: string;
  ditta: string;
  rappresentanteDitta: string;
  dipendenteTerna: string;
  nOperatori: number;
  stato: RapportinoStato;
  syncStatus: SyncStatus;
  righe: RapportinoRiga[];
  firmaOperatore?: string;
  firmaTerna?: string;
  createdAt: string;
  updatedAt: string;
  presoDa?: string;
  presoAt?: string;
  inviatoAt?: string;
  archiviatoAt?: string;
};

export type SyncQueueItem = {
  id: string;
  rapportinoId: string;
  action: "upsert" | "submit" | "archive" | "take" | "delete";
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export const STATO_LABEL: Record<RapportinoStato, string> = {
  bozza: "Bozza",
  da_prendere: "Da prendere",
  in_attesa: "In attesa",
  archiviato: "Archiviato",
};

export const SYNC_LABEL: Record<SyncStatus, string> = {
  local: "Solo locale",
  pending: "In coda",
  synced: "Sincronizzato",
  error: "Errore sync",
};
