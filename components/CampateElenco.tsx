"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate, formatDistInt, TENSIONI, tensioneLabel } from "@/lib/format";
import { aggiornaDettagliCampata } from "@/lib/campate/apply";
import { scaricaVistaCampate } from "@/lib/campate/export";
import { useSession } from "@/lib/SessionContext";
import { useSync } from "@/lib/SyncContext";
import { FiltroGruppo } from "./FiltroGruppo";
import { FiltroPeriodo, PERIODO_VUOTO, nelPeriodo } from "./FiltroPeriodo";
import {
  CAMPATA_ORIGINE_LABEL,
  CAMPATA_PRIORITA_LABEL,
  CAMPATA_STATO_LABEL,
  campataDaNonTagliare,
  campataETagliata,
  puoModificareSceltaCampata,
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
  const { session } = useSession();
  const { syncNow } = useSync();
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const storico = useLiveQuery(() => db.campateStorico.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [kv, setKv] = useState<number | "tutte">("tutte");
  const [priorita, setPriorita] = useState<PrioritaFiltro>("tutte");
  const [stato, setStato] = useState<StatoFiltro>("tutte");
  const [soloAttenzione, setSoloAttenzione] = useState(false);
  const [soloDaNonTagliare, setSoloDaNonTagliare] = useState(false);
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
    for (const c of campate) {
      if (c.tipo === "base") continue;
      map.set(c.codiceLinea, c.nomeLinea);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "it"));
  }, [campate]);

  const operatori = useMemo(() => {
    const set = new Set(campate.map((c) => c.operatore).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "it"));
  }, [campate]);

  const filtrate = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...campate]
      .filter((c) => c.tipo !== "base")
      .sort(
        (a, b) =>
          a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
          a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }) ||
          (a.priorita ?? "").localeCompare(b.priorita ?? ""),
      )
      .filter((c) => {
        if (kv !== "tutte" && (c.tensioneKv ?? 0) !== kv) return false;
        if (priorita !== "tutte" && c.priorita !== priorita) return false;
        if (stato === "da_tagliare" && campataETagliata(c)) return false;
        if (stato === "tagliata" && !campataETagliata(c)) return false;
        if (stato !== "tutte" && stato !== "da_tagliare" && stato !== "tagliata" && c.stato !== stato) {
          return false;
        }
        if (soloAttenzione && !c.attenzionare) return false;
        if (soloDaNonTagliare && !campataDaNonTagliare(c)) return false;
        if (origine !== "tutte" && c.origine !== origine) return false;
        if (linea && c.codiceLinea !== linea) return false;
        if (operatore && c.operatore !== operatore) return false;
        if (c.dataTaglio && !nelPeriodo(c.dataTaglio, periodo)) return false;
        if (periodo.da && !c.dataTaglio) return false;
        if (!term) return true;
        return [c.codiceLinea, c.nomeLinea, c.normalizzata, c.originale, c.operatore, c.note, c.distInt]
          .filter((v) => v != null && v !== "")
          .some((v) => String(v).toLowerCase().includes(term));
      });
  }, [campate, q, kv, priorita, stato, origine, linea, operatore, periodo, soloAttenzione, soloDaNonTagliare]);

  const mostrate = filtrate.slice(0, visibili);
  const restanti = filtrate.length - mostrate.length;

  const conteggi = useMemo(() => {
    const set = campate.filter((c) => c.tipo !== "base");
    return {
      totale: set.length,
      daTagliare: set.filter((c) => !campataETagliata(c)).length,
      tagliate: set.filter((c) => campataETagliata(c)).length,
      daNonTagliare: set.filter((c) => campataDaNonTagliare(c)).length,
      aggiuntive: set.filter((c) => c.origine === "aggiuntiva").length,
      attenzione: set.filter((c) => c.attenzionare).length,
    };
  }, [campate]);

  async function patchCampata(
    id: string,
    patch: { attenzionare?: boolean; note?: string; daNonTagliare?: boolean },
  ) {
    try {
      await aggiornaDettagliCampata(id, patch, session);
      void syncNow();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Modifica non consentita.");
      throw e;
    }
  }

  return (
    <>
      <div className="chip-row">
        <span className="muted">{conteggi.totale} campate</span>
        <span className="badge">{conteggi.daTagliare} da tagliare</span>
        <span className="badge badge-tagliata">{conteggi.tagliate} tagliate</span>
        <span className="badge badge-da_non_tagliare">{conteggi.daNonTagliare} da non tagliare</span>
        <span className="badge badge-aggiuntiva">{conteggi.aggiuntive} aggiuntive</span>
        <span className="badge badge-attenzionare">{conteggi.attenzione} da attenzionare</span>
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

      <div className="filtri-gruppi">
        <FiltroGruppo
          titolo={kv === "tutte" ? "Tutte le tensioni" : tensioneLabel(kv)}
          attivo={kv !== "tutte"}
        >
          <button type="button" className={`chip ${kv === "tutte" ? "on" : ""}`} onClick={() => setKv("tutte")}>
            Tutte
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
        </FiltroGruppo>

        <FiltroGruppo
          titolo={priorita === "tutte" ? "Tutte le priorità" : CAMPATA_PRIORITA_LABEL[priorita]}
          attivo={priorita !== "tutte"}
        >
          {(["tutte", "urgente", "differibile"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${priorita === p ? "on" : ""}`}
              onClick={() => setPriorita(p)}
            >
              {p === "tutte" ? "Tutte" : CAMPATA_PRIORITA_LABEL[p]}
            </button>
          ))}
        </FiltroGruppo>

        <FiltroGruppo
          titolo={stato === "tutte" ? "Tutti gli stati" : CAMPATA_STATO_LABEL[stato]}
          attivo={stato !== "tutte"}
        >
          {(["tutte", "da_tagliare", "tagliata"] as const).map((s) => (
            <button key={s} type="button" className={`chip ${stato === s ? "on" : ""}`} onClick={() => setStato(s)}>
              {s === "tutte" ? "Tutti" : CAMPATA_STATO_LABEL[s]}
            </button>
          ))}
        </FiltroGruppo>

        <FiltroGruppo
          titolo={soloAttenzione ? "Da attenzionare" : "Attenzione"}
          attivo={soloAttenzione}
        >
          <button
            type="button"
            className={`chip ${!soloAttenzione ? "on" : ""}`}
            onClick={() => setSoloAttenzione(false)}
          >
            Tutte
          </button>
          <button
            type="button"
            className={`chip ${soloAttenzione ? "on" : ""}`}
            onClick={() => setSoloAttenzione(true)}
          >
            Da attenzionare
          </button>
        </FiltroGruppo>

        <FiltroGruppo
          titolo={soloDaNonTagliare ? "Da non tagliare" : "Non tagliare"}
          attivo={soloDaNonTagliare}
        >
          <button
            type="button"
            className={`chip ${!soloDaNonTagliare ? "on" : ""}`}
            onClick={() => setSoloDaNonTagliare(false)}
          >
            Tutte
          </button>
          <button
            type="button"
            className={`chip ${soloDaNonTagliare ? "on" : ""}`}
            onClick={() => setSoloDaNonTagliare(true)}
          >
            Da non tagliare
          </button>
        </FiltroGruppo>

        <FiltroGruppo
          titolo={origine === "tutte" ? "Tutte le origini" : CAMPATA_ORIGINE_LABEL[origine]}
          attivo={origine !== "tutte"}
        >
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
        </FiltroGruppo>
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

      <div className="elenco-head">
        <span className="muted">
          {filtrate.length === campate.length
            ? `${filtrate.length} in tabella`
            : `${filtrate.length} di ${campate.length} visibili con i filtri`}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={filtrate.length === 0}
          onClick={() =>
            scaricaVistaCampate(filtrate, {
              linea: linea || undefined,
              stato,
              priorita,
              origine,
            })
          }
        >
          Scarica vista
        </button>
      </div>

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
                <th>Dist int</th>
                <th>Priorità</th>
                <th>Stato</th>
                <th>Data</th>
                <th>Operatore</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mostrate.map((c) => (
                <CampataRiga
                  key={c.id}
                  c={c}
                  ruolo={ruolo}
                  sessionUserId={session?.userId}
                  sessionRuolo={session?.ruolo}
                  storico={storicoPer.get(c.id) ?? []}
                  aperta={aperta === c.id}
                  onToggle={() => setAperta(aperta === c.id ? null : c.id)}
                  onPatch={(patch) => void patchCampata(c.id, patch)}
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

function hrefRapportino(ruolo: "tecnico" | "operatore", c: CampataLavoro) {
  if (c.rapportinoId) {
    return ruolo === "tecnico" ? `/tecnico/rapportini/${c.rapportinoId}` : `/operatore/${c.rapportinoId}`;
  }
  return hrefNuovoRapportino(ruolo, c);
}

function hrefNuovoRapportino(ruolo: "tecnico" | "operatore", c: CampataLavoro) {
  const q = `linea=${encodeURIComponent(c.lineaId)}&campata=${encodeURIComponent(c.id)}`;
  return ruolo === "tecnico" ? `/tecnico/nuovo?${q}` : `/operatore/nuovo?${q}`;
}

function eventoDaRapportino(evento: string) {
  return (
    evento === "tagliata" ||
    evento.startsWith("tagliata") ||
    evento === "aggiuntiva_da_rapportino" ||
    evento === "ripristinata_da_cancellazione"
  );
}

function eEventoAttenzione(evento: string) {
  return evento === "attenzionare" || evento === "attenzionare_off";
}

function collassaLog(storico: CampataStorico[]) {
  const crono = [...storico].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const out: CampataStorico[] = [];
  for (const s of crono) {
    const prev = out[out.length - 1];
    if (
      eEventoAttenzione(s.evento) &&
      prev &&
      eEventoAttenzione(prev.evento) &&
      (prev.operatore || "") === (s.operatore || "")
    ) {
      out[out.length - 1] = s;
      continue;
    }
    out.push(s);
  }
  return out.reverse();
}

function etichettaEvento(evento: string) {
  if (evento === "da_non_tagliare" || evento === "nulla_da_tagliare" || evento === "tralasciata") {
    return "Da non tagliare";
  }
  if (evento === "da_non_tagliare_off") return "Tolto da non tagliare";
  if (evento === "attenzionare") return "Da attenzionare";
  if (evento === "attenzionare_off") return "Tolto da attenzionare";
  if (evento === "nota") return "Nota";
  if (eventoDaRapportino(evento)) return "Tagliata";
  return null;
}

function CampataRiga({
  c,
  ruolo,
  sessionUserId,
  sessionRuolo,
  storico,
  aperta,
  onToggle,
  onPatch,
}: {
  c: CampataLavoro;
  ruolo: "tecnico" | "operatore";
  sessionUserId?: string;
  sessionRuolo?: "tecnico" | "operatore";
  storico: CampataStorico[];
  aperta: boolean;
  onToggle: () => void;
  onPatch: (patch: { attenzionare?: boolean; note?: string; daNonTagliare?: boolean }) => Promise<void> | void;
}) {
  const [nota, setNota] = useState("");
  const [attenzione, setAttenzione] = useState(Boolean(c.attenzionare));
  const attenzioneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = sessionUserId
    ? { userId: sessionUserId, ruolo: sessionRuolo ?? ruolo, nome: "", email: "" }
    : null;
  const nonTagliare = campataDaNonTagliare(c);
  const tagliata = campataETagliata(c);
  const lockNonTagliare = nonTagliare && !puoModificareSceltaCampata(session, c.daNonTagliareBy);
  const lockAttenzione = Boolean(c.attenzionare) && !puoModificareSceltaCampata(session, c.attenzionareBy);
  const daRapportino = Boolean(c.rapportinoId) && !nonTagliare;
  const mostraRapportino = Boolean(c.rapportinoId) || !nonTagliare;

  useEffect(() => {
    setNota("");
  }, [c.id]);

  useEffect(() => {
    setAttenzione(Boolean(c.attenzionare));
  }, [c.id, c.attenzionare]);

  useEffect(
    () => () => {
      if (attenzioneTimer.current) clearTimeout(attenzioneTimer.current);
    },
    [],
  );

  function cambiaAttenzione(valore: boolean) {
    setAttenzione(valore);
    if (attenzioneTimer.current) clearTimeout(attenzioneTimer.current);
    attenzioneTimer.current = setTimeout(() => {
      void Promise.resolve(onPatch({ attenzionare: valore })).catch(() => {
        setAttenzione(!valore);
      });
    }, 500);
  }

  async function salvaNota() {
    const testo = nota.trim();
    if (!testo) return;
    setNota("");
    try {
      await onPatch({ note: testo });
    } catch {
      setNota(testo);
    }
  }

  const logUtile = collassaLog(
    storico.filter((s) => {
      const label = etichettaEvento(s.evento);
      if (!label) return false;
      if (eventoDaRapportino(s.evento)) return Boolean(s.rapportinoId);
      return true;
    }),
  );

  return (
    <>
      <tr
        className={`campata-row campata-${tagliata ? "tagliata" : c.stato}${c.attenzionare ? " campata-attenzionare" : ""}`}
        onClick={onToggle}
      >
        <td className="linea-codice">{c.codiceLinea}</td>
        <td>{c.nomeLinea}</td>
        <td>{c.tensioneKv ?? "—"}</td>
        <td>
          <strong>{c.normalizzata}</strong>
          {c.origine === "aggiuntiva" ? <span className="badge badge-aggiuntiva">Aggiuntiva</span> : null}
        </td>
        <td>{c.distInt != null ? formatDistInt(c.distInt) : "—"}</td>
        <td>
          {c.priorita ? (
            <span className={`badge badge-${c.priorita}`}>{CAMPATA_PRIORITA_LABEL[c.priorita]}</span>
          ) : (
            "—"
          )}
        </td>
        <td>
          <span className={`badge badge-${tagliata ? "tagliata" : c.stato}`}>
            {tagliata ? CAMPATA_STATO_LABEL.tagliata : CAMPATA_STATO_LABEL[c.stato]}
          </span>
          {nonTagliare ? <span className="badge badge-da_non_tagliare">Da non tagliare</span> : null}
        </td>
        <td>{c.dataTaglio ? formatDate(c.dataTaglio) : "—"}</td>
        <td>{c.operatore ?? "—"}</td>
        <td>
          {c.note?.trim() ? <span className="campata-note-preview">{c.note.trim()}</span> : "—"}
        </td>
        <td className="campata-rap-cell">
          {mostraRapportino ? (
            c.rapportinoId ? (
              <span className="campata-rap-btns">
                <Link
                  href={hrefRapportino(ruolo, c)}
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => e.stopPropagation()}
                >
                  Apri
                </Link>
                {!nonTagliare ? (
                  <Link
                    href={hrefNuovoRapportino(ruolo, c)}
                    className="btn btn-sm btn-ghost"
                    title="Altra giornata sulla stessa campata"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Altro foglio
                  </Link>
                ) : null}
              </span>
            ) : (
              <Link
                href={hrefRapportino(ruolo, c)}
                className="btn btn-sm btn-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                Rapportino
              </Link>
            )
          ) : null}
        </td>
      </tr>
      {aperta ? (
        <tr className="campata-storico">
          <td colSpan={11}>
            <div className="campata-esploso" onClick={(e) => e.stopPropagation()}>
              {!daRapportino ? (
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={nonTagliare}
                    disabled={lockNonTagliare || !sessionUserId}
                    onChange={(e) => onPatch({ daNonTagliare: e.target.checked })}
                  />
                  Da non tagliare
                  {lockNonTagliare ? (
                    <span className="muted"> — già segnato, non modificabile</span>
                  ) : null}
                </label>
              ) : (
                <p className="muted">Tagliata con rapportino.</p>
              )}
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={attenzione}
                  disabled={lockAttenzione || !sessionUserId}
                  onChange={(e) => cambiaAttenzione(e.target.checked)}
                />
                Da attenzionare
                {lockAttenzione ? (
                  <span className="muted"> — già segnato, non modificabile</span>
                ) : null}
              </label>
              {c.note?.trim() ? (
                <div className="campata-note-blocco">
                  <span className="muted">Note già inserite — non si cancellano, si possono solo aggiungere</span>
                  <p>{c.note.trim()}</p>
                </div>
              ) : null}
              <label>
                Aggiungi una nota
                <textarea
                  rows={3}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onBlur={() => void salvaNota()}
                  placeholder="La nota si aggiunge a quelle già presenti"
                />
              </label>
              {logUtile.length > 0 ? (
                <ul className="storico-list">
                  {logUtile.map((s) => (
                    <li key={s.id}>
                      <strong>{etichettaEvento(s.evento)}</strong>
                      {s.operatore ? ` · ${s.operatore}` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                      <span className="muted"> · {new Date(s.createdAt).toLocaleString("it-IT")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nessun log su questa campata.</p>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
