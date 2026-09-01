"use client";

import type { AvanzamentoPriorita } from "@/lib/contabilita/aggrega";
import { CAMPATA_PRIORITA_LABEL } from "@/lib/types";

const FETTE = [
  { key: "tagliate" as const, label: "Tagliate", color: "#15803d" },
  { key: "daTagliare" as const, label: "Da tagliare", color: "#b45309" },
  { key: "tralasciate" as const, label: "Tralasciate", color: "#64748b" },
];

export function TortaAvanzamento({ dati }: { dati: AvanzamentoPriorita }) {
  const tot = Math.max(dati.totale, 1);
  let acc = 0;
  const stops: string[] = [];
  for (const f of FETTE) {
    const q = dati[f.key];
    const from = (acc / tot) * 100;
    acc += q;
    const to = (acc / tot) * 100;
    stops.push(`${f.color} ${from}% ${to}%`);
  }
  const titolo = CAMPATA_PRIORITA_LABEL[dati.priorita];
  const vuoto = dati.totale === 0;

  return (
    <section className="panel torta-card">
      <h2>{titolo}</h2>
      <p className="muted">
        {vuoto ? "Nessuna campata in elenco." : `${dati.tagliate} tagliate su ${dati.totale}`}
      </p>
      <div className="torta-layout">
        <div
          className={`torta${vuoto ? " is-empty" : ""}`}
          style={vuoto ? undefined : { background: `conic-gradient(${stops.join(", ")})` }}
          role="img"
          aria-label={`${titolo}: ${dati.tagliate} tagliate su ${dati.totale}`}
        />
        <ul className="torta-leggenda">
          {FETTE.map((f) => (
            <li key={f.key}>
              <span className="torta-dot" style={{ background: f.color }} />
              {f.label}
              <strong>{dati[f.key]}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
