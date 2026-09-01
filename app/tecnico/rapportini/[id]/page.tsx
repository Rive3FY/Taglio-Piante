"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync } from "@/lib/db";
import { RapportinoForm } from "@/components/RapportinoForm";
import { RapportinoSheet } from "@/components/RapportinoSheet";
import { DeleteRapportinoButton } from "@/components/DeleteRapportinoButton";

export default function TecnicoRapportinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const item = useLiveQuery(() => db.rapportini.get(id), [id]);
  const linea = useLiveQuery(() => (item ? db.linee.get(item.lineaId) : undefined), [item?.lineaId]);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  if (!item) return <p className="muted">Caricamento…</p>;

  async function archivia() {
    if (!item) return;
    setBusy(true);
    const now = new Date().toISOString();
    await db.rapportini.update(item.id, {
      stato: "archiviato",
      archiviatoAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });
    await enqueueSync(item.id, "archive");
    setBusy(false);
    router.push(`/tecnico/linee/${item.lineaId}?cartella=archiviato`);
  }

  return (
    <>
      {item.stato === "in_attesa" ? (
        <>
          <RapportinoForm existing={item} mode="compile" />
          <div className="danger-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void archivia()}>
              {busy ? "Archiviazione…" : "Archivia"}
            </button>
          </div>
        </>
      ) : (
        <>
          <RapportinoSheet
            item={item}
            linea={linea}
            prestazioni={prestazioni}
          />
          <div className="danger-actions">
            <DeleteRapportinoButton
              id={item.id}
              numero={item.numero}
              href={item.lineaId ? `/tecnico/linee/${item.lineaId}` : "/tecnico"}
            />
          </div>
        </>
      )}
    </>
  );
}
