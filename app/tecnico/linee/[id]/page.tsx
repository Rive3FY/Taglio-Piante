"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniElenco } from "@/components/RapportiniElenco";
import { lineaDescrizione, lineaKicker } from "@/lib/format";
import { rapportinoEChiuso } from "@/lib/types";

export default function LineaArchivioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const linea = useLiveQuery(() => db.linee.get(id), [id]);
  const items = useLiveQuery(
    () => db.rapportini.where("lineaId").equals(id).toArray(),
    [id],
  );

  const archiviati = (items ?? []).filter((r) => rapportinoEChiuso(r.stato));

  if (!linea) return <p className="muted">Caricamento linea…</p>;

  return (
    <>
      <div>
        <div className="kicker">{lineaKicker(linea)}</div>
        <h2>{lineaDescrizione(linea)}</h2>
      </div>

      <section className="panel">
        <h2>Archiviati</h2>
        <RapportiniElenco
          items={archiviati}
          linee={[linea]}
          hrefFor={(item) => `/tecnico/rapportini/${item.id}`}
          vuoto="Nessun rapportino archiviato su questa linea."
          passo={8}
          filtroData
        />
      </section>
    </>
  );
}
