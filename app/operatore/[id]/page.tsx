"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync } from "@/lib/db";
import { useSync } from "@/lib/SyncContext";
import { RapportinoForm } from "@/components/RapportinoForm";
import { RapportinoSheet } from "@/components/RapportinoSheet";
import { DeleteRapportinoButton } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";
import { rapportinoVisibile } from "@/lib/sezioni";
import { rapportinoEChiuso } from "@/lib/types";

export default function OperatoreRapportinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useSession();
  const { syncNow } = useSync();
  const item = useLiveQuery(() => db.rapportini.get(id), [id]);
  const linea = useLiveQuery(() => (item ? db.linee.get(item.lineaId) : undefined), [item?.lineaId]);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  useEffect(() => {
    if (!item || item.stato !== "da_prendere" || !session) return;
    const now = new Date().toISOString();
    void db.rapportini.update(item.id, {
      stato: "bozza",
      presoDa: item.presoDa || session.nome,
      dipendenteTerna: item.dipendenteTerna || session.nome,
      updatedAt: now,
      syncStatus: "pending",
    }).then(() => enqueueSync(item.id, "take")).then(() => syncNow());
  }, [item, session, syncNow]);

  if (item === undefined) return <p className="muted">Caricamento…</p>;
  if (!item) return <p className="muted">Rapportino non trovato sul dispositivo.</p>;
  if (!rapportinoVisibile(item, session)) {
    return <p className="muted">Questo rapportino è di un altro operatore.</p>;
  }

  const readOnly = rapportinoEChiuso(item.stato);

  return (
    <>
      {readOnly ? (
        <>
          <p className="muted">
            Foglio compilato e archiviato. Puoi consultarlo e scaricare il PDF ufficiale.
          </p>
          <RapportinoSheet item={item} linea={linea} prestazioni={prestazioni} />
          <div className="danger-actions">
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/operatore")}>
              Torna all’elenco
            </button>
            <DeleteRapportinoButton id={item.id} numero={item.numero} href="/operatore" />
          </div>
        </>
      ) : (
        <RapportinoForm existing={item} />
      )}
    </>
  );
}
