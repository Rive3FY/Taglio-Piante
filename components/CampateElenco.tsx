"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate, TENSIONI, tensioneLabel } from "@/lib/format";
import { FiltroPeriodo, PERIODO_VUOTO, nelPeriodo } from "./FiltroPeriodo";
import {
  CAMPATA_ORIGINE_LABEL,
  CAMPATA_PRIORITA_LABEL,
  CAMPATA_STATO_LABEL,
  type CampataLavoro,
  type CampataOrigine,
  type CampataPriorita,
  type CampataStatoLavoro,
  type CampataStorico,
} from "@/lib/types";

type OrigineFiltro = CampataOrigine | "tutte";
type PrioritaFiltro = CampataPriorita | "tutte";
type StatoFiltro = CampataStatoLavoro | "tutte";

export function CampateElenco({
  ruolo,
}: {
  ruolo: "tecnico" | "operatore";
}) {
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const storico = useLiveQuery(() => db.campateStorico.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [kv, setKv] = useState<number | "tutte">("tutte");
  const [priorita, setPriorita] = useState<PrioritaFiltro>("tutte");
  const [stato, setStato] = useState<StatoFiltro>("tutte");
  const [origine, setOrigine] = useState<OrigineFiltro>("tutte");
  const [linea, setLinea] = useState("");
  const [operatore, setOperatore] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_VUOTO);
  const [aperta, setAperta] = useState<string | null>(null);
  const [visibili, setVisibili] = useState(40);

  const storicoPer = useMemo(() => {
    const m = new Map<string, CampataStorico[]>();
    for (const s of storico) {
      const list = m.get(s.campataId) ?? [];
      list.push(s);
      m.set(s.campataId, list);
    }
    for (const list of m.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return m;
  }, [storico]);

  const lineeOpzioni = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campate) map.set(c.codiceLinea, c.nomeLinea);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "it"));
  }, [campate]);

  const operatori = useMemo(() => {
    const set = new Set(campate.map((c) => c.operatore).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "it"));
  }, [campate]);

  const filtrate = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...campate]
      .sort(
        (a, b) =>
          a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
          a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }),
      )
      .filter((c) => {
        if (kv !== "tutte" && (c.tensioneKv ?? 0) !== kv) return false;
        if (priorita !== "tutte" && c.priorita !== priorita) return false;
        if (stato !== "tutte" && c.stato !== stato) return false;
        if (origine !== "tutte" && c.origine !== origine) return false;
        if (linea && c.codiceLinea !== linea) return false;
        if (operatore && c.operatore !== operatore) return false;
        if (c.dataTaglio && !nelPeriodo(c.dataTaglio, periodo)) return false;
        if (periodo.da && !c.dataTaglio) return false;
        if (!term) return true;
        return [c.codiceLinea, c.nomeLinea, c.normalizzata, c.originale, c.operatore]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      });
  }, [campate, q, kv, priorita, stato, origine, linea, operatore, periodo]);

  const mostrate = filtrate.slice(0, visibili);
  const restanti = filtrate.length - mostrate.length;

  const conteggi = useMemo(() => {
    return {
      totale: campate.length,
      daTagliare: campate.filter((c) => c.stato === "da_tagliare").length,
      tagliate: campate.filter((c) => c.stato === "tagliata").length,
      tralasciate: campate.filter((c) => c.stato === "tralasciata").length,
      aggiuntive: campate.filter((c) => c.origine === "aggiuntiva").length,
    };
  }, [campate]);

  return (
    <>
      <div className="chip-row">
        <span className="muted">{conteggi.totale} campate</span>
        <span className="badge">{conteggi.daTagliare} da tagliare</span>
        <span className="badge badge-tagliata">{conteggi.tagliate} tagliate</span>
        <span className="badge badge-tralasciata">{conteggi.tralasciate} tralasciate</span>
        <span className="badge badge-aggiuntiva">{conteggi.aggiuntive} aggiuntive</span>
      </div>

      <label>
        Cerca
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setVisibili(40);
          }}
          placeholder="Codice linea, nome, campata…"
        />
      </label>

      <div className="chip-row">
        <button type="button" className={`chip ${kv === "tutte" ? "on" : ""}`} onClick={() => setKv("tutte")}>
          Tutte le tensioni
        </button>
        {TENSIONI.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip ${kv === t ? "on" : ""}`}
            onClick={() => setKv(kv === t ? "tutte" : t)}
          >
            {tensioneLabel(t)}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {(["tutte", "urgente", "differibile"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${priorita === p ? "on" : ""}`}
            onClick={() => setPriorita(p)}
          >
            {p === "tutte" ? "Tutte le priorità" : CAMPATA_PRIORITA_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {(["tutte", "da_tagliare", "tagliata", "tralasciata"] as const).map((s) => (
          <button key={s} type="button" className={`chip ${stato === s ? "on" : ""}`} onClick={() => setStato(s)}>
            {s === "tutte" ? "Tutti gli stati" : CAMPATA_STATO_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {(["tutte", "prevista", "aggiuntiva"] as const).map((o) => (
          <button
            key={o}
            type="button"
            className={`chip ${origine === o ? "on" : ""}`}
            onClick={() => setOrigine(o)}
          >
            {o === "tutte" ? "Tutte" : CAMPATA_ORIGINE_LABEL[o]}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <label>
          Linea
          <select value={linea} onChange={(e) => setLinea(e.target.value)}>
            <option value="">Tutte le linee</option>
            {lineeOpzioni.map(([cod, nome]) => (
              <option key={cod} value={cod}>
                {cod} · {nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Operatore
          <select value={operatore} onChange={(e) => setOperatore(e.target.value)}>
            <option value="">Tutti</option>
            {operatori.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />

      {ruolo === "operatore" && linea ? (
        <Link
          href={`/operatore/nuovo?linea=${encodeURIComponent(campate.find((c) => c.codiceLinea === linea)?.lineaId ?? "")}`}
          className="btn btn-primary"
        >
          Rapportino precompilato su {linea}
        </Link>
      ) : null}

      {filtrate.length === 0 ? (
        <p className="muted">Nessuna campata corrisponde ai filtri.</p>
      ) : (
        <div className="campate-table-wrap">
          <table className="campate-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Nome linea</th>
                <th>kV</th>
                <th>Campata</th>
                <th>Priorità</th>
                <th>Stato</th>
                <th>Data</th>
                <th>Operatore</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {mostrate.map((c) => (
                <CampataRiga
                  key={c.id}
                  c={c}
                  storico={storicoPer.get(c.id) ?? []}
                  aperta={aperta === c.id}
                  onToggle={() => setAperta(aperta === c.id ? null : c.id)}
                  ruolo={ruolo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {restanti > 0 ? (
        <button type="button" className="btn elenco-piu" onClick={() => setVisibili((v) => v + 40)}>
          Mostra altre {Math.min(40, restanti)} · restano {restanti}
        </button>
      ) : null}
    </>
  );
}

function CampataRiga({
  c,
  storico,
  aperta,
  onToggle,
  ruolo,
}: {
  c: CampataLavoro;
  storico: CampataStorico[];
  aperta: boolean;
  onToggle: () => void;
  ruolo: "tecnico" | "operatore";
}) {
  return (
    <>
      <tr className={`campata-row campata-${c.stato}`} onClick={onToggle}>
        <td className="linea-codice">{c.codiceLinea}</td>
        <td>{c.nomeLinea}</td>
        <td>{c.tensioneKv ?? "—"}</td>
        <td>
          <strong>{c.normalizzata}</strong>
          {c.origine === "aggiuntiva" ? <span className="badge badge-aggiuntiva">Aggiuntiva</span> : null}
        </td>
        <td>
          {c.priorita ? (
            <span className={`badge badge-${c.priorita}`}>{CAMPATA_PRIORITA_LABEL[c.priorita]}</span>
          ) : (
            "—"
          )}
        </td>
        <td>
          <span className={`badge badge-${c.stato}`}>{CAMPATA_STATO_LABEL[c.stato]}</span>
        </td>
        <td>{c.dataTaglio ? formatDate(c.dataTaglio) : "—"}</td>
        <td>{c.operatore ?? "—"}</td>
        <td>{c.note ?? "—"}</td>
      </tr>
      {aperta ? (
        <tr className="campata-storico">
          <td colSpan={9}>
            {ruolo === "operatore" ? (
              <Link
                href={`/operatore/nuovo?linea=${encodeURIComponent(c.lineaId)}`}
                className="btn btn-sm elenco-piu"
              >
                Rapportino su questa linea
              </Link>
            ) : null}
            <p className="muted">
              Originale {c.originale} · {CAMPATA_ORIGINE_LABEL[c.origine]}
              {c.rapportinoId ? ` · rapportino ${c.rapportinoId}` : ""}
            </p>
            {storico.length === 0 ? (
              <p className="muted">Nessuno storico ancora.</p>
            ) : (
              <ul className="storico-list">
                {storico.map((s) => (
                  <li key={s.id}>
                    <strong>{s.evento.replaceAll("_", " ")}</strong>
                    {s.stato ? ` · ${CAMPATA_STATO_LABEL[s.stato]}` : ""}
                    {s.operatore ? ` · ${s.operatore}` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                    <span className="muted"> · {new Date(s.createdAt).toLocaleString("it-IT")}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
