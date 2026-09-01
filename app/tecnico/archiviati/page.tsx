"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniCalendario } from "@/components/RapportiniCalendario";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa } from "@/lib/sezioni";

export default function TecnicoArchiviatiPage() {
  const { session } = useSession();
  const config = sezioneDa("archiviati")!;
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const items = rapportiniDellaSezione(rapportini, config, session);

  return (
    <>
      <h2>Archiviati</h2>
      <RapportiniCalendario
        items={items}
        linee={linee}
        hrefFor={(item) => `/tecnico/rapportini/${item.id}`}
        vuoto={config.vuoto}
      />
    </>
  );
}
