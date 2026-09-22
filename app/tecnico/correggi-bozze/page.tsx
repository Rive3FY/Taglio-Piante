"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { useSync } from "@/lib/SyncContext";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import type { Rapportino } from "@/lib/types";

/**
 * Pagina temporanea: corregge in blocco Dipendente TERNA, Sig. e N° operatori
 * sulle bozze. Si tocca solo ciò che viene compilato; il resto del foglio resta.
 */
export default function CorreggiBozzePage() {
  const { syncNow } = useSync();
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []);
  const linee = useLiveQuery(() => db.linee.toArray(), []);
  const operatori = useLiveQuery(() => db.operatori.orderBy("nome").toArray(), []);

  const bozze = useMemo(
    () =>
      (rapportini ?? [])
        .filter((r) => r.stato === "bozza" || r.stato === "da_prendere")
        .sort((a, b) => (b.dataLavoro ?? "").localeCompare(a.dataLavoro ?? "")),
    [rapportini],
  );
  const lineaDi = useMemo(() => new Map((linee ?? []).map((l) => [l.id, l])), [linee]);

  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");
  const [dipendente, setDipendente] = useState("");
  const [sig, setSig] = useState("");
  const [nOperatori, setNOperatori] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const visibili = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return bozze;
    return bozze.filter((r) => {
      const l = lineaDi.get(r.lineaId);
      return [r.numero, r.campata, r.dipendenteTerna, r.rappresentanteDitta, r.presoDa, l?.codice, l?.nome]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [bozze, filtro, lineaDi]);

  const tuttiVisibiliScelti = visibili.length > 0 && visibili.every((r) => scelti.has(r.id));

  function alterna(id: string) {
    setScelti((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternaTutti() {
    setScelti((cur) => {
      const next = new Set(cur);
      for (const r of visibili) {
        if (tuttiVisibiliScelti) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  async function applica() {
    const n = nOperatori === "" ? null : Number(nOperatori);
    const nome = sig.trim();
    if (scelti.size === 0) {
      setErrore("Seleziona almeno una bozza.");
      return;
    }
    if (!dipendente && !nome && n == null) {
      setErrore("Compila almeno un campo da cambiare.");
      return;
    }
    if (n != null && (!Number.isFinite(n) || n < 1)) {
      setErrore("Il numero operatori deve essere almeno 1.");
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      const firma = dipendente ? operatori?.find((o) => o.nome === dipendente)?.firma : undefined;
      const now = new Date().toISOString();
      let fatti = 0;
      for (const id of scelti) {
        const r = await db.rapportini.get(id);
        if (!r || (r.stato !== "bozza" && r.stato !== "da_prendere")) continue;
        const patch: Partial<Rapportino> = { updatedAt: now, syncStatus: "pending" };
        if (dipendente) {
          patch.dipendenteTerna = dipendente;
          patch.firmaTerna = firma;
        }
        if (nome) patch.rappresentanteDitta = nome;
        if (n != null) patch.nOperatori = Math.round(n);
        await db.rapportini.update(id, patch);
        await enqueueSync(id, "upsert");
        fatti += 1;
      }
      void syncNow();
      setScelti(new Set());
      mostraEsito({
        titolo: "Bozze corrette",
        testo: `${fatti} ${fatti === 1 ? "bozza aggiornata" : "bozze aggiornate"}. Il resto dei fogli non è cambiato.`,
        dopo: "resta",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="elenco-head">
        <h2>Correggi bozze</h2>
      </div>
      <p className="muted">
        Pagina temporanea. Scegli le bozze, compila solo i campi da cambiare e premi «Applica».
        I campi lasciati vuoti non vengono toccati. Gli archiviati non compaiono qui.
      </p>

      <section className="panel">
        <h2>Nuovi valori</h2>
        <div className="scheda-foot">
          <label>
            Dipendente TERNA (il sottoscritto)
            <select value={dipendente} onChange={(e) => setDipendente(e.target.value)}>
              <option value="">— non cambiare —</option>
              {(operatori ?? []).map((o) => (
                <option key={o.id} value={o.nome}>
                  {o.nome}
                  {o.firma ? "" : " (senza firma nel profilo)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sig. — rappresentante della ditta
            <input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="— non cambiare —" />
          </label>
          <label>
            N° operatori
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={nOperatori}
              placeholder="— non cambiare —"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) setNOperatori(v);
              }}
            />
          </label>
        </div>
        {errore ? <p className="form-error">{errore}</p> : null}
        <div className="contab-estrai">
          <p className="muted" style={{ margin: 0 }}>
            {scelti.size} {scelti.size === 1 ? "bozza selezionata" : "bozze selezionate"}
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void applica()}>
            {busy ? "Applico…" : "Applica alle selezionate"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="elenco-head">
          <h2>
            Bozze <span className="count">{bozze.length}</span>
          </h2>
          <input
            className="elenco-cerca"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Cerca numero, linea, nome…"
          />
        </div>
        {bozze.length === 0 ? (
          <p className="muted">Nessuna bozza sul dispositivo.</p>
        ) : (
          <div className="campate-table-wrap">
            <table className="campate-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={tuttiVisibiliScelti}
                      onChange={alternaTutti}
                      aria-label="Seleziona tutte"
                    />
                  </th>
                  <th>Numero</th>
                  <th>Data</th>
                  <th>Linea</th>
                  <th>Campata</th>
                  <th>Dipendente TERNA</th>
                  <th>Sig.</th>
                  <th>N° op.</th>
                  <th>Creato da</th>
                </tr>
              </thead>
              <tbody>
                {visibili.map((r) => {
                  const l = lineaDi.get(r.lineaId);
                  return (
                    <tr key={r.id} onClick={() => alterna(r.id)} style={{ cursor: "pointer" }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={scelti.has(r.id)}
                          onChange={() => alterna(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleziona ${r.numero}`}
                        />
                      </td>
                      <td>
                        <strong>{r.numero || "—"}</strong>
                      </td>
                      <td>{r.dataLavoro ? formatDate(r.dataLavoro) : "—"}</td>
                      <td>{l ? `${l.codice} · ${l.nome}` : "—"}</td>
                      <td>{r.campata || "—"}</td>
                      <td>{r.dipendenteTerna || "—"}</td>
                      <td>{r.rappresentanteDitta || "—"}</td>
                      <td>{r.nOperatori || "—"}</td>
                      <td>{r.presoDa || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
