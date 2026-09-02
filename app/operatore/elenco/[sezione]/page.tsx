"use client";

import { use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
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
  const { session } = useSession();

  useEffect(() => {
    if (sezione === "in-attesa") router.replace("/operatore/elenco/archiviati");
  }, [sezione, router]);

  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  if (sezione === "in-attesa") return <p className="muted">Reindirizzamento…</p>;

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

      <RapportiniCalendario
        items={items}
        linee={linee}
        hrefFor={(item) => `/operatore/${item.id}`}
        vuoto={config.vuoto}
        onDelete={(item) => void confermaECancellaRapportino(item.id, item.numero)}
      />
    </>
  );
}
