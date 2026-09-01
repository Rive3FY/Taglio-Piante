import type { Ditta, Linea, Operatore, Prestazione, Rapportino, RapportinoRiga } from "@/lib/types";

type RapportinoRow = {
  id: string;
  numero: string;
  linea_id: string;
  campata: string;
  data_lavoro: string;
  ditta: string;
  rappresentante_ditta: string;
  dipendente_terna: string;
  n_operatori: number;
  stato: Rapportino["stato"];
  righe: RapportinoRiga[];
  firma_operatore_path: string | null;
  firma_terna_path: string | null;
  preso_da: string | null;
  preso_at: string | null;
  inviato_at: string | null;
  archiviato_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type LineaRow = {
  id: string;
  codice: string;
  nome: string;
  tensione_kv: number | null;
  zona: string | null;
};

type DittaRow = {
  id: string;
  ragione_sociale: string;
  partita_iva: string | null;
};

type ProfiloRow = {
  user_id: string;
  nome: string;
  email: string;
  ruolo: Operatore["ruolo"];
  updated_at: string;
};

type PrestazioneRow = {
  id: string;
  codice: string;
  descrizione: string;
  unita_misura: string;
};

export function rapportinoToRow(
  item: Rapportino,
  paths: { firmaOperatore?: string; firmaTerna?: string },
): Omit<RapportinoRow, "deleted_at"> {
  return {
    id: item.id,
    numero: item.numero,
    linea_id: item.lineaId,
    campata: item.campata,
    data_lavoro: item.dataLavoro,
    ditta: item.ditta,
    rappresentante_ditta: item.rappresentanteDitta,
    dipendente_terna: item.dipendenteTerna,
    n_operatori: item.nOperatori,
    stato: item.stato,
    righe: item.righe,
    firma_operatore_path: paths.firmaOperatore ?? null,
    firma_terna_path: paths.firmaTerna ?? null,
    preso_da: item.presoDa ?? null,
    preso_at: item.presoAt ?? null,
    inviato_at: item.inviatoAt ?? null,
    archiviato_at: item.archiviatoAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function rowToRapportino(
  row: RapportinoRow,
  signatures: { firmaOperatore?: string; firmaTerna?: string },
): Rapportino {
  return {
    id: row.id,
    numero: row.numero,
    lineaId: row.linea_id,
    campata: row.campata,
    dataLavoro: row.data_lavoro,
    ditta: row.ditta,
    rappresentanteDitta: row.rappresentante_ditta,
    dipendenteTerna: row.dipendente_terna,
    nOperatori: row.n_operatori,
    stato: row.stato,
    syncStatus: "synced",
    righe: row.righe ?? [],
    firmaOperatore: signatures.firmaOperatore,
    firmaTerna: signatures.firmaTerna,
    presoDa: row.preso_da ?? undefined,
    presoAt: row.preso_at ?? undefined,
    inviatoAt: row.inviato_at ?? undefined,
    archiviatoAt: row.archiviato_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToLinea(row: LineaRow): Linea {
  return {
    id: row.id,
    codice: row.codice,
    nome: row.nome,
    tensioneKv: row.tensione_kv ?? undefined,
    zona: row.zona ?? undefined,
  };
}

export function lineaToRow(linea: Linea) {
  return {
    id: linea.id,
    codice: linea.codice,
    nome: linea.nome,
    tensione_kv: linea.tensioneKv ?? null,
    zona: linea.zona ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function rowToDitta(row: DittaRow): Ditta {
  return {
    id: row.id,
    ragioneSociale: row.ragione_sociale,
    partitaIva: row.partita_iva ?? undefined,
  };
}

export function dittaToRow(ditta: Ditta) {
  return {
    id: ditta.id,
    ragione_sociale: ditta.ragioneSociale,
    partita_iva: ditta.partitaIva ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function rowToOperatore(row: ProfiloRow): Operatore {
  return {
    id: row.user_id,
    nome: row.nome,
    email: row.email,
    ruolo: row.ruolo,
    updatedAt: row.updated_at,
  };
}

export function rowToPrestazione(row: PrestazioneRow): Prestazione {
  return {
    id: row.id,
    codice: row.codice,
    descrizione: row.descrizione,
    unitaMisura: row.unita_misura,
  };
}

export function prestazioneToRow(p: Prestazione) {
  return {
    id: p.id,
    codice: p.codice,
    descrizione: p.descrizione,
    unita_misura: p.unitaMisura,
    updated_at: new Date().toISOString(),
  };
}

export type { RapportinoRow };
