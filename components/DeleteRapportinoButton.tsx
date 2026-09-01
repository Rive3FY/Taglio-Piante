"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRapportino } from "@/lib/db";

export function DeleteRapportinoButton({
  id,
  numero,
  href = "/",
}: {
  id: string;
  numero: string;
  href?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Cancellare il rapportino ${numero}? L’operazione non si può annullare.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteRapportino(id);
      router.push(href);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void onDelete()}>
      {busy ? "Cancellazione…" : "Cancella rapportino"}
    </button>
  );
}
