"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate, formatDistInt, TENSIONI, tensioneLabel } from "@/lib/format";
import { aggiornaDettagliCampata, type PatchRinvio } from "@/lib/campate/apply";
import { scaricaVistaCampate } from "@/lib/campate/export";
import { annoDi, annoPianoPiuRecente, anniPiani, anniTaglioPrecedenti, etichettaAnniTaglio } from "@/lib/campate/anno";
import { chiaveCampata } from "@/lib/campate/normalize";
import { readElencoVista, writeElencoVista, type OrdineElenco, type RipresaFiltro } from "@/lib/campate/elencoVista";
import { useSession } from "@/lib/SessionContext";
import { useSync } from "@/lib/SyncContext";
import { FiltroGruppo } from "./FiltroGruppo";
import { FiltroPeriodo, PERIODO_VUOTO, nelPeriodo, type Periodo } from "./FiltroPeriodo";
import { PopupRinvio } from "./PopupRinvio";
import { LinkMaps } from "./LinkMaps";
import {
  CAMPATA_ORIGINE_LABEL,
  CAMPATA_PRIORITA_LABEL,
  CAMPATA_STATO_LABEL,
  MESI_LABEL,
  campataDaNonTagliare,
  campataDaRiprendere,
  campataETagliata,
  etichettaRinvio,
  puoModificareSceltaCampata,
  rinvioRipreso,
  type CampataLavoro,
  type CampataOrigine,
  type CampataPriorita,
  type CampataStatoLavoro,
  type CampataStorico,
} from "@/lib/types";

type OrigineFiltro = CampataOrigine | "tutte";
type PrioritaFiltro = CampataPriorita | "tutte";
type StatoFiltro = CampataStatoLavoro | "tutte";
type ModoElenco = "piano" | "rinvii";

/** Una riga per span+priorità: se lo stesso promemoria è su due anni, resta quello aperto più recente. */
function rinviiSenzaDoppioni(lista: CampataLavoro[]) {
  const scelte = new Map<string, CampataLavoro>();
  for (const c of lista) {
    if (!campataDaRiprendere(c)) continue;
    const chiave = chiaveCampata(c.codiceLinea, c.normalizzata, c.priorita);
    const gia = scelte.get(chiave);
    if (!gia) {
      scelte.set(chiave, c);
      continue;
    }
    const aperto = !rinvioRipreso(c);
    const giaAperto = !rinvioRipreso(gia);
    if (aperto !== giaAperto) {
      if (aperto) scelte.set(chiave, c);
      continue;
    }
    if (annoDi(c) > annoDi(gia)) scelte.set(chiave, c);
  }
  return [...scelte.values()];
}

const ORDINE_LABEL: Record<OrdineElenco, string> = {
  linea: "Linea",
  dist_asc: "Distanza crescente",
  dist_desc: "Distanza decrescente",
};

function confrontaLinea(a: CampataLavoro, b: CampataLavoro) {
  return (
    a.codiceLinea.localeCompare(b.codiceLinea, "it") ||
    a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }) ||
    (a.priorita ?? "").localeCompare(b.priorita ?? "")
  );
}

function confrontaElenco(a: CampataLavoro, b: CampataLavoro, ordine: OrdineElenco) {
  if (ordine === "linea") return confrontaLinea(a, b);
  const da = a.distInt;
  const db = b.distInt;
  if (da == null && db == null) return confrontaLinea(a, b);
  if (da == null) return 1;
  if (db == null) return -1;
  const delta = ordine === "dist_asc" ? da - db : db - da;
  return delta || confrontaLinea(a, b);
}

export type PatchCampata = {
  attenzionare?: boolean;
  note?: string;
  daNonTagliare?: boolean;
  rinvio?: PatchRinvio | null;
  rinvioFatta?: boolean;
};

function passaFiltriVista(
  c: CampataLavoro,
  p: {
    term: string;
    kv: number | "tutte";
    stato: StatoFiltro;
    linea: string;
    operatore: string;
    periodo: Periodo;
  },
) {
  if (p.kv !== "tutte" && (c.tensioneKv ?? 0) !== p.kv) return false;
  if (p.stato === "da_tagliare" && campataETagliata(c)) return false;
  if (p.stato === "tagliata" && !campataETagliata(c)) return false;
  if (p.stato !== "tutte" && p.stato !== "da_tagliare" && p.stato !== "tagliata" && c.stato !== p.stato) {
    return false;
  }
  if (p.linea && c.codiceLinea !== p.linea) return false;
  if (p.operatore && c.operatore !== p.operatore) return false;
  if (c.dataTaglio && !nelPeriodo(c.dataTaglio, p.periodo)) return false;
  if (p.periodo.da && !c.dataTaglio) return false;
  if (!p.term) return true;
  return [c.codiceLinea, c.nomeLinea, c.normalizzata, c.originale, c.operatore, c.note, c.distInt]
    .filter((v) => v != null && v !== "")
    .some((v) => String(v).toLowerCase().includes(p.term));
}

export function CampateElenco({
  ruolo,
  modo = "piano",
}: {
  ruolo: "tecnico" | "operatore";
  modo?: ModoElenco;
}) {
  const { session } = useSession();
  const { syncNow } = useSync();
  const soloRinvii = modo === "rinvii";
  const chiaveVista = soloRinvii ? `${ruolo}.rinvii` : ruolo;
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const storico = useLiveQuery(() => db.campateStorico.toArray(), []) ?? [];
  const vistaSalvata = useMemo(
    () => readElencoVista(session?.userId, chiaveVista),
    [session?.userId, chiaveVista],
  );
  const [q, setQ] = useState(vistaSalvata?.q ?? "");
  const [kv, setKv] = useState<number | "tutte">(vistaSalvata?.kv ?? "tutte");
  const [priorita, setPriorita] = useState<PrioritaFiltro>(vistaSalvata?.priorita ?? "tutte");
  const [stato, setStato] = useState<StatoFiltro>(vistaSalvata?.stato ?? "tutte");
  const [soloAttenzione, setSoloAttenzione] = useState(vistaSalvata?.soloAttenzione ?? false);
  const [soloDaNonTagliare, setSoloDaNonTagliare] = useState(vistaSalvata?.soloDaNonTagliare ?? false);
  const [origine, setOrigine] = useState<OrigineFiltro>(vistaSalvata?.origine ?? "tutte");
  const [linea, setLinea] = useState(vistaSalvata?.linea ?? "");
  const [operatore, setOperatore] = useState(vistaSalvata?.operatore ?? "");
  const [periodo, setPeriodo] = useState(vistaSalvata?.periodo ?? PERIODO_VUOTO);
  const [aperta, setAperta] = useState<string | null>(null);
  const [visibili, setVisibili] = useState(vistaSalvata?.visibili ?? 40);
  const [meseRinvio, setMeseRinvio] = useState<number | "tutti">(vistaSalvata?.meseRinvio ?? "tutti");
  const [ripresa, setRipresa] = useState<RipresaFiltro>(vistaSalvata?.ripresa ?? "tutte");
  const [ordine, setOrdine] = useState<OrdineElenco>(vistaSalvata?.ordine ?? "linea");
  const [popup, setPopup] = useState<string | null>(null);
  // In «Da riprendere» l'universo è solo il promemoria: gli anni dei chip sono quelli che ne hanno.
  const universo = useMemo(
    () => (soloRinvii ? rinviiSenzaDoppioni(campate) : campate),
    [campate, soloRinvii],
  );
  const anni = useMemo(() => anniPiani(universo), [universo]);
  const [anno, setAnno] = useState<number | null>(vistaSalvata?.anno ?? null);
  // In «Da riprendere» null = tutti gli anni (il promemoria non è di un solo piano).
  const annoEffettivo = soloRinvii
    ? anno != null && anni.includes(anno)
      ? anno
      : null
    : anno != null && anni.includes(anno)
      ? anno
      : (anni[0] ?? annoPianoPiuRecente(campate));
  const annoRiferimento = annoEffettivo ?? annoPianoPiuRecente(campate);
  const delPiano = useMemo(
    () => (annoEffettivo == null ? universo : universo.filter((c) => annoDi(c) === annoEffettivo)),
    [universo, annoEffettivo],
  );

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
    for (const c of delPiano) {
      map.set(c.codiceLinea, c.nomeLinea);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "it"));
  }, [delPiano]);

  const operatori = useMemo(() => {
    const set = new Set(delPiano.map((c) => c.operatore).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "it"));
  }, [delPiano]);

  const filtrate = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...delPiano]
      .filter((c) => c.tipo !== "base")
      .sort((a, b) => confrontaElenco(a, b, ordine))
      .filter((c) => passaFiltriVista(c, { term, kv, stato, linea, operatore, periodo }))
      .filter((c) => {
        if (priorita !== "tutte" && c.priorita !== priorita) return false;
        if (soloAttenzione && !c.attenzionare) return false;
        if (soloDaNonTagliare && !campataDaNonTagliare(c)) return false;
        if (origine !== "tutte" && c.origine !== origine) return false;
        if (soloRinvii) {
          if (meseRinvio !== "tutti" && c.rinvioMese !== meseRinvio) return false;
          if (ripresa === "da_fare" && rinvioRipreso(c)) return false;
          if (ripresa === "fatte" && !rinvioRipreso(c)) return false;
        }
        return true;
      });
  }, [
    delPiano,
    q,
    kv,
    priorita,
    stato,
    origine,
    linea,
    operatore,
    periodo,
    soloAttenzione,
    soloDaNonTagliare,
    soloRinvii,
    meseRinvio,
    ripresa,
    ordine,
  ]);

  const basiVista = useMemo(() => {
    const term = q.trim().toLowerCase();
    return delPiano
      .filter((c) => c.tipo === "base")
      .filter((c) => passaFiltriVista(c, { term, kv, stato, linea, operatore, periodo }));
  }, [delPiano, q, kv, stato, linea, operatore, periodo]);

  const daScaricare = useMemo(() => [...filtrate, ...basiVista], [filtrate, basiVista]);

  const nCampatePiano = delPiano.filter((c) => c.tipo !== "base").length;
  const mostrate = filtrate.slice(0, visibili);
  const restanti = filtrate.length - mostrate.length;

  const conteggi = useMemo(() => {
    const set = delPiano.filter((c) => c.tipo !== "base");
    return {
      totale: set.length,
      daTagliare: set.filter((c) => !campataETagliata(c)).length,
      tagliate: set.filter((c) => campataETagliata(c)).length,
      daNonTagliare: set.filter((c) => campataDaNonTagliare(c)).length,
      aggiuntive: set.filter((c) => c.origine === "aggiuntiva").length,
      attenzione: set.filter((c) => c.attenzionare).length,
      daRiprendere: set.filter((c) => campataDaRiprendere(c)).length,
      riprese: set.filter((c) => rinvioRipreso(c)).length,
    };
  }, [delPiano]);

  const mesiConRinvio = useMemo(() => {
    const set = new Set(delPiano.map((c) => c.rinvioMese).filter((m): m is number => m != null));
    return [...set].sort((a, b) => a - b);
  }, [delPiano]);

  const campataPopup = popup ? campate.find((c) => c.id === popup) : undefined;

  useEffect(() => {
    if (!session?.userId) return;
    writeElencoVista(session.userId, chiaveVista, {
      q,
      kv,
      priorita,
      stato,
      soloAttenzione,
      soloDaNonTagliare,
      origine,
      linea,
      operatore,
      periodo,
      anno: annoEffettivo,
      visibili,
      meseRinvio,
      ripresa,
      ordine,
    });
  }, [
    session?.userId,
    chiaveVista,
    q,
    kv,
    priorita,
    stato,
    soloAttenzione,
    soloDaNonTagliare,
    origine,
    linea,
    operatore,
    periodo,
    annoEffettivo,
    visibili,
    meseRinvio,
    ripresa,
    ordine,
  ]);

  useEffect(() => {
    if (delPiano.length === 0) return;
    if (linea && !lineeOpzioni.some(([cod]) => cod === linea)) setLinea("");
    if (operatore && !operatori.includes(operatore)) setOperatore("");
  }, [delPiano.length, linea, lineeOpzioni, operatore, operatori]);

  /** Il popup mostra l’errore dentro la scheda: qui non serve l’alert. */
  async function scriviCampata(id: string, patch: PatchCampata) {
    await aggiornaDettagliCampata(id, patch, session);
    void syncNow();
  }

  async function patchCampata(id: string, patch: PatchCampata) {
    try {
      await scriviCampata(id, patch);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Modifica non consentita.");
      throw e;
    }
  }

  return (
    <>
      <div className="chip-row">
        {soloRinvii ? (
          <>
            <span className="muted">
              {conteggi.daRiprendere} da riprendere
              {annoEffettivo == null ? " · tutti gli anni" : ` · piano ${annoEffettivo}`}
            </span>
            <span className="badge">{conteggi.daRiprendere - conteggi.riprese} da fare</span>
            <span className="badge badge-tagliata">{conteggi.riprese} riprese</span>
            <span className="badge badge-urgente">
              {delPiano.filter((c) => c.priorita === "urgente" && !campataETagliata(c)).length} ancora urgenti
            </span>
          </>
        ) : (
          <>
            <span className="muted">{conteggi.totale} campate · piano {annoEffettivo}</span>
            <span className="badge">{conteggi.daTagliare} da tagliare</span>
            <span className="badge badge-tagliata">{conteggi.tagliate} tagliate</span>
            <span className="badge badge-da_non_tagliare">{conteggi.daNonTagliare} da non tagliare</span>
            <span className="badge badge-aggiuntiva">{conteggi.aggiuntive} aggiuntive</span>
            <span className="badge badge-attenzionare">{conteggi.attenzione} da attenzionare</span>
            <span className="badge badge-rinvio">{conteggi.daRiprendere} da riprendere</span>
          </>
        )}
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
        {anni.length > 0 ? (
          <FiltroGruppo
            titolo={annoEffettivo == null ? "Tutti gli anni" : `Anno ${annoEffettivo}`}
            attivo={soloRinvii ? annoEffettivo != null : anni.length > 1}
          >
            {soloRinvii ? (
              <button
                type="button"
                className={`chip ${annoEffettivo == null ? "on" : ""}`}
                onClick={() => {
                  setAnno(null);
                  setVisibili(40);
                }}
              >
                Tutti
              </button>
            ) : null}
            {anni.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${annoEffettivo === a ? "on" : ""}`}
                onClick={() => {
                  setAnno(a);
                  setVisibili(40);
                }}
              >
                {a}
              </button>
            ))}
          </FiltroGruppo>
        ) : null}

        <FiltroGruppo titolo={ORDINE_LABEL[ordine]} attivo={ordine !== "linea"}>
          {(["linea", "dist_asc", "dist_desc"] as const).map((o) => (
            <button
              key={o}
              type="button"
              className={`chip ${ordine === o ? "on" : ""}`}
              onClick={() => {
                setOrdine(o);
                setVisibili(40);
              }}
            >
              {ORDINE_LABEL[o]}
            </button>
          ))}
        </FiltroGruppo>

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

        {soloRinvii ? (
          <>
            <FiltroGruppo
              titolo={meseRinvio === "tutti" ? "Tutti i mesi" : MESI_LABEL[meseRinvio - 1]}
              attivo={meseRinvio !== "tutti"}
            >
              <button
                type="button"
                className={`chip ${meseRinvio === "tutti" ? "on" : ""}`}
                onClick={() => setMeseRinvio("tutti")}
              >
                Tutti
              </button>
              {mesiConRinvio.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${meseRinvio === m ? "on" : ""}`}
                  onClick={() => setMeseRinvio(meseRinvio === m ? "tutti" : m)}
                >
                  {MESI_LABEL[m - 1]}
                </button>
              ))}
            </FiltroGruppo>

            <FiltroGruppo
              titolo={ripresa === "tutte" ? "Da fare e riprese" : ripresa === "da_fare" ? "Da fare" : "Riprese"}
              attivo={ripresa !== "tutte"}
            >
              {(["tutte", "da_fare", "fatte"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`chip ${ripresa === r ? "on" : ""}`}
                  onClick={() => setRipresa(r)}
                >
                  {r === "tutte" ? "Tutte" : r === "da_fare" ? "Da fare" : "Riprese"}
                </button>
              ))}
            </FiltroGruppo>
          </>
        ) : null}
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
          {filtrate.length === nCampatePiano
            ? `${filtrate.length} in tabella`
            : `${filtrate.length} di ${nCampatePiano} visibili con i filtri`}
          {!soloRinvii && ruolo === "tecnico" && basiVista.length > 0
            ? ` · ${basiVista.length} ${basiVista.length === 1 ? "base" : "basi"} nel file`
            : ""}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={(ruolo === "tecnico" && !soloRinvii ? daScaricare : filtrate).length === 0}
          onClick={() =>
            void scaricaVistaCampate(ruolo === "tecnico" && !soloRinvii ? daScaricare : filtrate, {
              linea: linea || undefined,
              stato,
              priorita,
              origine,
              anno: annoEffettivo ?? undefined,
              prefisso: soloRinvii ? "da-riprendere" : undefined,
              rinvio: soloRinvii,
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
        <p className="muted">
          {soloRinvii && conteggi.daRiprendere === 0
            ? "Nessuna campata da riprendere. Il promemoria si mette dall’elenco campate, spuntando «Da riprendere» sulla riga."
            : "Nessuna campata corrisponde ai filtri."}
        </p>
      ) : (
        <div className="campate-table-wrap">
          <table className="campate-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Nome linea</th>
                <th>kV</th>
                <th>Campata</th>
                <th>
                  <button
                    type="button"
                    className="th-sort"
                    onClick={() => {
                      setOrdine((o) =>
                        o === "linea" ? "dist_asc" : o === "dist_asc" ? "dist_desc" : "linea",
                      );
                      setVisibili(40);
                    }}
                  >
                    Dist int
                    {ordine === "dist_asc" ? " ↑" : ordine === "dist_desc" ? " ↓" : ""}
                  </button>
                </th>
                <th>Maps</th>
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
                  soloRinvii={soloRinvii}
                  sessionUserId={session?.userId}
                  sessionRuolo={session?.ruolo}
                  storico={storicoPer.get(c.id) ?? []}
                  anniPrecedenti={anniTaglioPrecedenti(campate, c.codiceLinea, c.normalizzata, annoRiferimento)}
                  aperta={aperta === c.id}
                  onToggle={() => setAperta(aperta === c.id ? null : c.id)}
                  onPatch={(patch) => void patchCampata(c.id, patch)}
                  onApriPopup={() => setPopup(c.id)}
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

      {campataPopup ? (
        <PopupRinvio
          campata={campataPopup}
          puoTogliere={soloRinvii}
          onSalva={(patch) => scriviCampata(campataPopup.id, { rinvio: patch })}
          onTogli={() => scriviCampata(campataPopup.id, { rinvio: null })}
          onChiudi={() => setPopup(null)}
        />
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
  if (evento === "da_riprendere") return "Da riprendere";
  if (evento === "da_riprendere_off") return "Tolto da riprendere";
  if (evento === "ripresa_fatta") return "Ripresa fatta";
  if (evento === "ripresa_fatta_off") return "Ripresa da fare";
  if (evento === "nota") return "Nota";
  if (eventoDaRapportino(evento)) return "Tagliata";
  return null;
}

function CampataRiga({
  c,
  ruolo,
  soloRinvii,
  sessionUserId,
  sessionRuolo,
  storico,
  anniPrecedenti,
  aperta,
  onToggle,
  onPatch,
  onApriPopup,
}: {
  c: CampataLavoro;
  ruolo: "tecnico" | "operatore";
  soloRinvii: boolean;
  sessionUserId?: string;
  sessionRuolo?: "tecnico" | "operatore";
  storico: CampataStorico[];
  anniPrecedenti: number[];
  aperta: boolean;
  onToggle: () => void;
  onPatch: (patch: PatchCampata) => Promise<void> | void;
  onApriPopup: () => void;
}) {
  const [nota, setNota] = useState("");
  const [attenzione, setAttenzione] = useState(Boolean(c.attenzionare));
  const attenzioneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = sessionUserId
    ? { userId: sessionUserId, ruolo: sessionRuolo ?? ruolo, nome: "", email: "" }
    : null;
  const nonTagliare = campataDaNonTagliare(c);
  const tagliata = campataETagliata(c);
  const daRiprendere = campataDaRiprendere(c);
  const ripresa = rinvioRipreso(c);
  const lockNonTagliare = nonTagliare && !puoModificareSceltaCampata(session, c.daNonTagliareBy);
  const lockRinvio = daRiprendere && !puoModificareSceltaCampata(session, c.rinvioBy);
  const lockAttenzione = Boolean(c.attenzionare) && !puoModificareSceltaCampata(session, c.attenzionareBy);
  const daRapportino = Boolean(c.rapportinoId) && !nonTagliare;
  const mostraRapportino = Boolean(c.rapportinoId) || !nonTagliare;
  const tecnico = (sessionRuolo ?? ruolo) === "tecnico";

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
        className={`campata-row campata-${tagliata ? "tagliata" : c.stato}${c.attenzionare ? " campata-attenzionare" : ""}${ripresa ? " campata-ripresa" : ""}`}
        onClick={onToggle}
      >
        <td className="linea-codice">{c.codiceLinea}</td>
        <td>{c.nomeLinea}</td>
        <td>{c.tensioneKv ?? "—"}</td>
        <td>
          <strong>{c.normalizzata}</strong>
          {c.origine === "aggiuntiva" ? <span className="badge badge-aggiuntiva">Aggiuntiva</span> : null}
          {anniPrecedenti.length > 0 ? (
            <span className="badge badge-anni-scorsi" title={etichettaAnniTaglio(anniPrecedenti)}>
              {etichettaAnniTaglio(anniPrecedenti)}
            </span>
          ) : null}
        </td>
        <td>{c.distInt != null ? formatDistInt(c.distInt) : "—"}</td>
        <td className="campata-maps">
          <LinkMaps estInt={c.estInt} nordInt={c.nordInt} nomeLinea={c.nomeLinea} />
        </td>
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
          {daRiprendere ? (
            <span className={`badge ${ripresa ? "badge-tagliata" : "badge-rinvio"}`}>
              {ripresa ? `Ripresa · ${etichettaRinvio(c)}` : `Da riprendere · ${etichettaRinvio(c)}`}
            </span>
          ) : null}
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
          <td colSpan={12}>
            <div className="campata-esploso" onClick={(e) => e.stopPropagation()}>
              {daRiprendere ? (
                <p className="muted">
                  È in «Da riprendere» ({etichettaRinvio(c)}): «da non tagliare» non si può mettere.
                  Chiudi il promemoria da quell’elenco oppure fai il rapportino.
                </p>
              ) : !daRapportino ? (
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
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={daRiprendere}
                  disabled={
                    !sessionUserId ||
                    lockRinvio ||
                    (!daRiprendere && nonTagliare) ||
                    (daRiprendere && !soloRinvii)
                  }
                  onChange={() => onApriPopup()}
                />
                Da riprendere
                {daRiprendere ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={lockRinvio || !sessionUserId}
                      onClick={onApriPopup}
                    >
                      {soloRinvii ? "Cambia o togli" : "Cambia mese"}
                    </button>
                    {!soloRinvii ? (
                      <span className="muted"> — si toglie dall’elenco «Da riprendere»</span>
                    ) : null}
                  </>
                ) : nonTagliare ? (
                  <span className="muted"> — prima togli «da non tagliare»</span>
                ) : null}
                {lockRinvio ? <span className="muted"> — segnato da un altro operatore</span> : null}
              </label>
              {daRiprendere ? (
                <>
                  {c.rinvioNote?.trim() ? (
                    <div className="campata-note-blocco">
                      <span className="muted">Nota del promemoria</span>
                      <p>{c.rinvioNote.trim()}</p>
                    </div>
                  ) : null}
                  {soloRinvii && tecnico ? (
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={ripresa}
                        disabled={!sessionUserId}
                        onChange={(e) => onPatch({ rinvioFatta: e.target.checked })}
                      />
                      Tagliata
                      <span className="muted">
                        {" "}
                        — chiude il promemoria e resta in elenco; la torta la muove solo il rapportino
                      </span>
                    </label>
                  ) : null}
                </>
              ) : null}
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
