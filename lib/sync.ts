import { db } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteRemoteRapportino,
  pullDeletedRapportini,
  pullRapportini,
  pullReferenceData,
  pushRapportino,
} from "@/lib/supabase/remote";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processSyncQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, pending: await db.syncQueue.count(), pulled: 0 };
  }

  const items = await db.syncQueue.orderBy("createdAt").toArray();
  let processed = 0;

  for (const item of items) {
    try {
      if (isSupabaseConfigured()) {
        if (item.action === "delete") {
          await deleteRemoteRapportino(item.rapportinoId);
        } else {
          const rapportino = await db.rapportini.get(item.rapportinoId);
          if (!rapportino) {
            await db.syncQueue.delete(item.id);
            continue;
          }
          await pushRapportino(rapportino);
        }
      } else {
        await delay(180);
      }

      const now = new Date().toISOString();
      if (item.action !== "delete") {
        await db.rapportini.update(item.rapportinoId, {
          syncStatus: "synced",
          updatedAt: now,
        });
      }
      await db.syncQueue.delete(item.id);
      processed += 1;
    } catch (error) {
      await db.syncQueue.update(item.id, {
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : "Errore sconosciuto",
      });
      if (item.action !== "delete") {
        await db.rapportini.update(item.rapportinoId, { syncStatus: "error" });
      }
    }
  }

  let pulled = 0;
  if (isSupabaseConfigured()) {
    try {
      await pullReferenceData();
      await pullDeletedRapportini();
      pulled = await pullRapportini();
    } catch (error) {
      console.warn("Pull Supabase non riuscito:", error);
    }
  }

  const pending = await db.syncQueue.count();
  return { processed, pending, pulled };
}

export function subscribeOnline(handler: () => void) {
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
