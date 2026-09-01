"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { isBaseLavoro } from "@/lib/campate/basi";
import type { CampataLavoro } from "@/lib/types";

type Gruppo = {
  lineaId: string;
  codiceLinea: string;
  nomeLinea: string;
  basi: CampataLavoro[];
};

export default function TecnicoBasiPage() {
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const [aperta, setAperta] = useState<string | null>(null);

  const gruppi = useMemo(() => {
    const map = new Map<string, Gruppo>();
    for (const c of campate) {
      if (!isBaseLavoro(c) || c.stato !== "tagliata") continue;
      const g = map.get(c.lineaId) ?? {
        lineaId: c.lineaId,
        codiceLinea: c.codiceLinea,
        nomeLinea: c.nomeLinea,
        basi: [],
      };
      g.basi.push(c);
      map.set(c.lineaId, g);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        basi: [...g.basi].sort((a, b) =>
          a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }),
        ),
      }))
      .sort((a, b) => a.codiceLinea.localeCompare(b.codiceLinea, "it"));
  }, [campate]);

  const totale = gruppi.reduce((s, g) => s + g.basi.length, 0);

  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Basi</h2>
          <p className="muted">
            Sostegni puliti quando i numeri nel box coincidono con 5.1–5.4. Tocca una linea per vedere i numeri.
          </p>
        </div>
        <strong>{totale}</strong>
      </div>

      {gruppi.length === 0 ? (
        <p className="muted">Nessuna base tagliata. Compila un rapportino con 5.1–5.4 e lo stesso numero di sostegni nel box.</p>
      ) : (
        <div className="contab-linee">
          {gruppi.map((g) => {
            const open = aperta === g.lineaId;
            return (
              <section key={g.lineaId} className="panel">
                <button
                  type="button"
                  className="linee-gruppo-head"
                  aria-expanded={open}
                  onClick={() => setAperta(open ? null : g.lineaId)}
                >
                  <span className={`chevron ${open ? "giu" : ""}`} aria-hidden="true">
                    ›
                  </span>
                  <strong>
                    {g.codiceLinea} · {g.nomeLinea}
                  </strong>
                  <span className="muted">
                    {g.basi.length} {g.basi.length === 1 ? "base" : "basi"}
                  </span>
                </button>
                {open ? (
                  <div className="campate-table-wrap">
                    <table className="campate-table">
                      <thead>
                        <tr>
                          <th>Base</th>
                          <th>Data</th>
                          <th>Operatore</th>
                          <th>Rapportino</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.basi.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.normalizzata}</strong>
                            </td>
                            <td>{b.dataTaglio ? formatDate(b.dataTaglio) : "—"}</td>
                            <td>{b.operatore ?? "—"}</td>
                            <td>
                              {b.rapportinoId ? (
                                <Link href={`/tecnico/rapportini/${b.rapportinoId}`}>Apri</Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
