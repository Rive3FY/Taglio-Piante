"use client";

import { use, useEffect } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ArchivioPerLinea } from "@/components/ArchivioPerLinea";
import { RapportiniCalendario } from "@/components/RapportiniCalendario";
import { confermaECancellaRapportino } from "@/components/DeleteRapportinoButton";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa } from "@/lib/sezioni";

export default function ElencoSezionePage({
  params,
}: {
  params: Promise<{ sezione: string }>;
}) {
  const { sezione } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { session } = useSession();
  const vista = search.get("v") === "linea" ? "linea" : "giorno";

  useEffect(() => {
    if (sezione === "in-attesa") router.replace("/operatore/elenco/archiviati");
  }, [sezione, router]);

  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  if (sezione === "in-attesa") return <p className="muted">Reindirizzamento…</p>;

  const config = sezioneDa(sezione);
  if (!config) notFound();

  const items = rapportiniDellaSezione(rapportini, config, session, "operatore");

  return (
    <>
      <div>
        <div className="kicker">{config.kicker}</div>
        <h2>{config.titolo}</h2>
        <p className="muted">{config.descrizione}</p>
      </div>

      {config.key === "archiviati" ? (
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${vista === "giorno" ? "on" : ""}`}
            onClick={() => router.replace("/operatore/elenco/archiviati")}
          >
            Calendario
          </button>
          <button
            type="button"
            className={`chip ${vista === "linea" ? "on" : ""}`}
            onClick={() => router.replace("/operatore/elenco/archiviati?v=linea")}
          >
            Per linea
          </button>
        </div>
      ) : null}

      {config.key === "archiviati" && vista === "linea" ? (
        <ArchivioPerLinea
          items={items}
          linee={linee}
          hrefFor={(item) => `/operatore/${item.id}`}
          vuoto={config.vuoto}
          onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
        />
      ) : (
        <RapportiniCalendario
          key={config.key}
          items={items}
          linee={linee}
          hrefFor={(item) => `/operatore/${item.id}`}
          vuoto={config.vuoto}
          onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
        />
      )}
    </>
  );
}
