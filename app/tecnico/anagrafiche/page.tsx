"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { lineaDescrizione } from "@/lib/format";

export default function AnagrafichePage() {
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const ditte = useLiveQuery(() => db.ditte.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(() => db.prestazioni.orderBy("codice").toArray(), []) ?? [];

  return (
    <>
      <h2>Database locale</h2>
      <p className="muted">Anagrafiche sul dispositivo. Restano disponibili anche offline.</p>

      <section className="panel">
        <h2>Linee ({linee.length})</h2>
        {linee.map((l) => (
          <div key={l.id} className="rap-card-meta">
            <strong>{l.codice}</strong>
            <span>{lineaDescrizione(l)}</span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Ditte ({ditte.length})</h2>
        {ditte.map((d) => (
          <div key={d.id} className="rap-card-meta">
            <strong>{d.ragioneSociale}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Prestazioni ({prestazioni.length})</h2>
        {prestazioni.map((p) => (
          <div key={p.id} className="rap-card-meta">
            <strong>{p.codice}</strong>
            <span>{p.descrizione}</span>
            <span>{p.unitaMisura}</span>
          </div>
        ))}
      </section>
    </>
  );
}
