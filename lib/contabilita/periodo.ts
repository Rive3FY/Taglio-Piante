"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Intervallo } from "@/lib/contabilita/aggrega";
import { getSupabase } from "@/lib/supabase/client";
import { readSession } from "@/lib/session";

/** Inizio e chiusura scelti dal tecnico per un mese contabile. Null = valore di partenza. */
export type PeriodoSalvato = {
  mese: string;
  dal: string | null;
  al: string | null;
  updatedAt: string;
};

export type PeriodoEffettivo = Intervallo & {
  inizioScelto: boolean;
  chiusuraScelta: boolean;
};

const CHIAVE = "rt.periodiContabili";
const TABELLA = "periodi_contabili";

type Periodi = Record<string, PeriodoSalvato>;

const ascoltatori = new Set<() => void>();
let cache: Periodi | null = null;

function leggi(): Periodi {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    cache = JSON.parse(localStorage.getItem(CHIAVE) ?? "{}") as Periodi;
  } catch {
    cache = {};
  }
  return cache;
}

function scrivi(periodi: Periodi) {
  cache = periodi;
  localStorage.setItem(CHIAVE, JSON.stringify(periodi));
  for (const f of ascoltatori) f();
}

function iscrivi(f: () => void) {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
}

const VUOTO: Periodi = {};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDa(data: Date) {
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function spostaGiorni(iso: string, giorni: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDa(new Date(y, m - 1, d + giorni));
}

function mesePrima(mese: string) {
  const [y, m] = mese.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function meseDopo(mese: string) {
  const [y, m] = mese.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function ultimoDelMese(mese: string) {
  const [y, m] = mese.split("-").map(Number);
  return `${mese}-${pad(new Date(y, m, 0).getDate())}`;
}

/**
 * Senza scelte il mese va dal giorno dopo la chiusura del mese prima fino all'ultimo del mese:
 * chiuso settembre il 24, ottobre parte da solo il 25 settembre.
 */
export function periodoEffettivo(mese: string, periodi: Periodi): PeriodoEffettivo {
  const salvato = periodi[mese];
  const chiusuraPrima = periodi[mesePrima(mese)]?.al;
  const dalPartenza = chiusuraPrima ? spostaGiorni(chiusuraPrima, 1) : `${mese}-01`;
  return {
    dal: salvato?.dal ?? dalPartenza,
    al: salvato?.al ?? ultimoDelMese(mese),
    inizioScelto: Boolean(salvato?.dal),
    chiusuraScelta: Boolean(salvato?.al),
  };
}

/** Il mese contabile che comprende oggi: dopo la chiusura si passa già al mese seguente. */
export function meseContabileDi(oggi: string, periodi: Periodi) {
  const mese = oggi.slice(0, 7);
  if (oggi > periodoEffettivo(mese, periodi).al) return meseDopo(mese);
  return mese;
}

async function inviaPeriodo(p: PeriodoSalvato) {
  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return;
  const { error } = await supabase.from(TABELLA).upsert({
    mese: p.mese,
    dal: p.dal,
    al: p.al,
    updated_at: p.updatedAt,
    updated_by: readSession()?.userId ?? null,
  });
  if (error) console.warn("Periodo contabile salvato solo su questo dispositivo:", error.message);
}

export function salvaPeriodo(mese: string, patch: { dal?: string | null; al?: string | null }) {
  const periodi = leggi();
  const prima = periodi[mese];
  const nuovo: PeriodoSalvato = {
    mese,
    dal: patch.dal !== undefined ? patch.dal : (prima?.dal ?? null),
    al: patch.al !== undefined ? patch.al : (prima?.al ?? null),
    updatedAt: new Date().toISOString(),
  };
  scrivi({ ...periodi, [mese]: nuovo });
  void inviaPeriodo(nuovo);
}

/** Legge i periodi dal server: vince la modifica più recente, così PC e telefono si allineano. */
export async function scaricaPeriodi() {
  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return;
  const { data, error } = await supabase.from(TABELLA).select("mese, dal, al, updated_at");
  if (error || !data) return;
  const righe = data as Array<{ mese: string; dal: string | null; al: string | null; updated_at: string }>;
  const quando = (iso: string) => Date.parse(iso) || 0;
  const periodi = { ...leggi() };
  let cambiato = false;
  for (const riga of righe) {
    const locale = periodi[riga.mese];
    if (locale && quando(locale.updatedAt) >= quando(riga.updated_at)) continue;
    periodi[riga.mese] = {
      mese: riga.mese,
      dal: riga.dal,
      al: riga.al,
      updatedAt: new Date(quando(riga.updated_at)).toISOString(),
    };
    cambiato = true;
  }
  for (const locale of Object.values(periodi)) {
    const remoto = righe.find((r) => r.mese === locale.mese);
    if (!remoto || quando(remoto.updated_at) < quando(locale.updatedAt)) void inviaPeriodo(locale);
  }
  if (cambiato) scrivi(periodi);
}

export function usePeriodiContabili() {
  const periodi = useSyncExternalStore(iscrivi, leggi, () => VUOTO);
  useEffect(() => {
    void scaricaPeriodi();
  }, []);
  return periodi;
}
