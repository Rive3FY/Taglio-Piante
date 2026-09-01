"use client";

import { useMemo, useState } from "react";
import { RapportiniElenco } from "./RapportiniElenco";
import { FiltroPeriodo, PERIODO_VUOTO, nelPeriodo, periodoAttivo } from "./FiltroPeriodo";
import { TENSIONI, tensioneLabel, tensioneLinea } from "@/lib/format";
import type { Linea, Rapportino } from "@/lib/types";

export function RapportiniPerTensione({
  items,
  linee,
  hrefFor,
  vuoto,
  onDelete,
}: {
  items: Rapportino[];
  linee: Linea[];
  hrefFor: (item: Rapportino) => string;
  vuoto: string;
  onDelete?: (item: Rapportino) => void;
}) {
  const [q, setQ] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_VUOTO);
  const [aperti, setAperti] = useState<number[]>([]);

  const lineaDi = useMemo(() => new Map(linee.map((l) => [l.id, l])), [linee]);

  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((r) => {
      if (!nelPeriodo(r.dataLavoro, periodo)) return false;
      if (!term) return true;
      const linea = lineaDi.get(r.lineaId);
      return [r.numero, r.campata, r.ditta, r.rappresentanteDitta, linea?.codice, linea?.nome]
        .filter(Boolean)
        .some((valore) => String(valore).toLowerCase().includes(term));
    });
  }, [items, q, periodo, lineaDi]);

  const perTensione = useMemo(() => {
    const gruppi = new Map<number, Rapportino[]>();
    for (const r of filtrati) {
      const kv = tensioneLinea(lineaDi.get(r.lineaId)) ?? 0;
      const gruppo = gruppi.get(kv) ?? [];
      gruppo.push(r);
      gruppi.set(kv, gruppo);
    }
    return gruppi;
  }, [filtrati, lineaDi]);

  const gruppi = useMemo(
    () => [...TENSIONI, 0].filter((kv) => (perTensione.get(kv) ?? []).length > 0),
    [perTensione],
  );

  if (items.length === 0) return <p className="muted">{vuoto}</p>;

  // Con un filtro attivo o un solo gruppo non ha senso tenere chiuso: si apre da solo.
  const sempreAperti = q.trim().length > 0 || periodoAttivo(periodo) || gruppi.length === 1;
  const isAperto = (kv: number) => sempreAperti || aperti.includes(kv);

  function toggle(kv: number) {
    setAperti((prev) => (prev.includes(kv) ? prev.filter((k) => k !== kv) : [...prev, kv]));
  }

  return (
    <>
      <label>
        Cerca
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Numero, linea, campata o ditta"
        />
      </label>

      <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

      <p className="muted">
        {filtrati.length === items.length
          ? `${items.length} rapportini in ${gruppi.length} tensioni`
          : `${filtrati.length} di ${items.length} rapportini`}
      </p>

      {gruppi.length === 0 ? (
        <p className="muted">
          {periodoAttivo(periodo)
            ? "Nessun rapportino in questo periodo."
            : "Nessun rapportino corrisponde alla ricerca."}
        </p>
      ) : null}

      {gruppi.map((kv) => {
        const gruppo = perTensione.get(kv) ?? [];
        const aperto = isAperto(kv);
        return (
          <section key={kv} className="panel linee-gruppo">
            <button
              type="button"
              className="linee-gruppo-head"
              onClick={() => toggle(kv)}
              aria-expanded={aperto}
            >
              <span className={`chevron ${aperto ? "giu" : ""}`} aria-hidden="true">
                ›
              </span>
              <span className={`kv-badge kv-${kv || "altro"}`}>{tensioneLabel(kv || undefined)}</span>
              <span className="muted">{gruppo.length} rapportini</span>
            </button>
            {aperto ? (
              <RapportiniElenco
                items={gruppo}
                linee={linee}
                hrefFor={hrefFor}
                vuoto={vuoto}
                onDelete={onDelete}
                passo={5}
                mostraTestata={false}
              />
            ) : null}
          </section>
        );
      })}
    </>
  );
}
