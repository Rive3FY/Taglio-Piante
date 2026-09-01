import type { Session } from "./types";

const KEY = "rt.profilo";

/**
 * Copia locale del profilo: serve solo per riaprire l'app offline.
 * L'accesso vero resta quello verificato da Supabase.
 */
export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.nome || !parsed?.userId) return null;
    if (parsed.ruolo !== "operatore" && parsed.ruolo !== "tecnico") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("rt.session");
}
