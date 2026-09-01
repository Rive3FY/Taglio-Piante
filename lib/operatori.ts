import { db } from "./db";
import type { Operatore } from "./types";
import { supabaseReady } from "./supabase/remote";

function slug(nome: string) {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function matchOperatore(nome: string | null | undefined, operatori: string[]) {
  const n = nome?.trim().toLowerCase();
  if (!n) return "";
  const exact = operatori.find((op) => op.toLowerCase() === n);
  if (exact) return exact;
  const starts = operatori.find(
    (op) => op.toLowerCase().startsWith(n) || n.startsWith(op.split(" ")[0].toLowerCase()),
  );
  return starts ?? "";
}

export function listaOperatori() {
  return db.operatori.orderBy("nome").toArray();
}

/** Salva in locale e prova a propagare su Supabase. Ritorna false se il push non è riuscito. */
async function pushSafe(operatore: Operatore) {
  if (!supabaseReady()) return false;
  try {
    const { pushOperatore } = await import("./supabase/remote");
    await pushOperatore(operatore);
    return true;
  } catch {
    return false;
  }
}

export async function addOperatore(nome: string) {
  const pulito = nome.trim().replace(/\s+/g, " ");
  if (!pulito) throw new Error("Inserisci il nome dell’operatore.");

  const esistenti = await db.operatori.toArray();
  if (esistenti.some((o) => o.nome.toLowerCase() === pulito.toLowerCase())) {
    throw new Error("Questo operatore è già in elenco.");
  }

  const base = slug(pulito) || `op_${Date.now()}`;
  const id = esistenti.some((o) => o.id === `op_${base}`) ? `op_${base}_${Date.now()}` : `op_${base}`;
  const operatore: Operatore = { id, nome: pulito, updatedAt: new Date().toISOString() };

  await db.operatori.put(operatore);
  return pushSafe(operatore);
}

export async function renameOperatore(id: string, nome: string) {
  const pulito = nome.trim().replace(/\s+/g, " ");
  if (!pulito) throw new Error("Il nome non può essere vuoto.");

  const operatore: Operatore = { id, nome: pulito, updatedAt: new Date().toISOString() };
  await db.operatori.put(operatore);
  return pushSafe(operatore);
}

export async function removeOperatore(id: string) {
  await db.operatori.delete(id);
  if (!supabaseReady()) return false;
  try {
    const { deleteRemoteOperatore } = await import("./supabase/remote");
    await deleteRemoteOperatore(id);
    return true;
  } catch {
    return false;
  }
}
