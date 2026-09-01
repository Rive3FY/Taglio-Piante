"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRapportino } from "@/lib/db";

export function messaggioCancellaRapportino(numero: string) {
  return `Cancellare il rapportino ${numero}? Le campate collegate tornano da tagliare. L’operazione non si può annullare.`;
}

export async function confermaECancellaRapportino(id: string, numero: string) {
  const ok = window.confirm(messaggioCancellaRapportino(numero));
  if (!ok) return false;
  await deleteRapportino(id);
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      const fatto = await confermaECancellaRapportino(id, numero);
      if (fatto && href) router.push(href);
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
