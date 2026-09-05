"use client";

import { use, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportinoForm } from "@/components/RapportinoForm";
import { RapportinoSheet } from "@/components/RapportinoSheet";
import { DeleteRapportinoButton } from "@/components/DeleteRapportinoButton";
import { useSync } from "@/lib/SyncContext";
import { rapportinoEChiuso } from "@/lib/types";
import { haFirmaDitta, riportaInBozzaSeMancaFirma } from "@/lib/rapportinoFirma";

export default function TecnicoRapportinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { syncNow } = useSync();
  const item = useLiveQuery(() => db.rapportini.get(id), [id]);
  const linea = useLiveQuery(() => (item ? db.linee.get(item.lineaId) : undefined), [item?.lineaId]);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  useEffect(() => {
    if (!item || !rapportinoEChiuso(item.stato) || haFirmaDitta(item.firmaOperatore)) return;
    void riportaInBozzaSeMancaFirma(item).then(() => syncNow());
  }, [item, syncNow]);

  if (!item) return <p className="muted">Caricamento…</p>;

  if (rapportinoEChiuso(item.stato) && haFirmaDitta(item.firmaOperatore)) {
    return (
      <>
        <RapportinoSheet item={item} linea={linea} prestazioni={prestazioni} />
        <div className="danger-actions">
          <DeleteRapportinoButton
            id={item.id}
            numero={item.numero}
            href="/tecnico/fogli?s=archiviati"
          />
        </div>
      </>
    );
  }

  return <RapportinoForm existing={item} />;
}
