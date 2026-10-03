import { db } from "./db";
import { tensioneDaCodice } from "./format";
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

export async function aggiornaLinea(id: string, input: { codice: string; nome: string }) {
  const codice = input.codice.trim().toUpperCase().replace(/\s+/g, "");
  const nome = input.nome.trim().replace(/\s+/g, " ");

  if (!codice) throw new Error("Indica il codice della linea.");
  if (!nome) throw new Error("Indica il nome della linea.");

  const attuale = await db.linee.get(id);
  if (!attuale) throw new Error("Linea non trovata.");

  const esistenti = await db.linee.toArray();
  if (esistenti.some((l) => l.id !== id && l.codice.toUpperCase() === codice)) {
    throw new Error("Esiste già una linea con questo codice.");
  }

  const tensioneDaPrefisso = tensioneDaCodice(codice);
  const linea: Linea = {
    ...attuale,
    codice,
    nome,
    tensioneKv: tensioneDaPrefisso ?? attuale.tensioneKv,
  };

  if (
    linea.codice === attuale.codice &&
    linea.nome === attuale.nome &&
    linea.tensioneKv === attuale.tensioneKv
  ) {
    return linea;
  }

  const supabase = richiediRete();
  const { error } = await supabase.from("linee").update(lineaToRow(linea)).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "Esiste già una linea con questo codice." : error.message,
    );
  }

  await db.linee.put(linea);

  const campate = await db.campateLavoro.where("lineaId").equals(id).toArray();
  const daAggiornare = campate.filter(
    (c) => c.codiceLinea !== codice || c.nomeLinea !== nome || c.tensioneKv !== linea.tensioneKv,
  );
  if (daAggiornare.length === 0) return linea;

  const updatedAt = new Date().toISOString();
  const { error: erroreCampate } = await supabase
    .from("campate_lavoro")
    .update({
      codice_linea: codice,
      nome_linea: nome,
      tensione_kv: linea.tensioneKv ?? null,
      updated_at: updatedAt,
    })
    .eq("linea_id", id);

  await db.campateLavoro.bulkPut(
    daAggiornare.map((c) => ({
      ...c,
      codiceLinea: codice,
      nomeLinea: nome,
      tensioneKv: linea.tensioneKv,
      syncStatus:
        erroreCampate || c.syncStatus !== "synced" ? ("pending" as const) : ("synced" as const),
      updatedAt,
    })),
  );

  if (erroreCampate) {
    throw new Error(
      `Codice e nome sono aggiornati. Le campate non sono ancora sul server: ${erroreCampate.message}`,
    );
  }

  return linea;
}

function collegamentiLinea(rapportini: number, campate: number) {
  const parti: string[] = [];
  if (rapportini > 0) parti.push(`${rapportini} ${rapportini === 1 ? "rapportino" : "rapportini"}`);
  if (campate > 0) parti.push(`${campate} ${campate === 1 ? "campata" : "campate"}`);
  return parti.join(" e ");
}

export async function removeLinea(id: string) {
  const [rapportini, campate] = await Promise.all([
    db.rapportini.where("lineaId").equals(id).count(),
    db.campateLavoro.where("lineaId").equals(id).count(),
  ]);
  if (rapportini > 0 || campate > 0) {
    throw new Error(
      `Questa linea ha ${collegamentiLinea(rapportini, campate)}: non si può eliminare finché restano.`,
    );
  }

  const supabase = richiediRete();
  const { error } = await supabase.from("linee").delete().eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Ci sono rapportini o campate collegati a questa linea, quindi non si può eliminare."
        : error.message,
    );
  }

  await db.linee.delete(id);
}
