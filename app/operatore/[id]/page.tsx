"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync } from "@/lib/db";
import { lineaDescrizione } from "@/lib/format";
import { matchOperatore } from "@/lib/operatori";
import { RapportinoForm } from "@/components/RapportinoForm";
import { RapportinoSheet } from "@/components/RapportinoSheet";
import { DeleteRapportinoButton } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";

export default function OperatoreRapportinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const item = useLiveQuery(() => db.rapportini.get(id), [id]);
  const linea = useLiveQuery(() => (item ? db.linee.get(item.lineaId) : undefined), [item?.lineaId]);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  if (item === undefined) return <p className="muted">Caricamento…</p>;
  if (!item) return <p className="muted">Rapportino non trovato sul dispositivo.</p>;

  const readOnly = item.stato === "archiviato";

  async function prendi() {
    if (!item || !session) return;
    setBusy(true);
    const now = new Date().toISOString();
    await db.rapportini.update(item.id, {
      stato: "bozza",
      presoDa: session.nome,
      presoAt: now,
      dipendenteTerna: item.dipendenteTerna || matchOperatore(session.nome) || session.nome,
      rappresentanteDitta: item.rappresentanteDitta || "Sali Kali",
      updatedAt: now,
      syncStatus: "pending",
    });
    await enqueueSync(item.id, "take");
    setBusy(false);
  }

  return (
    <>
      {item.stato === "da_prendere" ? (
        <section className="panel">
          <h2>Rapportino da prendere</h2>
          <p className="muted">
            {linea ? lineaDescrizione(linea) : ""} · {item.numero}
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void prendi()}>
            {busy ? "Presa in carico…" : "Prendi e compila"}
          </button>
          <div className="danger-actions">
            <DeleteRapportinoButton id={item.id} numero={item.numero} href="/operatore" />
          </div>
        </section>
      ) : null}

      {readOnly ? (
        <>
          <p className="muted">
            Foglio compilato e archiviato. Puoi consultarlo e scaricare il PDF ufficiale.
          </p>
          <RapportinoSheet
            item={item}
            linea={linea}
            prestazioni={prestazioni}
          />
          <div className="danger-actions">
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/operatore")}>
              Torna all’elenco
            </button>
            <DeleteRapportinoButton id={item.id} numero={item.numero} href="/operatore" />
          </div>
        </>
      ) : item.stato !== "da_prendere" ? (
        <RapportinoForm existing={item} mode="compile" />
      ) : null}
    </>
  );
}
