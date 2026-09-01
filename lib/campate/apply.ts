import { db, enqueueSync } from "@/lib/db";
import { uid, tensioneDaCodice, todayIso } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { campataLavoroToRow, campataStoricoToRow, importCampateToRow, lineaToRow } from "@/lib/supabase/mappers";
import { upsertCampateLavoro } from "@/lib/supabase/remote";
import type {
  CampataLavoro,
  CampataStorico,
  ImportCampate,
  Linea,
  Rapportino,
  RapportinoCampata,
  Session,
} from "@/lib/types";
import { idCampataLavoro, chiaveCampata, normalizzaCampata, spezzaCampateTesto } from "./normalize";
import type { AnteprimaImport } from "./preview";

function richiediRete() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non è configurato su questo dispositivo.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Serve la rete per importare o aggiornare le campate sul database.");
  }
  return supabase;
}

async function scriviStorico(evento: CampataStorico) {
  await db.campateStorico.put(evento);
}

export async function confermaImportCampate(opts: {
  fileName: string;
  anteprima: AnteprimaImport;
  session: Session;
}) {
  const supabase = richiediRete();
  const now = new Date().toISOString();
  const importId = uid("imp");
  const linee = await db.linee.toArray();
  const perCodice = new Map(linee.map((l) => [l.codice.toUpperCase(), l]));
  const esistenti = await db.campateLavoro.toArray();
  const perChiave = new Map(
    esistenti.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata, c.priorita), c]),
  );

  const nuoveLinee: Linea[] = [];
  for (const codice of opts.anteprima.lineeNuove) {
    const voce = opts.anteprima.voci.find((v) => v.codiceLinea === codice);
    const linea: Linea = {
      id: `lin_${codice.toLowerCase()}`,
      codice,
      nome: voce?.nomeLinea?.trim() || codice,
      tensioneKv: tensioneDaCodice(codice),
    };
    perCodice.set(codice, linea);
    nuoveLinee.push(linea);
  }

  const daScrivere: CampataLavoro[] = [];
  const storico: CampataStorico[] = [];

  for (const voce of opts.anteprima.voci) {
    const linea = perCodice.get(voce.codiceLinea);
    if (!linea) continue;
    const presente =
      perChiave.get(voce.chiave) ??
      esistenti.find(
        (c) =>
          c.codiceLinea.toUpperCase() === voce.codiceLinea.toUpperCase() &&
          c.normalizzata === voce.normalizzata &&
          (c.priorita ?? "_") === (voce.priorita ?? "_"),
      );
    if (!presente) {
      const campata: CampataLavoro = {
        id: idCampataLavoro(voce.codiceLinea, voce.normalizzata, voce.priorita),
        lineaId: linea.id,
        codiceLinea: voce.codiceLinea,
        nomeLinea: voce.nomeLinea || linea.nome,
        tensioneKv: linea.tensioneKv ?? tensioneDaCodice(voce.codiceLinea),
        originale: voce.originale,
        normalizzata: voce.normalizzata,
        priorita: voce.priorita,
        stato: "da_tagliare",
        origine: "prevista",
        importId,
        syncStatus: "synced",
        createdAt: now,
        updatedAt: now,
      };
      daScrivere.push(campata);
      storico.push({
        id: uid("sto"),
        campataId: campata.id,
        evento: "importata",
        stato: "da_tagliare",
        priorita: voce.priorita,
        createdAt: now,
      });
      continue;
    }

    const changed = voce.nomeLinea && voce.nomeLinea !== presente.nomeLinea;
    if (!changed) continue;
    const aggiornata: CampataLavoro = {
      ...presente,
      nomeLinea: voce.nomeLinea || presente.nomeLinea,
      updatedAt: now,
      importId,
      syncStatus: "synced",
    };
    daScrivere.push(aggiornata);
    storico.push({
      id: uid("sto"),
      campataId: presente.id,
      evento: "reimportata",
      stato: presente.stato,
      priorita: presente.priorita,
      note: `Import ${opts.fileName}`,
      createdAt: now,
    });
  }

  const riepilogo: ImportCampate = {
    id: importId,
    fileName: opts.fileName,
    createdAt: now,
    createdBy: opts.session.nome,
    riconosciute: opts.anteprima.voci.length,
    nuove: opts.anteprima.nuove,
    esistenti: opts.anteprima.esistenti,
    duplicati: opts.anteprima.duplicati,
    scartate: opts.anteprima.scartate.length,
  };

  if (nuoveLinee.length > 0) {
    const { error } = await supabase.from("linee").upsert(nuoveLinee.map(lineaToRow));
    if (error) throw new Error(error.message);
    await db.linee.bulkPut(nuoveLinee);
  }

  if (daScrivere.length > 0) {
    await upsertCampateLavoro(daScrivere.map(campataLavoroToRow));
    await db.campateLavoro.bulkPut(daScrivere);
  }

  if (storico.length > 0) {
    const { error } = await supabase.from("campate_storico").insert(storico.map(campataStoricoToRow));
    if (error) throw new Error(error.message);
    await db.campateStorico.bulkPut(storico);
  }

  const { error: impErr } = await supabase.from("import_campate").insert(importCampateToRow(riepilogo));
  if (impErr) throw new Error(impErr.message);
  await db.importCampate.put(riepilogo);

  return riepilogo;
}

function esitiDaRapportino(item: Rapportino): RapportinoCampata[] {
  if (item.esitiCampate && item.esitiCampate.length > 0) return item.esitiCampate;
  return spezzaCampateTesto(item.campata).map((pezzo) => ({
    id: uid("es"),
    originale: pezzo,
    normalizzata: normalizzaCampata(pezzo),
    esito: "tagliata" as const,
  }));
}

function bersagliPerEsito(
  tutte: CampataLavoro[],
  esito: RapportinoCampata,
  codiceLinea: string,
): CampataLavoro[] {
  if (esito.campataId) {
    const byId = tutte.filter((c) => c.id === esito.campataId);
    if (byId.length > 0) return byId;
  }
  const idDeterministico = idCampataLavoro(codiceLinea, esito.normalizzata, esito.priorita);
  const byDet = tutte.filter((c) => c.id === idDeterministico);
  if (byDet.length > 0) return byDet;
  return tutte.filter((c) => {
    if (c.normalizzata !== esito.normalizzata) return false;
    if (esito.priorita) return c.priorita === esito.priorita;
    return true;
  });
}

/**
 * Aggiorna il database operativo a partire da un rapportino inviato o archiviato.
 * Le bozze non toccano le campate.
 */
export async function applicaEsitiDaRapportino(item: Rapportino, session: Session | null) {
  if (item.stato !== "in_attesa" && item.stato !== "archiviato") return;
  const esiti = esitiDaRapportino(item).filter((e) => e.normalizzata);
  if (esiti.length === 0) return;

  const linea = await db.linee.get(item.lineaId);
  const tutte = await db.campateLavoro.where("lineaId").equals(item.lineaId).toArray();
  for (const esito of esiti) {
    if (!esito.campataId || tutte.some((c) => c.id === esito.campataId)) continue;
    const extra = await db.campateLavoro.get(esito.campataId);
    if (extra) tutte.push(extra);
  }
  const now = new Date().toISOString();
  const operatore = session?.nome || item.dipendenteTerna || item.presoDa || "Operatore";
  const data = item.dataLavoro || todayIso();

  const daScrivere: CampataLavoro[] = [];
  const storico: CampataStorico[] = [];

  for (const esito of esiti) {
    const stato = esito.esito === "tagliata" ? "tagliata" : "tralasciata";
    const bersagli = bersagliPerEsito(tutte, esito, linea?.codice ?? "");

    if (bersagli.length === 0) {
      if (!linea) continue;
      const id = idCampataLavoro(linea.codice, esito.normalizzata, esito.priorita);
      if (tutte.some((c) => c.id === id) || daScrivere.some((c) => c.id === id)) continue;
      const nuova: CampataLavoro = {
        id,
        lineaId: linea.id,
        codiceLinea: linea.codice,
        nomeLinea: linea.nome,
        tensioneKv: linea.tensioneKv ?? tensioneDaCodice(linea.codice),
        originale: esito.originale,
        normalizzata: esito.normalizzata,
        priorita: esito.priorita,
        stato,
        origine: "aggiuntiva",
        attenzionare: false,
        dataTaglio: data,
        operatore,
        rapportinoId: item.id,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      };
      daScrivere.push(nuova);
      tutte.push(nuova);
      storico.push({
        id: uid("sto"),
        campataId: nuova.id,
        evento: "aggiuntiva_da_rapportino",
        stato,
        priorita: esito.priorita,
        operatore,
        rapportinoId: item.id,
        createdAt: now,
      });
      continue;
    }

    for (const presente of bersagli) {
      const aggiornata: CampataLavoro = {
        ...presente,
        stato,
        origine: presente.origine === "prevista" ? "prevista" : presente.origine,
        dataTaglio: data,
        operatore,
        rapportinoId: item.id,
        syncStatus: "pending",
        updatedAt: now,
      };
      daScrivere.push(aggiornata);
      const idx = tutte.findIndex((c) => c.id === presente.id);
      if (idx >= 0) tutte[idx] = aggiornata;
      storico.push({
        id: uid("sto"),
        campataId: presente.id,
        evento: stato,
        stato,
        priorita: presente.priorita,
        operatore,
        rapportinoId: item.id,
        createdAt: now,
      });
    }
  }

  if (daScrivere.length > 0) await db.campateLavoro.bulkPut(daScrivere);
  if (storico.length > 0) await db.campateStorico.bulkPut(storico);
  await enqueueSync(item.id, "campate");
}

/**
 * Quando si cancella un rapportino, le campate che aveva chiuso tornano da tagliare.
 * Si cancellano solo quelle nate da quel foglio, mai una campata importata dal file.
 */
export async function annullaEsitiDaRapportino(rapportinoId: string) {
  const legate = await db.campateLavoro.where("rapportinoId").equals(rapportinoId).toArray();
  if (legate.length === 0) return;

  const now = new Date().toISOString();
  const daRipristinare: CampataLavoro[] = [];
  const daEliminare: string[] = [];
  const storico: CampataStorico[] = [];

  for (const presente of legate) {
    const log = await db.campateStorico.where("campataId").equals(presente.id).toArray();
    const dalFile =
      presente.origine === "prevista" ||
      Boolean(presente.importId) ||
      log.some((s) => s.evento === "importata" || s.evento === "reimportata");
    const nataDalFoglio = presente.origine === "aggiuntiva" && !dalFile;

    if (nataDalFoglio) {
      daEliminare.push(presente.id);
      continue;
    }

    const ripristinata: CampataLavoro = {
      ...presente,
      origine: dalFile ? "prevista" : presente.origine,
      stato: "da_tagliare",
      syncStatus: "pending",
      updatedAt: now,
    };
    delete ripristinata.dataTaglio;
    delete ripristinata.operatore;
    delete ripristinata.rapportinoId;
    daRipristinare.push(ripristinata);
    storico.push({
      id: uid("sto"),
      campataId: presente.id,
      evento: "ripristinata_da_cancellazione",
      stato: "da_tagliare",
      priorita: presente.priorita,
      rapportinoId,
      createdAt: now,
    });
  }

  if (daRipristinare.length > 0) await db.campateLavoro.bulkPut(daRipristinare);
  if (daEliminare.length > 0) {
    await db.campateLavoro.bulkDelete(daEliminare);
    await db.campateDeleteQueue.bulkPut(daEliminare.map((id) => ({ id })));
  }
  if (storico.length > 0) await db.campateStorico.bulkPut(storico);
  await enqueueSync(rapportinoId, "campate");
}

/** Nota e “da attenzionare” si gestiscono dalla tabella campate, non dal rapportino. */
export async function aggiornaDettagliCampata(
  id: string,
  patch: { attenzionare?: boolean; note?: string },
  operatore?: string,
) {
  const presente = await db.campateLavoro.get(id);
  if (!presente) return;

  const now = new Date().toISOString();
  const aggiornata: CampataLavoro = {
    ...presente,
    syncStatus: "pending",
    updatedAt: now,
  };
  if (patch.attenzionare !== undefined) aggiornata.attenzionare = patch.attenzionare;
  if (patch.note !== undefined) {
    const nota = patch.note.trim();
    if (nota) aggiornata.note = nota;
    else delete aggiornata.note;
  }

  await db.campateLavoro.put(aggiornata);
  if (patch.note !== undefined) {
    await db.campateStorico.put({
      id: uid("sto"),
      campataId: id,
      evento: "nota",
      stato: presente.stato,
      priorita: presente.priorita,
      operatore,
      note: aggiornata.note,
      createdAt: now,
    });
  }
  await enqueueSync(presente.rapportinoId || presente.id, "campate");
}
