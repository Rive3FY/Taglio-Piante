import { db, enqueueSync } from "@/lib/db";
import { rapportinoEChiuso, type Rapportino, type Session } from "@/lib/types";

export function rapportinoProntoPerArchivio(item: Pick<Rapportino, "dipendenteTerna" | "ditta" | "righe">) {
  return (
    Boolean(item.dipendenteTerna?.trim()) &&
    Boolean(item.ditta?.trim()) &&
    (item.righe ?? []).some((r) => r.quantita)
  );
}

const SETTE_GIORNI_MS = 7 * 24 * 60 * 60 * 1000;

export function haFirmaDitta(firma?: string | null) {
  return typeof firma === "string" && firma.startsWith("data:image/");
}

function eProprioRapportino(item: Rapportino, session: Session) {
  if (item.ownerId) return item.ownerId === session.userId;
  return !item.presoDa || item.presoDa === session.nome;
}

export async function riportaInBozzaSeMancaFirma(item: Rapportino) {
  if (!rapportinoEChiuso(item.stato) || haFirmaDitta(item.firmaOperatore)) return item;
  const next: Rapportino = {
    ...item,
    stato: "bozza",
    archiviatoAt: undefined,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  };
  await db.rapportini.put(next);
  await enqueueSync(next.id, "upsert");
  return next;
}

export async function applicaFirmaDitta(item: Rapportino, firma: string, session: Session | null) {
  if (!haFirmaDitta(firma)) throw new Error("Serve la firma della ditta.");
  const now = new Date().toISOString();
  const pronto = rapportinoProntoPerArchivio(item);
  const next: Rapportino = {
    ...item,
    firmaOperatore: firma,
    stato: pronto ? "archiviato" : "bozza",
    inviatoAt: pronto ? item.inviatoAt ?? now : item.inviatoAt,
    archiviatoAt: pronto ? now : undefined,
    updatedAt: now,
    syncStatus: "pending",
  };
  await db.rapportini.put(next);
  await enqueueSync(next.id, pronto ? "archive" : "upsert");
  if (session && rapportinoEChiuso(next.stato)) {
    const { applicaEsitiDaRapportino } = await import("./campate/apply");
    await applicaEsitiDaRapportino(next, session);
  }
  return next;
}

/** I fogli appena archiviati senza firma ditta tornano in bozza. */
export async function riportaBozzeRecentiSenzaFirma(session: Session | null) {
  if (!session) return 0;
  const limite = Date.now() - SETTE_GIORNI_MS;
  const tutti = await db.rapportini.toArray();
  let n = 0;
  for (const r of tutti) {
    if (!rapportinoEChiuso(r.stato) || haFirmaDitta(r.firmaOperatore)) continue;
    if (!eProprioRapportino(r, session)) continue;
    const quando = Date.parse(r.archiviatoAt ?? r.updatedAt ?? r.createdAt);
    if (!Number.isFinite(quando) || quando < limite) continue;
    await riportaInBozzaSeMancaFirma(r);
    n += 1;
  }
  return n;
}
