"use client";

import { useMemo, useState } from "react";
import type { BasiPerLinea } from "@/lib/contabilita/aggrega";
import { LineaPicker } from "@/components/LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "@/components/MostraAltro";

export function GraficoBasi({
  totale,
  perLinea,
}: {
  totale: number;
  perLinea: BasiPerLinea[];
}) {
  const max = Math.max(1, ...perLinea.map((l) => l.tagliate));
  const [cerca, setCerca] = useState("");
  const [cercataId, setCercataId] = useState("");
  const [mostraAltre, setMostraAltre] = useState(false);

  const opzioni = useMemo(
    () =>
      perLinea.map((l) => ({
        id: l.lineaId,
        codice: l.codiceLinea,
        nome: l.nomeLinea,
      })),
    [perLinea],
  );

  const filtrate = useMemo(() => {
    if (cercataId) return perLinea.filter((l) => l.lineaId === cercataId);
    const term = cerca.trim().toLowerCase();
    if (!term) return perLinea;
    return perLinea.filter(
      (l) =>
        l.codiceLinea.toLowerCase().includes(term) ||
        l.nomeLinea.toLowerCase().includes(term),
    );
  }, [perLinea, cerca, cercataId]);

  const visibili = mostraAltre || cercataId ? filtrate : filtrate.slice(0, ANTEPRIMA_ELENCO);

  return (
    <section className="panel">
      <div className="elenco-head">
        <h2>Basi tagliate</h2>
        {perLinea.length > 0 ? (
          <label className="contab-cerca-linea">
            Cerca linea
            <LineaPicker
              linee={opzioni}
              value={cercataId}
              campo="completa"
              placeholder="Codice o nome linea"
              onQueryChange={(q) => {
                setCerca(q);
                setMostraAltre(false);
              }}
              onChange={(id) => {
                setCercataId(id);
                if (!id) setMostraAltre(false);
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="muted">
        {totale === 0
          ? "Nessuna base in questo mese (voci 5.1–5.4)."
          : `${totale} ${totale === 1 ? "base tagliata" : "basi tagliate"} nel mese.`}
      </p>
      {filtrate.length === 0 && perLinea.length > 0 ? (
        <p className="muted">Nessuna linea trovata.</p>
      ) : visibili.length > 0 ? (
        <>
          <ul className="basi-barre">
            {visibili.map((l) => (
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
          {!cercataId ? (
            <MostraAltro
              aperto={mostraAltre}
              totale={filtrate.length}
              onToggle={() => setMostraAltre((v) => !v)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
