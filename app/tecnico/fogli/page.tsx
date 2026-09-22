"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ArchivioPerLinea } from "@/components/ArchivioPerLinea";
import { confermaECancellaRapportino } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa, type SezioneKey } from "@/lib/sezioni";

export default function TecnicoFogliPage() {
  const { session } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const key: SezioneKey = search.get("s") === "archiviati" ? "archiviati" : "bozze";
  const config = sezioneDa(key)!;
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const items = rapportiniDellaSezione(rapportini, config, session);
  const conteggi = useMemo(
    () => ({
      bozze: rapportiniDellaSezione(rapportini, sezioneDa("bozze")!, session).length,
      archiviati: rapportiniDellaSezione(rapportini, sezioneDa("archiviati")!, session).length,
    }),
    [rapportini, session],
  );

  return (
    <>
      <h2>Rapportini</h2>
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${key === "bozze" ? "on" : ""}`}
          onClick={() => router.replace("/tecnico/fogli?s=bozze")}
        >
          Bozze <span className="chip-count">{conteggi.bozze}</span>
        </button>
        <button
          type="button"
          className={`chip ${key === "archiviati" ? "on" : ""}`}
          onClick={() => router.replace("/tecnico/fogli?s=archiviati")}
        >
          Archiviati <span className="chip-count">{conteggi.archiviati}</span>
        </button>
      </div>
      <ArchivioPerLinea
        key={key}
        items={items}
        linee={linee}
        hrefFor={(item) => `/tecnico/rapportini/${item.id}?da=${key}`}
        vuoto={config.vuoto}
        onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
      />
    </>
  );
}
