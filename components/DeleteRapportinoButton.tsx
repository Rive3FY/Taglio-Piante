"use client";

import { useState } from "react";
import { deleteRapportini, deleteRapportino } from "@/lib/db";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import type { EsitoSalvataggio } from "./PopupEsitoSalvataggio";

export function messaggioCancellaRapportino(numero: string) {
  return `Cancellare il rapportino ${numero}? Le campate collegate tornano da tagliare. L’operazione non si può annullare.`;
}

export async function confermaECancellaRapportino(
  id: string,
  numero: string,
  dopo: EsitoSalvataggio["dopo"] = "resta",
) {
  const ok = window.confirm(messaggioCancellaRapportino(numero));
  if (!ok) return false;
  await deleteRapportino(id);
  mostraEsito({
    titolo: "Rapportino cancellato",
    testo: `${numero} non è più in elenco. Le campate collegate tornano da tagliare.`,
    dopo,
  });
  return true;
}

export function messaggioCancellaRapportini(numeri: string[]) {
  if (numeri.length === 1) return messaggioCancellaRapportino(numeri[0] ?? "");
  const anteprima = numeri.slice(0, 8).join(", ");
  const extra = numeri.length > 8 ? ` e altri ${numeri.length - 8}` : "";
  return `Cancellare ${numeri.length} rapportini (${anteprima}${extra})? Le campate collegate tornano da tagliare. L’operazione non si può annullare.`;
}

export async function confermaECancellaRapportini(items: { id: string; numero: string }[]) {
  if (items.length === 0) return false;
  const ok = window.confirm(messaggioCancellaRapportini(items.map((i) => i.numero)));
  if (!ok) return false;
  await deleteRapportini(items.map((i) => i.id));
  const uno = items.length === 1;
  mostraEsito({
    titolo: uno ? "Rapportino cancellato" : "Rapportini cancellati",
    testo: uno
      ? `${items[0]?.numero ?? ""} non è più in elenco. Le campate collegate tornano da tagliare.`
      : `Cancellati ${items.length} fogli. Le campate collegate tornano da tagliare.`,
    dopo: "resta",
  });
  return true;
}

export function DeleteRapportinoButton({
  id,
  numero,
  href = "/",
  compact = false,
}: {
  id: string;
  numero: string;
  href?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      await confermaECancellaRapportino(id, numero, href);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-danger${compact ? " btn-sm" : ""}`}
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? "Cancellazione…" : compact ? "Elimina" : "Cancella rapportino"}
    </button>
  );
}
