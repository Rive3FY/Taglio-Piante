"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniPerTensione } from "@/components/RapportiniPerTensione";
import type { RapportinoStato } from "@/lib/types";

export function RapportinoList({
  stato,
  title,
  empty,
}: {
  stato: RapportinoStato;
  title: string;
  empty: string;
}) {
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const items = useLiveQuery(
    () => db.rapportini.where("stato").equals(stato).toArray(),
    [stato],
  ) ?? [];

  return (
    <>
      <h2>{title}</h2>
      <RapportiniPerTensione
        items={items}
        linee={linee}
        hrefFor={(item) => `/tecnico/rapportini/${item.id}`}
        vuoto={empty}
      />
    </>
  );
}
