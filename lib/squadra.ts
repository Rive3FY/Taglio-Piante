/**
 * Squadra del giorno: vale per i rapportini nuovi. Quelli già salvati tengono
 * Sig. e numero operatori con cui sono stati compilati.
 */
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

