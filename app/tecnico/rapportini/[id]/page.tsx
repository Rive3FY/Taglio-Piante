"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportinoForm } from "@/components/RapportinoForm";
import { RapportinoSheet } from "@/components/RapportinoSheet";
import { DeleteRapportinoButton } from "@/components/DeleteRapportinoButton";
import { rapportinoEChiuso } from "@/lib/types";

export default function TecnicoRapportinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const item = useLiveQuery(() => db.rapportini.get(id), [id]);
  const linea = useLiveQuery(() => (item ? db.linee.get(item.lineaId) : undefined), [item?.lineaId]);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  if (!item) return <p className="muted">Caricamento…</p>;

  if (rapportinoEChiuso(item.stato)) {
    return (
      <>
        <RapportinoSheet item={item} linea={linea} prestazioni={prestazioni} />
        <div className="danger-actions">
          <DeleteRapportinoButton
            id={item.id}
            numero={item.numero}
            href="/tecnico/archiviati"
          />
        </div>
      </>
    );
  }

  return <RapportinoForm existing={item} />;
}
