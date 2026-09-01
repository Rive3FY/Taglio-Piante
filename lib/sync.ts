import { db } from "./db";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processSyncQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { processed: 0, pending: 0 };

  const items = await db.syncQueue.orderBy("createdAt").toArray();
  if (items.length === 0) {
    return { processed: 0, pending: 0 };
  }

  let processed = 0;
  for (const item of items) {
    try {
      await delay(180);
      const now = new Date().toISOString();
      await db.rapportini.update(item.rapportinoId, {
        syncStatus: "synced",
        updatedAt: now,
      });
      await db.syncQueue.delete(item.id);
      processed += 1;
    } catch (error) {
      await db.syncQueue.update(item.id, {
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : "Errore sconosciuto",
      });
      await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
    }
  }

  const pending = await db.syncQueue.count();
  return { processed, pending };
}

export function subscribeOnline(handler: () => void) {
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
