"use client";

import { useEffect, useState } from "react";

/** Cosa si sta tagliando in questa stagione. L’import resta sempre urgente + differibile. */
export type PianoLavoro = "differibile" | "urgente" | "entrambe";

const KEY = "rt.pianoLavoro";
const EVENTO = "piano-lavoro";

export const PIANO_LAVORO_LABEL: Record<PianoLavoro, string> = {
  differibile: "Differibili",
  urgente: "Urgenze",
  entrambe: "Urgenze e differibili",
};

export function readPianoLavoro(): PianoLavoro {
  if (typeof window === "undefined") return "differibile";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "urgente" || v === "entrambe" || v === "differibile") return v;
  } catch {
    // localStorage assente
  }
  return "differibile";
}

export function writePianoLavoro(piano: PianoLavoro) {
  localStorage.setItem(KEY, piano);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO));
  }
}

/** Solo con «urgenze e differibili» il foglio chiude anche la gemella di priorità. */
export function pianoAccoppiaFratelli(piano: PianoLavoro = readPianoLavoro()) {
  return piano === "entrambe";
}

export function usePianoLavoro() {
  const [piano, setPiano] = useState<PianoLavoro>(readPianoLavoro);
  useEffect(() => {
    setPiano(readPianoLavoro());
    const on = () => setPiano(readPianoLavoro());
    window.addEventListener(EVENTO, on);
    return () => window.removeEventListener(EVENTO, on);
  }, []);
  function scegli(next: PianoLavoro) {
    writePianoLavoro(next);
    setPiano(next);
  }
  return [piano, scegli] as const;
}
