import Dexie, { type EntityTable } from "dexie";
import type {
  Campata,
  Ditta,
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
import { isSupabaseConfigured } from "./supabase/client";
import { pullReferenceData, seedRemoteReferenceData, supabaseReady } from "./supabase/remote";

class RapportiniDB extends Dexie {
  linee!: EntityTable<Linea, "id">;
  campate!: EntityTable<Campata, "id">;
  operatoriTerna!: EntityTable<OperatoreTerna, "id">;
  operatori!: EntityTable<Operatore, "id">;
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

      if ((await db.operatori.count()) === 0) {
        await db.operatori.bulkPut(SEED_APP_OPERATORI);
      }

      if (supabaseReady()) {
        try {
          await seedRemoteReferenceData();
          await pullReferenceData();
        } catch (error) {
          console.warn("Sync anagrafiche Supabase non riuscita:", error);
        }
      } else if (isSupabaseConfigured()) {
        console.info("Supabase configurato: le anagrafiche si sincronizzano quando torna la rete.");
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
  await enqueueSync(id, "delete");
  await db.transaction("rw", [db.rapportini, db.syncQueue], async () => {
    const pending = await db.syncQueue.where("rapportinoId").equals(id).toArray();
    for (const item of pending) {
      if (item.action !== "delete") await db.syncQueue.delete(item.id);
    }
    await db.rapportini.delete(id);
  });
}
