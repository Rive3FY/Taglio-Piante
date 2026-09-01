import Dexie, { type EntityTable } from "dexie";
import type {
  Campata,
  Ditta,
  Linea,
  OperatoreTerna,
  Prestazione,
  Rapportino,
  SyncQueueItem,
} from "./types";
import {
  SEED_CAMPATE,
  SEED_DITTE,
  SEED_LINEE,
  SEED_OPERATORI,
  SEED_PRESTAZIONI,
  seedRapportini,
} from "./seed";

class RapportiniDB extends Dexie {
  linee!: EntityTable<Linea, "id">;
  campate!: EntityTable<Campata, "id">;
  operatoriTerna!: EntityTable<OperatoreTerna, "id">;
  ditte!: EntityTable<Ditta, "id">;
  prestazioni!: EntityTable<Prestazione, "id">;
  rapportini!: EntityTable<Rapportino, "id">;
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
  }
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
    })();
  }
  return seedPromise;
}

export async function nextNumero() {
  const n = await db.rapportini.count();
  const year = new Date().getFullYear();
  return `RT-${year}-${String(n + 1).padStart(4, "0")}`;
}

export async function enqueueSync(
  rapportinoId: string,
  action: SyncQueueItem["action"],
) {
  await db.syncQueue.add({
    id: `q_${crypto.randomUUID?.() ?? Date.now()}`,
    rapportinoId,
    action,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await db.rapportini.update(rapportinoId, { syncStatus: "pending" });
}

export async function deleteRapportino(id: string) {
  await db.transaction("rw", [db.rapportini, db.syncQueue], async () => {
    await db.syncQueue.where("rapportinoId").equals(id).delete();
    await db.rapportini.delete(id);
  });
}
