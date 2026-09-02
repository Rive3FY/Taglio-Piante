"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { TENSIONI, tensioneLabel, tensioneLinea } from "@/lib/format";
import { FiltroGruppo } from "@/components/FiltroGruppo";
import { rapportinoEChiuso, type Linea } from "@/lib/types";

type Filtro = number | "tutte";

export default function TecnicoLineePage() {
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [aperti, setAperti] = useState<number[]>([]);

  const conteggi = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const r of rapportini) {
      if (!rapportinoEChiuso(r.stato)) continue;
      mappa.set(r.lineaId, (mappa.get(r.lineaId) ?? 0) + 1);
    }
    return mappa;
  }, [rapportini]);

  const cercate = useMemo(() => {
    const term = q.trim().toLowerCase();
    const lista = [...linee].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    if (!term) return lista;
    return lista.filter(
      (l) => l.codice.toLowerCase().includes(term) || l.nome.toLowerCase().includes(term),
    );
  }, [linee, q]);

  const perTensione = useMemo(() => {
    const gruppi = new Map<number | 0, Linea[]>();
    for (const linea of cercate) {
      const kv = tensioneLinea(linea) ?? 0;
      const gruppo = gruppi.get(kv) ?? [];
      gruppo.push(linea);
      gruppi.set(kv, gruppo);
    }
    return gruppi;
  }, [cercate]);

  const gruppiVisibili = useMemo(() => {
    const chiavi = [...TENSIONI, 0].filter((kv) => (perTensione.get(kv) ?? []).length > 0);
    if (filtro === "tutte") return chiavi;
    return chiavi.filter((kv) => kv === filtro);
  }, [perTensione, filtro]);

  const totaleVisibile = gruppiVisibili.reduce(
    (tot, kv) => tot + (perTensione.get(kv) ?? []).length,
    0,
  );

  // Con una ricerca o un filtro attivo i gruppi restano aperti: sono già pochi risultati.
  const sempreAperti = q.trim().length > 0 || filtro !== "tutte";
  const isAperto = (kv: number) => sempreAperti || aperti.includes(kv);

  function toggle(kv: number) {
    setAperti((prev) => (prev.includes(kv) ? prev.filter((k) => k !== kv) : [...prev, kv]));
  }

  return (
    <>
      <h2>Elenco linee</h2>

      <label>
        Cerca linea
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Codice o nome" />
      </label>

      <div className="filtri-gruppi">
        <FiltroGruppo
          titolo={filtro === "tutte" ? "Tutte le tensioni" : tensioneLabel(filtro)}
          attivo={filtro !== "tutte"}
        >
          <button
            type="button"
            className={`chip ${filtro === "tutte" ? "on" : ""}`}
            onClick={() => setFiltro("tutte")}
          >
            Tutte <span className="chip-count">{cercate.length}</span>
          </button>
          {TENSIONI.map((kv) => {
            const quante = (perTensione.get(kv) ?? []).length;
            return (
              <button
                key={kv}
                type="button"
                className={`chip ${filtro === kv ? "on" : ""}`}
                disabled={quante === 0}
                onClick={() => setFiltro(filtro === kv ? "tutte" : kv)}
              >
                {tensioneLabel(kv)} <span className="chip-count">{quante}</span>
              </button>
            );
          })}
        </FiltroGruppo>
      </div>

      {totaleVisibile === 0 ? <p className="muted">Nessuna linea trovata.</p> : null}

      {gruppiVisibili.map((kv) => {
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
              <span className="muted">{gruppo.length} linee</span>
            </button>
            {aperto ? (
              <ul className="linee-list">
                {gruppo.map((linea) => {
                  const c = conteggi.get(linea.id);
                  return (
                    <li key={linea.id}>
                      <Link href={`/tecnico/linee/${linea.id}`}>
                        <span className="linea-codice">{linea.codice}</span>
                        <span className="linea-nome">{linea.nome}</span>
                        <span className="linea-conteggi">
                          {c ? (
                            <span className="badge badge-archiviato">
                              {c} {c === 1 ? "archiviato" : "archiviati"}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
