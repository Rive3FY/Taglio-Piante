"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { annoPianoPiuRecente, campateDellAnno } from "@/lib/campate/anno";
import { mostraCampata } from "@/lib/campate/normalize";
import { soloCampateVisibili } from "@/lib/campate/urgenze";
import { avanzamentoPriorita } from "@/lib/contabilita/aggrega";
import { formatDate, statoLabel, TENSIONI, tensioneLabel, tensioneLinea, todayIso } from "@/lib/format";
import {
  MESI_LABEL,
  campataNonTerminata,
  rapportinoEChiuso,
  type Linea,
  type Rapportino,
} from "@/lib/types";
import { TortaAvanzamento } from "./TortaAvanzamento";

const MAX_RIGHE = 6;
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function isoGiorno(anno: number, mese: number, giorno: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${anno}-${pad(mese + 1)}-${pad(giorno)}`;
}

function celleMese(anno: number, mese: number) {
  const offset = (new Date(anno, mese, 1).getDay() + 6) % 7;
  const ultimo = new Date(anno, mese + 1, 0).getDate();
  const celle: Array<number | null> = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let giorno = 1; giorno <= ultimo; giorno++) celle.push(giorno);
  while (celle.length % 7 !== 0) celle.push(null);
  return celle;
}

function nomeMese(anno: number, mese: number) {
  const nome = MESI_LABEL[mese];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${anno}`;
}

function hrefRapportino(r: Rapportino) {
  const da = rapportinoEChiuso(r.stato) ? "archiviati" : "bozze";
  return `/tecnico/rapportini/${r.id}?da=${da}`;
}

export function TecnicoBacheca() {
  const lineeQuery = useLiveQuery(() => db.linee.toArray(), []);
  const rapportiniQuery = useLiveQuery(() => db.rapportini.toArray(), []);
  const campateQuery = useLiveQuery(() => db.campateLavoro.toArray(), []);
  const linee = useMemo(() => lineeQuery ?? [], [lineeQuery]);
  const rapportini = useMemo(() => rapportiniQuery ?? [], [rapportiniQuery]);
  const campate = useMemo(() => campateQuery ?? [], [campateQuery]);
  const oggi = todayIso();
  const adesso = new Date();
  const [vista, setVista] = useState({ anno: adesso.getFullYear(), mese: adesso.getMonth() });
  const [giornoScelto, setGiornoScelto] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<number | "tutte">("tutte");
  const [lineeAperte, setLineeAperte] = useState(false);

  const lineeById = useMemo(() => new Map(linee.map((l) => [l.id, l])), [linee]);

  const aperti = useMemo(() => {
    return rapportini
      .filter((r) => !rapportinoEChiuso(r.stato))
      .sort((a, b) => b.dataLavoro.localeCompare(a.dataLavoro) || b.createdAt.localeCompare(a.createdAt));
  }, [rapportini]);

  const annoPiano = useMemo(() => annoPianoPiuRecente(campate), [campate]);
  const delPiano = useMemo(
    () => soloCampateVisibili(campateDellAnno(campate, annoPiano)),
    [campate, annoPiano],
  );
  const nonTerminate = useMemo(() => {
    return delPiano
      .filter((c) => campataNonTerminata(c))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [delPiano]);
  const avanzamento = useMemo(() => avanzamentoPriorita(delPiano, "differibile"), [delPiano]);

  const perGiorno = useMemo(() => {
    const mappa = new Map<string, Rapportino[]>();
    for (const r of rapportini) {
      if (!r.dataLavoro) continue;
      const lista = mappa.get(r.dataLavoro) ?? [];
      lista.push(r);
      mappa.set(r.dataLavoro, lista);
    }
    for (const lista of mappa.values()) {
      lista.sort((a, b) => a.numero.localeCompare(b.numero, "it"));
    }
    return mappa;
  }, [rapportini]);

  const celle = useMemo(() => celleMese(vista.anno, vista.mese), [vista]);
  const delGiorno = giornoScelto ? (perGiorno.get(giornoScelto) ?? []) : [];

  const lineeCercate = useMemo(() => {
    const term = q.trim().toLowerCase();
    const lista = [...linee].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    return lista.filter((l) => {
      const kv = tensioneLinea(l) ?? 0;
      if (filtro !== "tutte" && kv !== filtro) return false;
      if (!term) return true;
      return l.codice.toLowerCase().includes(term) || l.nome.toLowerCase().includes(term);
    });
  }, [linee, q, filtro]);

  const conteggiTensione = useMemo(() => {
    const mappa = new Map<number, number>();
    for (const linea of linee) {
      const kv = tensioneLinea(linea) ?? 0;
      mappa.set(kv, (mappa.get(kv) ?? 0) + 1);
    }
    return mappa;
  }, [linee]);

  const mostraLinee = q.trim().length > 0 || filtro !== "tutte";
  const lineeVisibili = lineeAperte ? lineeCercate : lineeCercate.slice(0, MAX_RIGHE);

  function cambiaMese(delta: number) {
    setGiornoScelto(null);
    setVista((cur) => {
      const data = new Date(cur.anno, cur.mese + delta, 1);
      return { anno: data.getFullYear(), mese: data.getMonth() };
    });
  }

  function scegliTensione(kv: number) {
    setLineeAperte(false);
    setFiltro((cur) => (cur === kv ? "tutte" : kv));
  }

  return (
    <div className="bacheca">
      <div className="bacheca-col">
        <section className="panel bacheca-card">
          <header className="bacheca-head">
            <h2>In corso</h2>
            <span className="count">{aperti.length}</span>
            <Link href="/tecnico/fogli?s=bozze">Apri</Link>
          </header>
          {aperti.length === 0 ? (
            <p className="muted">Nessun rapportino aperto.</p>
          ) : (
            <ul className="bacheca-righe">
              {aperti.slice(0, MAX_RIGHE).map((r) => (
                <RigaRapportino key={r.id} rapportino={r} linea={lineeById.get(r.lineaId)} />
              ))}
            </ul>
          )}
          {aperti.length > MAX_RIGHE ? (
            <Link className="bacheca-altro" href="/tecnico/fogli?s=bozze">
              Altri {aperti.length - MAX_RIGHE}
            </Link>
          ) : null}
        </section>

        <section className="panel bacheca-card">
          <header className="bacheca-head">
            <h2>Calendario</h2>
            <div className="bacheca-mese">
              <button type="button" onClick={() => cambiaMese(-1)} aria-label="Mese precedente">
                ‹
              </button>
              <span>{nomeMese(vista.anno, vista.mese)}</span>
              <button type="button" onClick={() => cambiaMese(1)} aria-label="Mese successivo">
                ›
              </button>
            </div>
          </header>
          <div className="contab-cal bacheca-cal">
            {GIORNI.map((g) => (
              <span key={g} className="contab-cal-wd">
                {g}
              </span>
            ))}
            {celle.map((giorno, i) => {
              if (!giorno) return <span key={`v-${i}`} />;
              const iso = isoGiorno(vista.anno, vista.mese, giorno);
              const quanti = perGiorno.get(iso)?.length ?? 0;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`contab-cal-g${quanti ? " has" : ""}${iso === oggi ? " oggi" : ""}${iso === giornoScelto ? " on" : ""}`}
                  onClick={() => setGiornoScelto(iso === giornoScelto ? null : iso)}
                >
                  {giorno}
                  {quanti ? <small>{quanti}</small> : null}
                </button>
              );
            })}
          </div>
          {giornoScelto ? (
            delGiorno.length === 0 ? (
              <p className="muted">Nessun foglio il {formatDate(giornoScelto)}.</p>
            ) : (
              <ul className="bacheca-righe">
                {delGiorno.map((r) => (
                  <RigaRapportino key={r.id} rapportino={r} linea={lineeById.get(r.lineaId)} />
                ))}
              </ul>
            )
          ) : (
            <p className="muted">I giorni con un foglio sono segnati. Tocca un giorno per vederli.</p>
          )}
        </section>
      </div>

      <div className="bacheca-col">
        <section className="panel bacheca-card">
          <header className="bacheca-head">
            <h2>Non terminate</h2>
            <span className="count">{nonTerminate.length}</span>
            <Link href="/tecnico/campate">Apri</Link>
          </header>
          {nonTerminate.length === 0 ? (
            <p className="muted">Nessuna campata lasciata a metà.</p>
          ) : (
            <ul className="bacheca-righe">
              {nonTerminate.slice(0, MAX_RIGHE).map((c) => (
                <li key={c.id}>
                  <Link href="/tecnico/campate" className="bacheca-riga">
                    <span>
                      <strong>
                        {c.codiceLinea} · {mostraCampata(c.normalizzata)}
                      </strong>
                      <span className="muted">{c.nomeLinea}</span>
                    </span>
                    <span className="badge badge-non-terminata">Non terminata</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {nonTerminate.length > MAX_RIGHE ? (
            <Link className="bacheca-altro" href="/tecnico/campate">
              Altre {nonTerminate.length - MAX_RIGHE}
            </Link>
          ) : null}
        </section>

        <TortaAvanzamento dati={avanzamento} titolo="Avanzamento" />

        <section className="panel bacheca-card">
          <header className="bacheca-head">
            <h2>Linee</h2>
            <span className="count">{linee.length}</span>
          </header>
          <label>
            Cerca
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLineeAperte(false);
              }}
              placeholder="Codice o nome"
            />
          </label>
          <div className="chip-row">
            {TENSIONI.map((kv) => {
              const quante = conteggiTensione.get(kv) ?? 0;
              return (
                <button
                  key={kv}
                  type="button"
                  className={`chip ${filtro === kv ? "on" : ""}`}
                  disabled={quante === 0}
                  onClick={() => scegliTensione(kv)}
                >
                  {tensioneLabel(kv)} <span className="chip-count">{quante}</span>
                </button>
              );
            })}
          </div>
          {mostraLinee ? (
            lineeCercate.length === 0 ? (
              <p className="muted">Nessuna linea trovata.</p>
            ) : (
              <>
                <ul className="bacheca-righe">
                  {lineeVisibili.map((linea) => (
                    <li key={linea.id}>
                      <Link href={`/tecnico/per-linea?linea=${linea.id}`} className="bacheca-riga">
                        <span>
                          <strong>{linea.codice}</strong>
                          <span className="muted">{linea.nome}</span>
                        </span>
                        <span className="muted">{tensioneLabel(tensioneLinea(linea))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {lineeCercate.length > MAX_RIGHE && !lineeAperte ? (
                  <button type="button" className="mostra-altro" onClick={() => setLineeAperte(true)}>
                    Altre {lineeCercate.length - MAX_RIGHE}
                  </button>
                ) : null}
              </>
            )
          ) : (
            <p className="muted">Cerca per codice o nome, oppure scegli una tensione.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function RigaRapportino({ rapportino, linea }: { rapportino: Rapportino; linea?: Linea }) {
  return (
    <li>
      <Link href={hrefRapportino(rapportino)} className="bacheca-riga">
        <span>
          <strong>{linea ? `${linea.codice} · ${rapportino.numero}` : rapportino.numero}</strong>
          <span className="muted">
            {linea?.nome ? `${linea.nome} · ` : ""}
            {formatDate(rapportino.dataLavoro)}
          </span>
        </span>
        <span className={`badge badge-${rapportino.stato}`}>{statoLabel(rapportino.stato)}</span>
      </Link>
    </li>
  );
}
