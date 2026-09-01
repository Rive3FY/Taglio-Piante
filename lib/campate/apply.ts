import { db, enqueueSync } from "@/lib/db";
import { uid, tensioneDaCodice, todayIso } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { campataLavoroToRow, campataStoricoToRow, importCampateToRow, lineaToRow } from "@/lib/supabase/mappers";
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
  const perChiave = new Map(esistenti.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata), c]));

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
    const presente = perChiave.get(voce.chiave);
    if (!presente) {
      const campata: CampataLavoro = {
        id: idCampataLavoro(voce.codiceLinea, voce.normalizzata),
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

    const priorita =
      presente.priorita && voce.priorita
        ? presente.priorita === "urgente" || voce.priorita === "urgente"
          ? "urgente"
          : voce.priorita
        : (voce.priorita ?? presente.priorita);
    const changed = priorita !== presente.priorita || (voce.nomeLinea && voce.nomeLinea !== presente.nomeLinea);
    if (!changed) continue;
    const aggiornata: CampataLavoro = {
      ...presente,
      priorita,
      nomeLinea: voce.nomeLinea || presente.nomeLinea,
      updatedAt: now,
      importId,
      syncStatus: "synced",
    };
    daScrivere.push(aggiornata);
    storico.push({
      id: uid("sto"),
      campataId: presente.id,
      evento: presente.stato === "da_tagliare" ? "priorita_aggiornata" : "reimportata_senza_stato",
      stato: presente.stato,
      priorita,
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
    const { error } = await supabase.from("campate_lavoro").upsert(daScrivere.map(campataLavoroToRow));
    if (error) throw new Error(error.message);
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
  const perChiave = new Map(tutte.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata), c]));
  const now = new Date().toISOString();
  const operatore = session?.nome || item.dipendenteTerna || item.presoDa || "Operatore";
  const data = item.dataLavoro || todayIso();

  const daScrivere: CampataLavoro[] = [];
  const storico: CampataStorico[] = [];

  for (const esito of esiti) {
    if (esito.esito === "tralasciata" && !esito.note?.trim()) {
      throw new Error(`La campata ${esito.normalizzata} è tralasciata: indica una nota.`);
    }
    const codiceLinea = linea?.codice ?? esito.originale.split("-")[0] ?? "";
    const chiave = chiaveCampata(codiceLinea, esito.normalizzata);
    const presente = perChiave.get(chiave) ?? (esito.campataId ? await db.campateLavoro.get(esito.campataId) : undefined);
    const stato = esito.esito === "tagliata" ? "tagliata" : "tralasciata";

    if (!presente) {
      if (!linea) continue;
      const nuova: CampataLavoro = {
        id: idCampataLavoro(linea.codice, esito.normalizzata),
        lineaId: linea.id,
        codiceLinea: linea.codice,
        nomeLinea: linea.nome,
        tensioneKv: linea.tensioneKv ?? tensioneDaCodice(linea.codice),
        originale: esito.originale,
        normalizzata: esito.normalizzata,
        stato,
        origine: "aggiuntiva",
        dataTaglio: data,
        operatore,
        note: esito.note,
        rapportinoId: item.id,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      };
      daScrivere.push(nuova);
      perChiave.set(chiave, nuova);
      storico.push({
        id: uid("sto"),
        campataId: nuova.id,
        evento: "aggiuntiva_da_rapportino",
        stato,
        operatore,
        rapportinoId: item.id,
        note: esito.note,
        createdAt: now,
      });
      continue;
    }

    const aggiornata: CampataLavoro = {
      ...presente,
      stato,
      dataTaglio: data,
      operatore,
      note: esito.note ?? presente.note,
      rapportinoId: item.id,
      syncStatus: "pending",
      updatedAt: now,
    };
    daScrivere.push(aggiornata);
    storico.push({
      id: uid("sto"),
      campataId: presente.id,
      evento: stato,
      stato,
      operatore,
      rapportinoId: item.id,
      note: esito.note,
      createdAt: now,
    });
  }

  if (daScrivere.length > 0) await db.campateLavoro.bulkPut(daScrivere);
  if (storico.length > 0) await db.campateStorico.bulkPut(storico);
  await enqueueSync(item.id, "campate");
}
