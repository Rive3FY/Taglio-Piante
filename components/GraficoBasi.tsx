"use client";

import type { BasiPerLinea } from "@/lib/contabilita/aggrega";

export function GraficoBasi({
  totale,
  perLinea,
}: {
  totale: number;
  perLinea: BasiPerLinea[];
}) {
  const max = Math.max(1, ...perLinea.map((l) => l.tagliate));
  return (
    <section className="panel">
      <h2>Basi tagliate</h2>
      <p className="muted">
        {totale === 0
          ? "Nessuna base in questo mese (voci 5.1–5.4)."
          : `${totale} ${totale === 1 ? "base tagliata" : "basi tagliate"} nel mese.`}
      </p>
      {perLinea.length > 0 ? (
        <ul className="basi-barre">
          {perLinea.map((l) => (
            <li key={l.lineaId}>
              <span className="basi-barre-linea">
                {l.codiceLinea} · {l.nomeLinea}
              </span>
              <span className="basi-barre-track">
                <span
                  className="basi-barre-fill"
                  style={{ width: `${(l.tagliate / max) * 100}%` }}
                />
              </span>
              <strong>{l.tagliate}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
