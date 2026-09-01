"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniPerTensione } from "@/components/RapportiniPerTensione";
import { useSession } from "@/lib/SessionContext";
import { rapportiniDellaSezione, sezioneDa } from "@/lib/sezioni";

export default function ElencoSezionePage({
  params,
}: {
  params: Promise<{ sezione: string }>;
}) {
  const { sezione } = use(params);
  const { session } = useSession();

  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  const config = sezioneDa(sezione);
  if (!config) notFound();

  const items = rapportiniDellaSezione(rapportini, config, session);

  return (
    <>
      <div>
        <div className="kicker">{config.kicker}</div>
        <h2>{config.titolo}</h2>
        <p className="muted">{config.descrizione}</p>
      </div>

      <RapportiniPerTensione
        items={items}
        linee={linee}
        hrefFor={(item) => `/operatore/${item.id}`}
        vuoto={config.vuoto}
      />
    </>
  );
}
