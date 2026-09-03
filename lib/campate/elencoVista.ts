import { TENSIONI } from "@/lib/format";
import { PERIODO_VUOTO, type Periodo } from "@/components/FiltroPeriodo";
import type { CampataOrigine, CampataPriorita, CampataStatoLavoro } from "@/lib/types";

export type RipresaFiltro = "tutte" | "da_fare" | "fatte";

export type VistaElencoCampate = {
  q: string;
  kv: number | "tutte";
  priorita: CampataPriorita | "tutte";
  stato: CampataStatoLavoro | "tutte";
  soloAttenzione: boolean;
  soloDaNonTagliare: boolean;
  origine: CampataOrigine | "tutte";
  linea: string;
  operatore: string;
  periodo: Periodo;
  anno: number | null;
  visibili: number;
  /** Solo elenco «Da riprendere»: mese di ripresa e promemoria già chiusi. */
  meseRinvio: number | "tutti";
  ripresa: RipresaFiltro;
};

function key(userId: string, ruolo: string) {
  return `rt.elencoCampate.${ruolo}.${userId}`;
}

function kvValido(v: unknown): v is number | "tutte" {
  if (v === "tutte") return true;
  return typeof v === "number" && (TENSIONI as readonly number[]).includes(v);
}

export function readElencoVista(userId: string | undefined | null, ruolo: string): VistaElencoCampate | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId, ruolo));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VistaElencoCampate>;
    const priorita = p.priorita === "urgente" || p.priorita === "differibile" || p.priorita === "tutte" ? p.priorita : "tutte";
    const stato =
      p.stato === "da_tagliare" || p.stato === "tagliata" || p.stato === "tutte" ? p.stato : "tutte";
    const origine =
      p.origine === "prevista" || p.origine === "aggiuntiva" || p.origine === "tutte" ? p.origine : "tutte";
    const periodo =
      p.periodo && typeof p.periodo.da === "string" && typeof p.periodo.a === "string"
        ? { da: p.periodo.da, a: p.periodo.a }
        : PERIODO_VUOTO;
    const anno = typeof p.anno === "number" && p.anno >= 2000 && p.anno <= 2100 ? p.anno : null;
    const meseRinvio =
      typeof p.meseRinvio === "number" && p.meseRinvio >= 1 && p.meseRinvio <= 12 ? p.meseRinvio : "tutti";
    const ripresa = p.ripresa === "da_fare" || p.ripresa === "fatte" ? p.ripresa : "tutte";
    const visibili = typeof p.visibili === "number" && p.visibili >= 40 ? Math.min(2000, Math.round(p.visibili)) : 40;
    return {
      q: typeof p.q === "string" ? p.q : "",
      kv: kvValido(p.kv) ? p.kv : "tutte",
      priorita,
      stato,
      soloAttenzione: Boolean(p.soloAttenzione),
      soloDaNonTagliare: Boolean(p.soloDaNonTagliare),
      origine,
      linea: typeof p.linea === "string" ? p.linea : "",
      operatore: typeof p.operatore === "string" ? p.operatore : "",
      periodo,
      anno,
      visibili,
      meseRinvio,
      ripresa,
    };
  } catch {
    return null;
  }
}

export function writeElencoVista(userId: string, ruolo: string, vista: VistaElencoCampate) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId, ruolo), JSON.stringify(vista));
}
