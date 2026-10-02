"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ArchivioPerLinea } from "@/components/ArchivioPerLinea";
import { RapportiniCalendario } from "@/components/RapportiniCalendario";
import { confermaECancellaRapportino } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa, type SezioneKey } from "@/lib/sezioni";

type Vista = "giorno" | "linea";

function hrefFogli(sezione: SezioneKey, vista: Vista) {
  const q = new URLSearchParams({ s: sezione });
  if (vista === "linea") q.set("v", "linea");
  return `/tecnico/fogli?${q}`;
}

export default function TecnicoFogliPage() {
  const { session } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const key: SezioneKey = search.get("s") === "archiviati" ? "archiviati" : "bozze";
  const vista: Vista = search.get("v") === "linea" ? "linea" : "giorno";
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
          onClick={() => router.replace(hrefFogli("bozze", vista))}
        >
          Bozze <span className="chip-count">{conteggi.bozze}</span>
        </button>
        <button
          type="button"
          className={`chip ${key === "archiviati" ? "on" : ""}`}
          onClick={() => router.replace(hrefFogli("archiviati", vista))}
        >
          Archiviati <span className="chip-count">{conteggi.archiviati}</span>
        </button>
      </div>
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${vista === "giorno" ? "on" : ""}`}
          onClick={() => router.replace(hrefFogli(key, "giorno"))}
        >
          Calendario
        </button>
        <button
          type="button"
          className={`chip ${vista === "linea" ? "on" : ""}`}
          onClick={() => router.replace(hrefFogli(key, "linea"))}
        >
          Per linea
        </button>
      </div>
      {vista === "linea" ? (
        <ArchivioPerLinea
          key={key}
          items={items}
          linee={linee}
          hrefFor={(item) => `/tecnico/rapportini/${item.id}?da=${key}&v=linea`}
          vuoto={config.vuoto}
          onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
        />
      ) : (
        <RapportiniCalendario
          key={key}
          items={items}
          linee={linee}
          hrefFor={(item) => `/tecnico/rapportini/${item.id}?da=${key}`}
          vuoto={config.vuoto}
          onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
        />
      )}
    </>
  );
}
