export type Ruolo = "operatore" | "tecnico";

export type CampataTipo = "campata" | "base";

export type CampataPriorita = "urgente" | "differibile";

export type CampataStatoLavoro = "da_tagliare" | "tagliata" | "tralasciata";

export type CampataOrigine = "prevista" | "aggiuntiva";

export type CampataEsito = "tagliata" | "tralasciata";

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

/** Unità operativa di taglio: arriva dal file del tecnico o da un rapportino sul campo. */
export type CampataLavoro = {
  id: string;
  lineaId: string;
  codiceLinea: string;
  nomeLinea: string;
  tensioneKv?: number;
  originale: string;
  normalizzata: string;
  priorita?: CampataPriorita;
  stato: CampataStatoLavoro;
  origine: CampataOrigine;
  dataTaglio?: string;
  operatore?: string;
  note?: string;
  attenzionare?: boolean;
  rapportinoId?: string;
  importId?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type CampataStorico = {
  id: string;
  campataId: string;
  evento: string;
  stato?: CampataStatoLavoro;
  priorita?: CampataPriorita;
  operatore?: string;
  rapportinoId?: string;
  note?: string;
  createdAt: string;
};

export type ImportCampate = {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  riconosciute: number;
  nuove: number;
  esistenti: number;
  duplicati: number;
  scartate: number;
};

export type RapportinoCampata = {
  id: string;
  campataId?: string;
  originale: string;
  normalizzata: string;
  priorita?: CampataPriorita;
  esito: CampataEsito;
  note?: string;
  attenzionare?: boolean;
  aggiuntiva?: boolean;
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
  /** Esiti per campata: usati dal rapportino precompilato e dal collegamento in bianco. */
  esitiCampate?: RapportinoCampata[];
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
  /** Account che ha creato il rapportino: gli altri operatori non lo vedono. */
  ownerId?: string;
  presoDa?: string;
  presoAt?: string;
  inviatoAt?: string;
  archiviatoAt?: string;
};

export type SyncQueueItem = {
  id: string;
  rapportinoId: string;
  action: "upsert" | "submit" | "archive" | "take" | "delete" | "campate";
  createdAt: string;
  attempts: number;
  lastError?: string;
};

/** Campate aggiuntive da togliere da Supabase dopo la cancellazione del rapportino. */
export type CampataDeleteQueueItem = {
  id: string;
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
  error: "Invio non riuscito",
};

export const CAMPATA_STATO_LABEL: Record<CampataStatoLavoro, string> = {
  da_tagliare: "Da tagliare",
  tagliata: "Tagliata",
  tralasciata: "Tralasciata",
};

export const CAMPATA_PRIORITA_LABEL: Record<CampataPriorita, string> = {
  urgente: "Urgente",
  differibile: "Differibile",
};

export const CAMPATA_ORIGINE_LABEL: Record<CampataOrigine, string> = {
  prevista: "Prevista",
  aggiuntiva: "Aggiuntiva",
};
