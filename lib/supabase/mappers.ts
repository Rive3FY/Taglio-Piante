import type {
  CampataLavoro,
  CampataStorico,
  Ditta,
  ImportCampate,
  Linea,
  Operatore,
  Prestazione,
  Rapportino,
  RapportinoCampata,
  RapportinoRiga,
} from "@/lib/types";
import { statoRapportinoNormalizzato } from "@/lib/types";

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
  esiti_campate?: RapportinoCampata[] | null;
  firma_operatore_path: string | null;
  firma_terna_path: string | null;
  owner_id?: string | null;
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
  firma: string | null;
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
    esiti_campate: item.esitiCampate ?? [],
    firma_operatore_path: paths.firmaOperatore ?? null,
    firma_terna_path: paths.firmaTerna ?? null,
    // Se il proprietario non è noto si omette, per non sovrascrivere quello già salvato.
    ...(item.ownerId ? { owner_id: item.ownerId } : {}),
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
    stato: statoRapportinoNormalizzato(row.stato),
    syncStatus: "synced",
    righe: row.righe ?? [],
    esitiCampate: row.esiti_campate ?? undefined,
    firmaOperatore: signatures.firmaOperatore,
    firmaTerna: signatures.firmaTerna,
    ownerId: row.owner_id ?? undefined,
    presoDa: row.preso_da ?? undefined,
    presoAt: row.preso_at ?? undefined,
    inviatoAt: row.inviato_at ?? undefined,
    archiviatoAt: row.archiviato_at ?? (row.stato === "in_attesa" ? row.inviato_at ?? row.updated_at : undefined),
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
    firma: row.firma ?? undefined,
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

export function campataLavoroToRow(c: CampataLavoro) {
  return {
    id: c.id,
    linea_id: c.lineaId,
    codice_linea: c.codiceLinea,
    nome_linea: c.nomeLinea,
    tensione_kv: c.tensioneKv ?? null,
    originale: c.originale,
    normalizzata: c.normalizzata,
    tipo: c.tipo ?? "campata",
    priorita: c.priorita ?? null,
    stato: c.stato === "tralasciata" ? "tagliata" : c.stato,
    origine: c.origine,
    data_taglio: c.dataTaglio ?? null,
    operatore: c.operatore ?? null,
    note: c.note ?? null,
    attenzionare: Boolean(c.attenzionare),
    attenzionare_by: c.attenzionareBy ?? null,
    attenzionare_fatta_il: c.attenzionareFattaIl ?? null,
    attenzionare_fatta_by: c.attenzionareFattaBy ?? null,
    da_non_tagliare: Boolean(c.daNonTagliare),
    da_non_tagliare_by: c.daNonTagliareBy ?? null,
    rinvio_mese: c.rinvioMese ?? null,
    rinvio_anno: c.rinvioAnno ?? null,
    rinvio_note: c.rinvioNote ?? null,
    rinvio_by: c.rinvioBy ?? null,
    rinvio_fatta_il: c.rinvioFattaIl ?? null,
    rinvio_fatta_by: c.rinvioFattaBy ?? null,
    dist_int: c.distInt ?? null,
    est_int: c.estInt ?? null,
    nord_int: c.nordInt ?? null,
    rapportino_id: c.rapportinoId ?? null,
    import_id: c.importId ?? null,
    anno: c.anno ?? 2026,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/** Sul server possono esserci ancora righe con lo stato vecchio «tralasciata». */
export function rowToCampataLavoro(
  row: Omit<ReturnType<typeof campataLavoroToRow>, "stato"> & {
    stato: string;
    tensione_kv?: number | null;
    anno?: number | null;
  },
): CampataLavoro {
  return {
    id: row.id,
    lineaId: row.linea_id,
    codiceLinea: row.codice_linea,
    nomeLinea: row.nome_linea,
    tensioneKv: row.tensione_kv ?? undefined,
    originale: row.originale,
    normalizzata: row.normalizzata,
    tipo: row.tipo ?? "campata",
    priorita: (row.priorita as CampataLavoro["priorita"]) ?? undefined,
    stato: (row.stato === "tralasciata" ? "tagliata" : row.stato) as CampataLavoro["stato"],
    origine: row.origine as CampataLavoro["origine"],
    dataTaglio: row.data_taglio ?? undefined,
    operatore: row.operatore ?? undefined,
    note: row.note ?? undefined,
    attenzionare: Boolean(row.attenzionare),
    attenzionareBy: row.attenzionare_by ?? undefined,
    attenzionareFattaIl: row.attenzionare_fatta_il ?? undefined,
    attenzionareFattaBy: row.attenzionare_fatta_by ?? undefined,
    daNonTagliare: Boolean(row.da_non_tagliare) || row.stato === "tralasciata",
    daNonTagliareBy: row.da_non_tagliare_by ?? undefined,
    rinvioMese: row.rinvio_mese ?? undefined,
    rinvioAnno: row.rinvio_anno ?? undefined,
    rinvioNote: row.rinvio_note ?? undefined,
    rinvioBy: row.rinvio_by ?? undefined,
    rinvioFattaIl: row.rinvio_fatta_il ?? undefined,
    rinvioFattaBy: row.rinvio_fatta_by ?? undefined,
    distInt: row.dist_int ?? undefined,
    estInt: row.est_int ?? undefined,
    nordInt: row.nord_int ?? undefined,
    rapportinoId: row.rapportino_id ?? undefined,
    importId: row.import_id ?? undefined,
    anno: row.anno ?? 2026,
    syncStatus: "synced",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function campataStoricoToRow(s: CampataStorico) {
  return {
    id: s.id,
    campata_id: s.campataId,
    evento: s.evento,
    stato: s.stato ?? null,
    priorita: s.priorita ?? null,
    operatore: s.operatore ?? null,
    rapportino_id: s.rapportinoId ?? null,
    note: s.note ?? null,
    created_at: s.createdAt,
  };
}

export function rowToCampataStorico(row: ReturnType<typeof campataStoricoToRow>): CampataStorico {
  return {
    id: row.id,
    campataId: row.campata_id,
    evento: row.evento,
    stato: (row.stato as CampataStorico["stato"]) ?? undefined,
    priorita: (row.priorita as CampataStorico["priorita"]) ?? undefined,
    operatore: row.operatore ?? undefined,
    rapportinoId: row.rapportino_id ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

export function importCampateToRow(i: ImportCampate) {
  return {
    id: i.id,
    file_name: i.fileName,
    created_at: i.createdAt,
    created_by: i.createdBy,
    riconosciute: i.riconosciute,
    nuove: i.nuove,
    esistenti: i.esistenti,
    duplicati: i.duplicati,
    scartate: i.scartate,
    anno: i.anno ?? 2026,
  };
}

export function rowToImportCampate(
  row: ReturnType<typeof importCampateToRow> & { anno?: number | null },
): ImportCampate {
  return {
    id: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    riconosciute: row.riconosciute,
    nuove: row.nuove,
    esistenti: row.esistenti,
    duplicati: row.duplicati,
    scartate: row.scartate,
    anno: row.anno ?? 2026,
  };
}

export type { RapportinoRow };
