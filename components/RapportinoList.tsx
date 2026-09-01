"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportinoCard } from "@/components/RapportinoCard";
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
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="form-stack">
          {items.map((item) => (
            <RapportinoCard
              key={item.id}
              item={item}
              linea={linee.find((l) => l.id === item.lineaId)}
              href={`/tecnico/rapportini/${item.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
