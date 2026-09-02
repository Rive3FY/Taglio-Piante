import { db, enqueueSync } from "@/lib/db";
import { rapportinoVisibile } from "@/lib/sezioni";
import { rapportinoEChiuso, type Session } from "@/lib/types";

export type PrefsSquadra = {
  rappresentanteDitta: string;
  nOperatori: number;
};

function key(userId: string) {
  return `rt.squadra.${userId}`;
}

export function readSquadra(userId: string | undefined | null): PrefsSquadra | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrefsSquadra;
    const nome = String(parsed.rappresentanteDitta ?? "").trim();
    const n = Number(parsed.nOperatori);
    if (!nome || !Number.isFinite(n) || n < 1) return null;
    return { rappresentanteDitta: nome, nOperatori: Math.round(n) };
  } catch {
    return null;
  }
}

export function writeSquadra(userId: string, prefs: PrefsSquadra) {
  localStorage.setItem(key(userId), JSON.stringify(prefs));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("squadra-aggiornata"));
  }
}

/** Aggiorna Sig. e n. operatori su tutti i rapportini visibili di questo account. */
export async function applicaSquadraAiRapportini(session: Session, prefs: PrefsSquadra) {
  writeSquadra(session.userId, prefs);
  const tutti = await db.rapportini.toArray();
  const miei = tutti.filter((r) => rapportinoVisibile(r, session));
  const now = new Date().toISOString();
  for (const r of miei) {
    await db.rapportini.update(r.id, {
      rappresentanteDitta: prefs.rappresentanteDitta,
      nOperatori: prefs.nOperatori,
      updatedAt: now,
      syncStatus: "pending",
    });
    await enqueueSync(
      r.id,
      rapportinoEChiuso(r.stato) ? "archive" : "upsert",
    );
  }
}
