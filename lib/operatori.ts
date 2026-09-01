import { db } from "./db";
import { accessToken } from "./supabase/client";

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

async function chiamaApi(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Serve la rete per gestire gli account operatore.");
  }

  const token = await accessToken();
  if (!token) throw new Error("Sessione scaduta: esci e rientra.");

  const res = await fetch("/api/operatori", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Operazione non riuscita.");
  return data;
}

export async function addOperatore(input: { nome: string; email: string; password: string }) {
  const data = (await chiamaApi("POST", input)) as {
    operatore?: { id: string; nome: string; email: string };
  };

  if (data.operatore) {
    await db.operatori.put({
      id: data.operatore.id,
      nome: data.operatore.nome,
      email: data.operatore.email,
      ruolo: "operatore",
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function renameOperatore(userId: string, nome: string) {
  const pulito = nome.trim().replace(/\s+/g, " ");
  if (!pulito) throw new Error("Il nome non può essere vuoto.");

  await chiamaApi("PATCH", { userId, nome: pulito });
  const attuale = await db.operatori.get(userId);
  if (attuale) {
    await db.operatori.put({ ...attuale, nome: pulito, updatedAt: new Date().toISOString() });
  }
}

export async function resetPasswordOperatore(userId: string, password: string) {
  await chiamaApi("PATCH", { userId, password });
}

export async function removeOperatore(userId: string) {
  await chiamaApi("DELETE", { userId });
  await db.operatori.delete(userId);
}
