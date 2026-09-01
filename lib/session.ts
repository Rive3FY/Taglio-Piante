import type { Session } from "./types";
import { TECNICO_NOME } from "./auth";

const KEY = "rt.session";

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.nome || (parsed.ruolo !== "operatore" && parsed.ruolo !== "tecnico")) {
      return null;
    }
    // Sessioni tecnico create prima della password vanno rifatte con il login.
    if (parsed.ruolo === "tecnico" && parsed.nome !== TECNICO_NOME) return null;
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
}
