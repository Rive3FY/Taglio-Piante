import { db } from "./db";
import { getSupabase } from "./supabase/client";
import { lineaToRow } from "./supabase/mappers";
import type { Linea } from "./types";

function richiediRete() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non è configurato su questo dispositivo.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Serve la rete per modificare l’elenco delle linee.");
  }
  return supabase;
}

export async function addLinea(input: { codice: string; nome: string }) {
  const codice = input.codice.trim().toUpperCase().replace(/\s+/g, "");
  const nome = input.nome.trim().replace(/\s+/g, " ");

  if (!codice) throw new Error("Indica il codice della linea.");
  if (!nome) throw new Error("Indica il nome della linea.");

  const esistenti = await db.linee.toArray();
  if (esistenti.some((l) => l.codice.toUpperCase() === codice)) {
    throw new Error("Esiste già una linea con questo codice.");
  }

  const supabase = richiediRete();
  const linea: Linea = { id: `lin_${codice.toLowerCase()}`, codice, nome };

  const { error } = await supabase.from("linee").insert(lineaToRow(linea));
  if (error) {
    throw new Error(
      error.code === "23505" ? "Esiste già una linea con questo codice." : error.message,
    );
  }

  await db.linee.put(linea);
  return linea;
}

export async function removeLinea(id: string) {
  const collegati = await db.rapportini.where("lineaId").equals(id).count();
  if (collegati > 0) {
    throw new Error(
      `Questa linea ha ${collegati} rapportini collegati: elimina prima quelli, poi la linea.`,
    );
  }

  const supabase = richiediRete();
  const { error } = await supabase.from("linee").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Ci sono rapportini collegati a questa linea, quindi non si può eliminare."
        : error.message,
    );
  }

  await db.linee.delete(id);
}
