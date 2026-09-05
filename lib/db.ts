import Dexie, { type EntityTable } from "dexie";
import type {
  Campata,
  CampataDeleteQueueItem,
  CampataLavoro,
  CampataStorico,
  Ditta,
  ImportCampate,
  Linea,
  Operatore,
  OperatoreTerna,
  Prestazione,
  Rapportino,
  SyncQueueItem,
} from "./types";
import {
  SEED_APP_OPERATORI,
  SEED_CAMPATE,
  SEED_DITTE,
  SEED_LINEE,
  SEED_OPERATORI,
  SEED_PRESTAZIONI,
  seedRapportini,
} from "./seed";
import { supabaseReady } from "./supabase/remote";

class RapportiniDB extends Dexie {
  linee!: EntityTable<Linea, "id">;
  campate!: EntityTable<Campata, "id">;
  operatoriTerna!: EntityTable<OperatoreTerna, "id">;
  operatori!: EntityTable<Operatore, "id">;
  ditte!: EntityTable<Ditta, "id">;
  prestazioni!: EntityTable<Prestazione, "id">;
  rapportini!: EntityTable<Rapportino, "id">;
  campateLavoro!: EntityTable<CampataLavoro, "id">;
  campateStorico!: EntityTable<CampataStorico, "id">;
  importCampate!: EntityTable<ImportCampate, "id">;
  campateDeleteQueue!: EntityTable<CampataDeleteQueueItem, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor() {
    super("rapportini-taglio");
    this.version(1).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    });
    this.version(2).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, campataId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("prestazioni").clear();
      await tx.table("prestazioni").bulkAdd(SEED_PRESTAZIONI);
      await tx.table("rapportini").clear();
      await tx.table("rapportini").bulkAdd(seedRapportini());
    });
    this.version(3).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("rapportini").clear();
      await tx.table("rapportini").bulkAdd(seedRapportini());
    });
    this.version(4).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("linee").clear();
      await tx.table("linee").bulkAdd(SEED_LINEE);
      await tx.table("campate").clear();
      await tx.table("operatoriTerna").clear();
      await tx.table("ditte").clear();
      await tx.table("rapportini").clear();
    });
    this.version(5).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("ditte").put({ id: "dit_bonifico", ragioneSociale: "Bonifico" });
    });
    this.version(6).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("linee").clear();
      await tx.table("linee").bulkAdd(SEED_LINEE);
    });
    this.version(7).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("operatori").bulkPut(SEED_APP_OPERATORI);
    });
    this.version(8).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      // Gli operatori ora corrispondono ad account Supabase: si ricaricano dal cloud.
      await tx.table("operatori").clear();
    });
    this.version(9).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt",
      syncQueue: "id, rapportinoId, createdAt",
    });
    this.version(10).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    });
    this.version(11).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      const rows = await tx.table("campateLavoro").toArray();
      for (const row of rows) {
        if (row.tipo) continue;
        await tx.table("campateLavoro").update(row.id, { tipo: "campata" });
      }
    });
    this.version(12).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      const rows = await tx.table("campateLavoro").toArray();
      for (const row of rows) {
        if (row.stato !== "tralasciata") continue;
        await tx.table("campateLavoro").update(row.id, { stato: "tagliata", daNonTagliare: true });
      }
    });
    this.version(13).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      const rows = await tx.table("rapportini").toArray();
      const now = new Date().toISOString();
      for (const row of rows) {
        if (row.stato !== "in_attesa") continue;
        await tx.table("rapportini").update(row.id, {
          stato: "archiviato",
          archiviatoAt: row.archiviatoAt ?? row.inviatoAt ?? now,
        });
      }
    });
    this.version(14).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, anno, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt, anno",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      const campate = await tx.table("campateLavoro").toArray();
      for (const row of campate) {
        if (row.anno != null) continue;
        await tx.table("campateLavoro").update(row.id, { anno: 2026 });
      }
      const imports = await tx.table("importCampate").toArray();
      for (const row of imports) {
        if (row.anno != null) continue;
        const y = Number(String(row.createdAt ?? "").slice(0, 4));
        await tx.table("importCampate").update(row.id, {
          anno: Number.isFinite(y) && y >= 2000 ? y : 2026,
        });
      }
    });
    this.version(15).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro: "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, anno, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt, anno",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    }).upgrade(async (tx) => {
      await allineaPrestazioniTabella(tx.table("prestazioni"));
    });
    this.version(16).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro:
        "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, anno, rinvioMese, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt, anno",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    });
    this.version(17).stores({
      linee: "id, codice, nome",
      campate: "id, lineaId, codice, tipo",
      operatoriTerna: "id, matricola",
      operatori: "id, nome, email",
      ditte: "id, ragioneSociale",
      prestazioni: "id, codice",
      rapportini: "id, numero, lineaId, stato, syncStatus, dataLavoro",
      campateLavoro:
        "id, lineaId, codiceLinea, normalizzata, stato, priorita, origine, tipo, anno, rinvioMese, rapportinoId, updatedAt",
      campateStorico: "id, campataId, createdAt",
      importCampate: "id, createdAt, anno",
      campateDeleteQueue: "id",
      syncQueue: "id, rapportinoId, createdAt",
    });
  }
}

async function allineaPrestazioniTabella(table: {
  toArray: () => Promise<Prestazione[]>;
  put: (row: Prestazione) => Promise<unknown>;
}) {
  const esistenti = await table.toArray();
  const byCodice = new Map(esistenti.map((p) => [p.codice, p]));
  for (const seed of SEED_PRESTAZIONI) {
    const presente = byCodice.get(seed.codice);
    if (presente) {
      await table.put({
        ...presente,
        codice: seed.codice,
        descrizione: seed.descrizione,
        unitaMisura: seed.unitaMisura,
      });
    } else {
      await table.put(seed);
    }
  }
}

export async function allineaPrestazioniLocali() {
  await allineaPrestazioniTabella(db.prestazioni);
}

export const db = new RapportiniDB();

let seedPromise: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await db.linee.count();
      if (count === 0) {
        await db.transaction(
          "rw",
          [
            db.linee,
            db.campate,
            db.operatoriTerna,
            db.ditte,
            db.prestazioni,
            db.rapportini,
          ],
          async () => {
            await db.linee.bulkAdd(SEED_LINEE);
            if (SEED_CAMPATE.length) await db.campate.bulkAdd(SEED_CAMPATE);
            if (SEED_OPERATORI.length) await db.operatoriTerna.bulkAdd(SEED_OPERATORI);
            if (SEED_DITTE.length) await db.ditte.bulkAdd(SEED_DITTE);
            await db.prestazioni.bulkAdd(SEED_PRESTAZIONI);
            const rapportini = seedRapportini();
            if (rapportini.length) await db.rapportini.bulkAdd(rapportini);
          },
        );
      }
      for (const ditta of SEED_DITTE) {
        const exists = await db.ditte.get(ditta.id);
        if (!exists) await db.ditte.add(ditta);
      }
      await allineaPrestazioniLocali();
      try {
        const { upsertCatalogoPrestazioni, supabaseAutenticato } = await import("./supabase/remote");
        if (await supabaseAutenticato()) await upsertCatalogoPrestazioni();
      } catch {
        // catalogo remoto: si ritenta al prossimo sync
      }
    })();
  }
  return seedPromise;
}

export async function nextNumero() {
  const year = new Date().getFullYear();
  const prefix = `RT-${year}-`;
  let maxSeq = 0;

  const locals = await db.rapportini.toArray();
  for (const item of locals) {
    if (!item.numero.startsWith(prefix)) continue;
    const seq = Number(item.numero.slice(prefix.length));
    if (!Number.isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
  }

  if (supabaseReady()) {
    try {
      const { fetchNextNumero } = await import("./supabase/remote");
      const remote = await fetchNextNumero();
      if (remote?.startsWith(prefix)) {
        const seq = Number(remote.slice(prefix.length));
        if (!Number.isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
      }
    } catch {
      // usa solo il massimo locale
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export async function enqueueSync(
  rapportinoId: string,
  action: SyncQueueItem["action"],
) {
  const esistenti = await db.syncQueue.where("rapportinoId").equals(rapportinoId).toArray();
  if (action === "delete") {
    for (const q of esistenti) {
      if (q.action !== "delete") await db.syncQueue.delete(q.id);
    }
    if (esistenti.some((q) => q.action === "delete")) return;
  } else if (esistenti.some((q) => q.action === "delete")) {
    return;
  } else if (esistenti.some((q) => q.action === action)) {
    return;
  }

  await db.syncQueue.add({
    id: `q_${crypto.randomUUID?.() ?? Date.now()}`,
    rapportinoId,
    action,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  if (action !== "campate") {
    await db.rapportini.update(rapportinoId, { syncStatus: "pending" });
  }
}

/** Toglie doppioni in coda (stesso foglio + stessa azione, o campate già coperte da un delete). */
export async function compattaCodaSync() {
  const items = await db.syncQueue.toArray();
  if (items.length === 0) return 0;
  const deletes = new Set(items.filter((i) => i.action === "delete").map((i) => i.rapportinoId));
  const visti = new Set<string>();
  const junk: string[] = [];
  const ordinati = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const i of ordinati) {
    if (i.action === "campate" && deletes.has(i.rapportinoId)) {
      junk.push(i.id);
      continue;
    }
    const key = `${i.action}|${i.rapportinoId}`;
    if (visti.has(key)) {
      junk.push(i.id);
      continue;
    }
    visti.add(key);
  }
  const unici = [...new Set(junk)];
  if (unici.length > 0) await db.syncQueue.bulkDelete(unici);
  return unici.length;
}

export async function deleteRapportino(id: string) {
  const { annullaEsitiDaRapportino } = await import("./campate/apply");
  const item = await db.rapportini.get(id);
  await annullaEsitiDaRapportino(id, item, false);
  await enqueueSync(id, "delete");
  await db.transaction("rw", [db.rapportini, db.syncQueue], async () => {
    const pending = await db.syncQueue.where("rapportinoId").equals(id).toArray();
    for (const queueItem of pending) {
      if (queueItem.action !== "delete") await db.syncQueue.delete(queueItem.id);
    }
    await db.rapportini.delete(id);
  });
}

export async function deleteRapportini(ids: string[]) {
  for (const id of ids) {
    await deleteRapportino(id);
  }
}
