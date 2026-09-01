"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniCalendario } from "@/components/RapportiniCalendario";
import { confermaECancellaRapportino } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa } from "@/lib/sezioni";

export default function TecnicoBozzePage() {
  const { session } = useSession();
  const config = sezioneDa("bozze")!;
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const items = rapportiniDellaSezione(rapportini, config, session);

  return (
    <>
      <h2>Bozze</h2>
      <RapportiniCalendario
        items={items}
        linee={linee}
        hrefFor={(item) => `/tecnico/rapportini/${item.id}`}
        vuoto={config.vuoto}
        onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
      />
    </>
  );
}
