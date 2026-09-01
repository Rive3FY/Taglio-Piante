"use client";

import { useMemo, useState } from "react";
import { RapportinoCard } from "./RapportinoCard";
import { FiltroPeriodo, PERIODO_VUOTO, nelPeriodo, periodoAttivo } from "./FiltroPeriodo";
import type { Linea, Rapportino } from "@/lib/types";

export function RapportiniElenco({
  items,
  linee,
  hrefFor,
  vuoto,
  onDelete,
  passo = 5,
  ricercaDa = 8,
  mostraTestata = true,
  filtroData = false,
}: {
  items: Rapportino[];
  linee: Linea[];
  hrefFor: (item: Rapportino) => string;
  vuoto: string;
  onDelete?: (item: Rapportino) => void;
  /** Quante schede mostrare subito e quante aggiungerne a ogni tocco. */
  passo?: number;
  /** Da quanti rapportini in su compare il campo di ricerca. */
  ricercaDa?: number;
  /** Conteggio e ricerca: si nascondono quando l'elenco sta dentro un gruppo. */
  mostraTestata?: boolean;
  /** Filtro per data del lavoro: serve negli archivi. */
  filtroData?: boolean;
}) {
  const [visibili, setVisibili] = useState(passo);
  const [q, setQ] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_VUOTO);

  const lineaDi = useMemo(() => new Map(linee.map((l) => [l.id, l])), [linee]);

  const ordinati = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          b.dataLavoro.localeCompare(a.dataLavoro) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    [items],
  );

  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ordinati.filter((r) => {
      if (filtroData && !nelPeriodo(r.dataLavoro, periodo)) return false;
      if (!term) return true;
      const linea = lineaDi.get(r.lineaId);
      return [r.numero, r.campata, r.ditta, r.rappresentanteDitta, linea?.codice, linea?.nome]
        .filter(Boolean)
        .some((valore) => String(valore).toLowerCase().includes(term));
    });
  }, [ordinati, q, lineaDi, filtroData, periodo]);

  if (items.length === 0) return <p className="muted">{vuoto}</p>;

  const mostrati = filtrati.slice(0, visibili);
  const restanti = filtrati.length - mostrati.length;
  const prossimi = Math.min(passo, restanti);
  const ridotto = filtrati.length !== items.length;

  return (
    <>
      {filtroData ? (
        <FiltroPeriodo
          periodo={periodo}
          onChange={(p) => {
            setPeriodo(p);
            setVisibili(passo);
          }}
        />
      ) : null}

      {mostraTestata ? (
        <div className="elenco-head">
          <span className="muted">
            {ridotto ? `${filtrati.length} di ${items.length}` : `${items.length} rapportini`}
          </span>
          {items.length >= ricercaDa ? (
            <input
              className="elenco-cerca"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisibili(passo);
              }}
              placeholder="Cerca numero, linea, ditta…"
              aria-label="Cerca nei rapportini"
            />
          ) : null}
        </div>
      ) : null}

      {mostrati.length === 0 ? (
        <p className="muted">
          {periodoAttivo(periodo)
            ? "Nessun rapportino in questo periodo."
            : "Nessun rapportino corrisponde alla ricerca."}
        </p>
      ) : (
        <div className="form-stack">
          {mostrati.map((item) => (
            <RapportinoCard
              key={item.id}
              item={item}
              linea={lineaDi.get(item.lineaId)}
              href={hrefFor(item)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {restanti > 0 || visibili > passo ? (
        <div className="elenco-azioni">
          {restanti > 0 ? (
            <button
              type="button"
              className="btn elenco-piu"
              onClick={() => setVisibili((v) => v + passo)}
            >
              Mostra altri {prossimi} · restano {restanti}
            </button>
          ) : null}
          {visibili > passo ? (
            <button
              type="button"
              className="btn elenco-piu elenco-riduci"
              onClick={() => setVisibili(passo)}
            >
              Riduci
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
