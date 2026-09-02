import { db } from "@/lib/db";
import { getSupabase } from "@/lib/supabase/client";
import { messaggioErroreSupabase } from "@/lib/supabase/remote";

const LAST_PULL_KEY = "rt.lastPullAt";
const DELETE_PAGE = 500;

async function deleteAllRows(tabella: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  for (;;) {
    const { data, error } = await supabase.from(tabella).select("id").limit(DELETE_PAGE);
    if (error) throw new Error(messaggioErroreSupabase(error.message));
    const ids = (data ?? []).map((row) => String((row as { id: string }).id));
    if (ids.length === 0) break;
    const { error: delErr } = await supabase.from(tabella).delete().in("id", ids);
    if (delErr) throw new Error(messaggioErroreSupabase(delErr.message));
    if (ids.length < DELETE_PAGE) break;
  }
}

/** Svuota locale e cloud: rapportini, campate operative, code sync. Restano anagrafiche (ditte, prestazioni, operatori). */
export async function resetOperativoPerImport() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non è configurato su questo dispositivo.");

  await deleteAllRows("campate_storico");
  await deleteAllRows("campate_lavoro");
  await deleteAllRows("rapportini");
  await deleteAllRows("linee");
  await deleteAllRows("import_campate");

  await db.transaction(
    "rw",
    [
      db.rapportini,
      db.campateLavoro,
      db.campateStorico,
      db.importCampate,
      db.syncQueue,
      db.campateDeleteQueue,
      db.campate,
      db.linee,
    ],
    async () => {
      await db.rapportini.clear();
      await db.campateLavoro.clear();
      await db.campateStorico.clear();
      await db.importCampate.clear();
      await db.syncQueue.clear();
      await db.campateDeleteQueue.clear();
      await db.campate.clear();
      await db.linee.clear();
    },
  );

  if (typeof window !== "undefined") {
    localStorage.removeItem(LAST_PULL_KEY);
  }
}
