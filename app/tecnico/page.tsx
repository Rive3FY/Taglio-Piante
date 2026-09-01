"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { lineaDescrizione, lineaKicker } from "@/lib/format";

export default function TecnicoLineePage() {
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = [...linee].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    if (!term) return list;
    return list.filter(
      (l) =>
        l.codice.toLowerCase().includes(term) ||
        l.nome.toLowerCase().includes(term),
    );
  }, [linee, q]);

  return (
    <>
      <h2>Elenco linee</h2>
      <p className="muted">Apri una linea per vedere i rapportini In attesa e Archiviati.</p>
      <label>
        Cerca linea
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Codice o nome"
        />
      </label>
      <div className="linee-grid">
        {filtered.map((linea) => {
          const ofLine = rapportini.filter((r) => r.lineaId === linea.id);
          return (
            <Link key={linea.id} href={`/tecnico/linee/${linea.id}`} className="linea-card">
              <div className="kicker">{lineaKicker(linea)}</div>
              <h2>{lineaDescrizione(linea)}</h2>
              <div className="rap-card-meta">
                <span>In attesa {ofLine.filter((r) => r.stato === "in_attesa").length}</span>
                <span>Archiviati {ofLine.filter((r) => r.stato === "archiviato").length}</span>
              </div>
            </Link>
          );
        })}
      </div>
      {filtered.length === 0 ? <p className="muted">Nessuna linea trovata.</p> : null}
    </>
  );
}
