import { db, enqueueSync } from "@/lib/db";
import { uid, tensioneDaCodice, todayIso } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { campataLavoroToRow, campataStoricoToRow, importCampateToRow, lineaToRow } from "@/lib/supabase/mappers";
import { messaggioErroreSupabase, upsertCampateLavoro } from "@/lib/supabase/remote";
import type {
  CampataLavoro,
  CampataStorico,
  ImportCampate,
  Linea,
  Prestazione,
  Rapportino,
  RapportinoCampata,
  Session,
} from "@/lib/types";
import {
  campataDaNonTagliare,
  esitoRapportinoToStato,
  eventoStoricoDaEsito,
  puoModificareSceltaCampata,
  rapportinoEChiuso,
} from "@/lib/types";
import { idCampataLavoro, chiaveCampata } from "./normalize";
import { esitiClassificati, isBaseLavoro } from "./basi";
import { campataGiaChiusaDaFoglio } from "./guard";
import type { AnteprimaImport } from "./preview";
import { resetOperativoPerImport } from "./reset";

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
  await resetOperativoPerImport();

  const now = new Date().toISOString();
  const importId = uid("imp");
  const voci = opts.anteprima.voci.filter((v) => v.azione !== "duplicato");

  const lineeMap = new Map<string, Linea>();
  for (const voce of voci) {
    const codice = voce.codiceLinea.toUpperCase();
    if (lineeMap.has(codice)) continue;
    lineeMap.set(codice, {
      id: `lin_${codice.toLowerCase()}`,
      codice,
      nome: voce.nomeLinea?.trim() || codice,
      tensioneKv: tensioneDaCodice(codice),
    });
  }
  const linee = [...lineeMap.values()];

  const daScrivere: CampataLavoro[] = [];
  const storico: CampataStorico[] = [];

  for (const voce of voci) {
    const linea = lineeMap.get(voce.codiceLinea.toUpperCase());
    if (!linea) continue;
    const campata: CampataLavoro = {
      id: idCampataLavoro(voce.codiceLinea, voce.normalizzata, voce.priorita),
      lineaId: linea.id,
      codiceLinea: voce.codiceLinea,
      nomeLinea: voce.nomeLinea || linea.nome,
      tensioneKv: linea.tensioneKv ?? tensioneDaCodice(voce.codiceLinea),
      originale: voce.originale,
      normalizzata: voce.normalizzata,
      tipo: "campata",
      priorita: voce.priorita,
      distInt: voce.distInt,
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
  }

  const riepilogo: ImportCampate = {
    id: importId,
    fileName: opts.fileName,
    createdAt: now,
    createdBy: opts.session.nome,
    riconosciute: voci.length,
    nuove: voci.length,
    esistenti: 0,
    duplicati: opts.anteprima.duplicati,
    scartate: opts.anteprima.scartate.length,
  };

  if (linee.length > 0) {
    const { error } = await supabase.from("linee").upsert(linee.map(lineaToRow));
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    await db.linee.bulkPut(linee);
  }

  if (daScrivere.length > 0) {
    await upsertCampateLavoro(daScrivere.map(campataLavoroToRow));
    await db.campateLavoro.bulkPut(daScrivere);
  }

  if (storico.length > 0) {
    const { error } = await supabase.from("campate_storico").insert(storico.map(campataStoricoToRow));
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    await db.campateStorico.bulkPut(storico);
  }

  const { error: impErr } = await supabase.from("import_campate").insert(importCampateToRow(riepilogo));
  if (impErr) throw new Error(messaggioErroreSupabase(impErr.message));
  await db.importCampate.put(riepilogo);

  return riepilogo;
}

/**
 * Attacca Dist int alle campate già importate. Non cancella rapportini né stati.
 */
export async function aggiornaDistanzeDaFile(opts: { anteprima: AnteprimaImport }) {
  const supabase = richiediRete();
  const esistenti = await db.campateLavoro.toArray();
  const indice = new Map(
    esistenti.map((c) => [chiaveCampata(c.codiceLinea, c.normalizzata, c.priorita), c]),
  );
  const now = new Date().toISOString();
  const daScrivere: CampataLavoro[] = [];

  for (const voce of opts.anteprima.voci) {
    if (voce.azione === "duplicato") continue;
    if (voce.distInt == null) continue;
    const presente = indice.get(voce.chiave);
    if (!presente) continue;
    if (presente.distInt === voce.distInt) continue;
    daScrivere.push({
      ...presente,
      distInt: voce.distInt,
      syncStatus: "synced",
      updatedAt: now,
    });
  }

  if (daScrivere.length === 0) return { aggiornate: 0 };

  await upsertCampateLavoro(
    daScrivere.map(campataLavoroToRow),
    { vietatoOmettere: ["dist_int"] },
  );
  await db.campateLavoro.bulkPut(daScrivere);
  return { aggiornate: daScrivere.length };
}

function testoEsiti(item: Rapportino) {
  return (
    item.campata ||
    (item.esitiCampate ?? []).map((e) => e.originale || e.normalizzata).join(", ")
  );
}

function esitiDaRapportino(item: Rapportino, prestazioni: Prestazione[]) {
  return esitiClassificati(testoEsiti(item), item, prestazioni, item.esitiCampate);
}

function bersagliPerEsito(
  tutte: CampataLavoro[],
  esito: RapportinoCampata,
  codiceLinea: string,
): CampataLavoro[] {
  const cercaBase = esito.tipo === "base";
  const nelTipo = tutte.filter((c) => (isBaseLavoro(c) ? cercaBase : !cercaBase));
  // Una base non deve mai chiudere la campata pianificata, anche se l’id è rimasto attaccato.
  if (esito.campataId && !cercaBase) {
    const byId = nelTipo.filter((c) => c.id === esito.campataId);
    if (byId.length > 0) return byId;
  }
  const idDeterministico = idCampataLavoro(
    codiceLinea,
    esito.normalizzata,
    esito.priorita,
    esito.tipo,
  );
  const byDet = nelTipo.filter((c) => c.id === idDeterministico);
  if (byDet.length > 0) return byDet;
  return nelTipo.filter((c) => {
    if (c.normalizzata !== esito.normalizzata) return false;
    if (esito.priorita) return c.priorita === esito.priorita;
    return true;
  });
}

/** Stessa campata fisica con priorità urgente e differibile: chiudiamo entrambe insieme. */
function espandiFratelliPriorita(tutte: CampataLavoro[], bersagli: CampataLavoro[]): CampataLavoro[] {
  const out = new Map<string, CampataLavoro>();
  for (const b of bersagli) {
    out.set(b.id, b);
    if (isBaseLavoro(b)) continue;
    for (const c of tutte) {
      if (c.lineaId !== b.lineaId) continue;
      if (c.normalizzata !== b.normalizzata) continue;
      if (isBaseLavoro(c)) continue;
      out.set(c.id, c);
    }
  }
  return [...out.values()];
}

/**
 * Aggiorna il database operativo a partire da un rapportino inviato o archiviato.
 * Le bozze non toccano le campate.
 */
export async function applicaEsitiDaRapportino(item: Rapportino, session: Session | null) {
  if (!rapportinoEChiuso(item.stato)) return;
  const prestazioni = await db.prestazioni.toArray();
  const classificati = esitiDaRapportino(item, prestazioni).filter((e) => e.normalizzata);
  const soloBasi = classificati.some((e) => e.tipo === "base");
  const esiti = soloBasi
    ? classificati.filter((e) => e.tipo === "base")
    : classificati.filter((e) => e.tipo !== "base");
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
  const giaChiuse = new Set<string>();

  for (const esito of esiti) {
    const stato = esitoRapportinoToStato(esito.esito);
    const trovati = espandiFratelliPriorita(
      tutte,
      bersagliPerEsito(tutte, esito, linea?.codice ?? ""),
    );
    // Una riga «da non tagliare» non si richiude col rapportino, nemmeno se è
    // la gemella di priorità di una campata davvero tagliata.
    const bersagli = trovati.filter((c) => !campataDaNonTagliare(c));
    // Tutte già segnate: non si tocca niente e non si crea una riga doppia.
    if (bersagli.length === 0 && trovati.length > 0) continue;

    if (bersagli.length === 0) {
      if (!linea) continue;
      const id = idCampataLavoro(linea.codice, esito.normalizzata, esito.priorita, esito.tipo);
      if (tutte.some((c) => c.id === id) || daScrivere.some((c) => c.id === id)) continue;
      const nuova: CampataLavoro = {
        id,
        lineaId: linea.id,
        codiceLinea: linea.codice,
        nomeLinea: linea.nome,
        tensioneKv: linea.tensioneKv ?? tensioneDaCodice(linea.codice),
        originale: esito.originale,
        normalizzata: esito.normalizzata,
        tipo: esito.tipo ?? "campata",
        priorita: esito.priorita,
        stato,
        origine: "aggiuntiva",
        attenzionare: false,
        daNonTagliare: esito.esito === "nulla_da_tagliare" || esito.esito === "tralasciata",
        daNonTagliareBy:
          esito.esito === "nulla_da_tagliare" || esito.esito === "tralasciata"
            ? session?.userId
            : undefined,
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
      if (soloBasi && !isBaseLavoro(presente)) continue;
      if (!soloBasi && isBaseLavoro(presente)) continue;
      // Seconda giornata sulla stessa campata: il foglio si registra, la riga
      // resta una sola (già tagliata) così la torta non conta due volte.
      const soloLog = campataGiaChiusaDaFoglio(presente, item.id);
      const aggiornata: CampataLavoro = soloLog
        ? { ...presente, syncStatus: "pending", updatedAt: now }
        : {
            ...presente,
            stato,
            origine: presente.origine === "prevista" ? "prevista" : presente.origine,
            dataTaglio: data,
            operatore,
            rapportinoId: item.id,
            syncStatus: "pending",
            updatedAt: now,
          };
      if (!soloLog && (esito.esito === "nulla_da_tagliare" || esito.esito === "tralasciata")) {
        aggiornata.daNonTagliare = true;
        aggiornata.daNonTagliareBy = session?.userId;
      }
      daScrivere.push(aggiornata);
      const idx = tutte.findIndex((c) => c.id === presente.id);
      if (idx >= 0) tutte[idx] = aggiornata;
      if (giaChiuse.has(presente.id)) continue;
      giaChiuse.add(presente.id);
      const giaLoggato = (await db.campateStorico.where("campataId").equals(presente.id).toArray()).some(
        (s) => s.rapportinoId === item.id && s.evento === eventoStoricoDaEsito(esito.esito),
      );
      if (giaLoggato) continue;
      storico.push({
        id: uid("sto"),
        campataId: presente.id,
        evento: eventoStoricoDaEsito(esito.esito),
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
  if (daScrivere.length > 0 || storico.length > 0) await enqueueSync(item.id, "campate");
}

function copreCampata(
  item: Rapportino,
  presente: CampataLavoro,
  tutte: CampataLavoro[],
  prestazioni: Prestazione[],
  codiceLinea: string,
) {
  if (!rapportinoEChiuso(item.stato)) return false;
  if (item.lineaId !== presente.lineaId) return false;
  for (const esito of esitiDaRapportino(item, prestazioni)) {
    const trovati = espandiFratelliPriorita(
      tutte,
      bersagliPerEsito(tutte, esito, codiceLinea),
    );
    if (trovati.some((c) => c.id === presente.id)) return true;
  }
  return false;
}

async function fogliCheAncoraCoprono(
  presente: CampataLavoro,
  esclusoId: string | undefined,
  altri: Rapportino[],
  prestazioni: Prestazione[],
) {
  const log = await db.campateStorico.where("campataId").equals(presente.id).toArray();
  const daLog = new Set(
    log
      .map((s) => s.rapportinoId)
      .filter((id): id is string => Boolean(id) && id !== esclusoId),
  );
  const linea = await db.linee.get(presente.lineaId);
  const tutte = await db.campateLavoro.where("lineaId").equals(presente.lineaId).toArray();
  const codice = linea?.codice ?? presente.codiceLinea;
  const out: Rapportino[] = [];
  for (const r of altri) {
    if (r.id === esclusoId) continue;
    if (!rapportinoEChiuso(r.stato)) continue;
    if (daLog.has(r.id) || copreCampata(r, presente, tutte, prestazioni, codice)) out.push(r);
  }
  return out.sort((a, b) => (b.dataLavoro ?? "").localeCompare(a.dataLavoro ?? ""));
}

function agganciataAdAltroFoglio(presente: CampataLavoro, sostituto: Rapportino, now: string): CampataLavoro {
  return {
    ...presente,
    stato: "tagliata",
    rapportinoId: sostituto.id,
    dataTaglio: presente.dataTaglio || sostituto.dataLavoro,
    syncStatus: "pending",
    updatedAt: now,
  };
}

async function campateCollegateAlRapportino(rapportinoId: string, item?: Rapportino | null) {
  const trovate = new Map<string, CampataLavoro>();
  const aggiungi = (c?: CampataLavoro) => {
    if (c) trovate.set(c.id, c);
  };

  for (const c of await db.campateLavoro.where("rapportinoId").equals(rapportinoId).toArray()) {
    aggiungi(c);
  }

  const storico = await db.campateStorico.toArray();
  for (const s of storico) {
    if (s.rapportinoId !== rapportinoId) continue;
    aggiungi(await db.campateLavoro.get(s.campataId));
  }

  if (item) {
    const linea = await db.linee.get(item.lineaId);
    const tutte = await db.campateLavoro.where("lineaId").equals(item.lineaId).toArray();
    const prestazioni = await db.prestazioni.toArray();
    for (const esito of esitiDaRapportino(item, prestazioni)) {
      for (const c of bersagliPerEsito(tutte, esito, linea?.codice ?? "")) aggiungi(c);
    }
  }

  return [...trovate.values()];
}

function ripristinaCampataChiusa(presente: CampataLavoro, now: string): CampataLavoro {
  const dalFile =
    presente.origine === "prevista" || Boolean(presente.importId);
  if (campataDaNonTagliare(presente)) {
    const resta: CampataLavoro = {
      ...presente,
      origine: dalFile ? "prevista" : presente.origine,
      stato: "tagliata",
      daNonTagliare: true,
      syncStatus: "pending",
      updatedAt: now,
    };
    delete resta.rapportinoId;
    return resta;
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
  return ripristinata;
}

/**
 * Campate tagliate/tralasciate il cui rapportino non c’è più: tornano da tagliare.
 * Sistema i residui delle prove cancellate, anche dopo un sync che aveva lasciato lo stato vecchio.
 */
export async function ripristinaCampateOrfane() {
  const tuttiRapportini = await db.rapportini.toArray();
  const vivi = new Set(tuttiRapportini.map((r) => r.id));
  const chiusi = tuttiRapportini.filter((r) => rapportinoEChiuso(r.stato));
  const prestazioni = await db.prestazioni.toArray();
  const campate = await db.campateLavoro.toArray();
  const storico = await db.campateStorico.toArray();
  const logPer = new Map<string, CampataStorico[]>();
  for (const s of storico) {
    const list = logPer.get(s.campataId) ?? [];
    list.push(s);
    logPer.set(s.campataId, list);
  }
  const now = new Date().toISOString();
  const daRipristinare: CampataLavoro[] = [];
  const daEliminare: string[] = [];

  for (const presente of campate) {
    if (presente.stato === "da_tagliare") continue;
    if (presente.rapportinoId && vivi.has(presente.rapportinoId)) continue;

    const altri = await fogliCheAncoraCoprono(
      presente,
      presente.rapportinoId,
      chiusi,
      prestazioni,
    );
    if (altri[0]) {
      daRipristinare.push(agganciataAdAltroFoglio(presente, altri[0], now));
      continue;
    }

    const log = logPer.get(presente.id) ?? [];
    const dalFile =
      presente.origine === "prevista" ||
      Boolean(presente.importId) ||
      log.some((s) => s.evento === "importata" || s.evento === "reimportata");
    if (presente.origine === "aggiuntiva" && !dalFile) {
      daEliminare.push(presente.id);
      continue;
    }
    daRipristinare.push(ripristinaCampataChiusa(presente, now));
  }

  if (daRipristinare.length === 0 && daEliminare.length === 0) return 0;
  if (daRipristinare.length > 0) await db.campateLavoro.bulkPut(daRipristinare);
  if (daEliminare.length > 0) {
    await db.campateLavoro.bulkDelete(daEliminare);
    await db.campateDeleteQueue.bulkPut(daEliminare.map((id) => ({ id })));
    const logCampate = (await db.campateStorico.toArray()).filter((s) => daEliminare.includes(s.campataId));
    if (logCampate.length > 0) await db.campateStorico.bulkDelete(logCampate.map((s) => s.id));
  }
  return daRipristinare.length + daEliminare.length;
}

/**
 * Righe doppie sullo stesso span: una dal file e una nata a mano da un rapportino
 * vecchio (prima del blocco «da non tagliare»). Contavano due volte nella torta.
 * Si tiene la riga del file, portandoci sopra il taglio, e si butta la copia.
 */
export async function unisciCampateDoppie() {
  const campate = await db.campateLavoro.toArray();
  const storico = await db.campateStorico.toArray();
  const logPer = new Map<string, CampataStorico[]>();
  for (const s of storico) {
    const list = logPer.get(s.campataId) ?? [];
    list.push(s);
    logPer.set(s.campataId, list);
  }
  const dalFile = (c: CampataLavoro) =>
    c.origine === "prevista" ||
    Boolean(c.importId) ||
    (logPer.get(c.id) ?? []).some((s) => s.evento === "importata" || s.evento === "reimportata");

  const gruppi = new Map<string, CampataLavoro[]>();
  for (const c of campate) {
    if (isBaseLavoro(c) || !c.normalizzata) continue;
    const chiave = `${c.lineaId}|${c.normalizzata}`;
    const list = gruppi.get(chiave) ?? [];
    list.push(c);
    gruppi.set(chiave, list);
  }

  const now = new Date().toISOString();
  const daScrivere: CampataLavoro[] = [];
  const daEliminare: string[] = [];
  const logDaSpostare: CampataStorico[] = [];
  const logDaEliminare: string[] = [];

  for (const gruppo of gruppi.values()) {
    if (gruppo.length < 2) continue;
    const previste = gruppo.filter(dalFile);
    const doppie = gruppo.filter((c) => !dalFile(c));
    if (previste.length === 0 || doppie.length === 0) continue;

    for (const doppia of doppie) {
      const target = previste.find((p) => p.stato === "da_tagliare" && !campataDaNonTagliare(p));
      if (target && doppia.stato !== "da_tagliare") {
        target.stato = doppia.stato;
        target.dataTaglio = doppia.dataTaglio;
        target.operatore = doppia.operatore;
        target.rapportinoId = doppia.rapportinoId;
        target.syncStatus = "pending";
        target.updatedAt = now;
        daScrivere.push(target);
        for (const s of logPer.get(doppia.id) ?? []) {
          logDaSpostare.push({ ...s, campataId: target.id });
        }
      } else {
        for (const s of logPer.get(doppia.id) ?? []) logDaEliminare.push(s.id);
      }
      daEliminare.push(doppia.id);
    }
  }

  if (daScrivere.length === 0 && daEliminare.length === 0) return 0;
  if (daScrivere.length > 0) await db.campateLavoro.bulkPut(daScrivere);
  if (logDaSpostare.length > 0) await db.campateStorico.bulkPut(logDaSpostare);
  if (logDaEliminare.length > 0) await db.campateStorico.bulkDelete(logDaEliminare);
  if (daEliminare.length > 0) {
    await db.campateLavoro.bulkDelete(daEliminare);
    await db.campateDeleteQueue.bulkPut(daEliminare.map((id) => ({ id })));
  }
  return daEliminare.length;
}

/**
 * Quando si cancella un rapportino, le campate che aveva chiuso tornano da tagliare.
 * Si cancellano solo quelle nate da quel foglio, mai una campata importata dal file.
 */
export async function annullaEsitiDaRapportino(rapportinoId: string, item?: Rapportino | null) {
  // Prima si cercano le campate (il log serve a trovarle), poi si pulisce il log.
  const legate = await campateCollegateAlRapportino(rapportinoId, item);
  const logDelFoglio = (await db.campateStorico.toArray()).filter((s) => s.rapportinoId === rapportinoId);
  if (logDelFoglio.length > 0) {
    await db.campateStorico.bulkDelete(logDelFoglio.map((s) => s.id));
  }

  if (legate.length === 0) {
    if (logDelFoglio.length > 0) await enqueueSync(rapportinoId, "campate");
    return;
  }

  const altriVivi = (await db.rapportini.toArray()).filter((r) => r.id !== rapportinoId);
  const prestazioni = await db.prestazioni.toArray();
  const now = new Date().toISOString();
  const daRipristinare: CampataLavoro[] = [];
  const daEliminare: string[] = [];

  for (const presente of legate) {
    const coperti = await fogliCheAncoraCoprono(presente, rapportinoId, altriVivi, prestazioni);
    if (coperti[0]) {
      daRipristinare.push(agganciataAdAltroFoglio(presente, coperti[0], now));
      continue;
    }
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

    const ripristinata: CampataLavoro = campataDaNonTagliare(presente)
      ? {
          ...presente,
          origine: dalFile ? "prevista" : presente.origine,
          stato: "tagliata",
          daNonTagliare: true,
          syncStatus: "pending",
          updatedAt: now,
        }
      : {
          ...presente,
          origine: dalFile ? "prevista" : presente.origine,
          stato: "da_tagliare",
          syncStatus: "pending",
          updatedAt: now,
        };
    if (campataDaNonTagliare(presente)) {
      delete ripristinata.rapportinoId;
    } else {
      delete ripristinata.dataTaglio;
      delete ripristinata.operatore;
      delete ripristinata.rapportinoId;
    }
    daRipristinare.push(ripristinata);
  }

  if (daRipristinare.length > 0) await db.campateLavoro.bulkPut(daRipristinare);
  if (daEliminare.length > 0) {
    await db.campateLavoro.bulkDelete(daEliminare);
    await db.campateDeleteQueue.bulkPut(daEliminare.map((id) => ({ id })));
    const logCampate = (await db.campateStorico.toArray()).filter((s) => daEliminare.includes(s.campataId));
    if (logCampate.length > 0) await db.campateStorico.bulkDelete(logCampate.map((s) => s.id));
  }
  await enqueueSync(rapportinoId, "campate");
}

/** Nota, da attenzionare e da non tagliare si gestiscono dalla tabella campate. */
export async function aggiornaDettagliCampata(
  id: string,
  patch: { attenzionare?: boolean; note?: string; daNonTagliare?: boolean },
  session?: Session | null,
) {
  const presente = await db.campateLavoro.get(id);
  if (!presente) return;

  if (
    patch.daNonTagliare !== undefined &&
    campataDaNonTagliare(presente) &&
    !puoModificareSceltaCampata(session, presente.daNonTagliareBy)
  ) {
    throw new Error("«Da non tagliare» è già stato segnato da un altro operatore.");
  }
  if (
    patch.attenzionare !== undefined &&
    presente.attenzionare &&
    !puoModificareSceltaCampata(session, presente.attenzionareBy)
  ) {
    throw new Error("«Da attenzionare» è già stato segnato da un altro operatore.");
  }

  const now = new Date().toISOString();
  const nome = session?.nome;
  const bersagli = [presente];

  // Stessa campata fisica segnata sia urgente sia differibile: «da non tagliare»
  // vale sullo span, come il rapportino che le chiude insieme. Nota e
  // «da attenzionare» restano invece sulla riga toccata.
  if (patch.daNonTagliare !== undefined && !isBaseLavoro(presente) && presente.normalizzata) {
    const sullaLinea = await db.campateLavoro.where("lineaId").equals(presente.lineaId).toArray();
    for (const gemella of sullaLinea) {
      if (gemella.id === presente.id) continue;
      if (isBaseLavoro(gemella) || gemella.normalizzata !== presente.normalizzata) continue;
      if (campataDaNonTagliare(gemella) === patch.daNonTagliare) continue;
      // Già tagliata con un rapportino: quello è un fatto, non si riscrive.
      if (patch.daNonTagliare && gemella.rapportinoId) continue;
      if (!patch.daNonTagliare && !puoModificareSceltaCampata(session, gemella.daNonTagliareBy)) continue;
      bersagli.push(gemella);
    }
  }

  const daScrivere: CampataLavoro[] = [];
  const storico: CampataStorico[] = [];

  for (const riga of bersagli) {
    const aggiornata: CampataLavoro = {
      ...riga,
      syncStatus: "pending",
      updatedAt: now,
    };

    if (patch.daNonTagliare !== undefined) {
      if (patch.daNonTagliare) {
        aggiornata.daNonTagliare = true;
        aggiornata.daNonTagliareBy = session?.userId;
        aggiornata.stato = "tagliata";
        aggiornata.dataTaglio = riga.dataTaglio || todayIso();
        aggiornata.operatore = riga.operatore || nome;
      } else {
        aggiornata.daNonTagliare = false;
        delete aggiornata.daNonTagliareBy;
        if (!riga.rapportinoId) {
          aggiornata.stato = "da_tagliare";
          delete aggiornata.dataTaglio;
          if (!riga.operatore || riga.operatore === nome) delete aggiornata.operatore;
        }
      }
      storico.push({
        id: uid("sto"),
        campataId: riga.id,
        evento: patch.daNonTagliare ? "da_non_tagliare" : "da_non_tagliare_off",
        stato: aggiornata.stato,
        priorita: riga.priorita,
        operatore: nome,
        createdAt: now,
      });
    }

    if (patch.attenzionare !== undefined && riga.id === presente.id) {
      aggiornata.attenzionare = patch.attenzionare;
      if (patch.attenzionare) aggiornata.attenzionareBy = session?.userId;
      else delete aggiornata.attenzionareBy;
      storico.push({
        id: uid("sto"),
        campataId: riga.id,
        evento: patch.attenzionare ? "attenzionare" : "attenzionare_off",
        stato: aggiornata.stato,
        priorita: riga.priorita,
        operatore: nome,
        createdAt: now,
      });
    }

    if (patch.note !== undefined && riga.id === presente.id) {
      const nota = patch.note.trim();
      if (nota) aggiornata.note = nota;
      else delete aggiornata.note;
      storico.push({
        id: uid("sto"),
        campataId: riga.id,
        evento: "nota",
        stato: presente.stato,
        priorita: presente.priorita,
        operatore: nome,
        note: aggiornata.note,
        createdAt: now,
      });
    }

    daScrivere.push(aggiornata);
  }

  if (daScrivere.length > 0) await db.campateLavoro.bulkPut(daScrivere);
  if (storico.length > 0) await db.campateStorico.bulkPut(storico);
  await enqueueSync(presente.rapportinoId || presente.id, "campate");
}
