"use client";

import { usePathname } from "next/navigation";
import type { Area } from "./types";

/** L'area la dice il percorso, non il ruolo: il tecnico in /operatore lavora da operatore. */
export function areaDaPercorso(pathname: string | null | undefined): Area {
  return pathname?.startsWith("/tecnico") ? "tecnico" : "operatore";
}

export function useArea(): Area {
  return areaDaPercorso(usePathname());
}

export function homeArea(area: Area) {
  return area === "tecnico" ? "/tecnico" : "/operatore";
}

function key(userId: string) {
  return `rt.area.${userId}`;
}

/** Area scelta l'ultima volta dal tecnico: riaprendo l'app si torna dove si era rimasti. */
export function readArea(userId: string | null | undefined): Area | null {
  if (!userId || typeof window === "undefined") return null;
  const raw = localStorage.getItem(key(userId));
  return raw === "tecnico" || raw === "operatore" ? raw : null;
}

export function writeArea(userId: string, area: Area) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId), area);
}
