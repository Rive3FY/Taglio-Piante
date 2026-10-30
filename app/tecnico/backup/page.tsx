"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { etichettaMese, mesiConRapportiniChiusi } from "@/lib/contabilita/aggrega";
import { formatDate, todayIso } from "@/lib/format";
import {
  anteprimaBackup,
  fogliPerBackup,
  scaricaBackupZip,
} from "@/lib/backup/zipRapportini";
import { nomePreposto, raggruppaPreposti, SENZA_PREPOSTO } from "@/lib/backup/preposti";
import { rapportinoEChiuso } from "@/lib/types";
import { mostraEsito } from "@/lib/esitoSalvataggio";

export default function TecnicoBackupPage() {
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(() => db.prestazioni.orderBy("codice").toArray(), []) ?? [];
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const mesi = useMemo(() => mesiConRapportiniChiusi(rapportini), [rapportini]);
  const gruppi = useMemo(
    () => raggruppaPreposti(rapportini.filter((r) => rapportinoEChiuso(r.stato))),
    [rapportini],
  );
  const [scelti, setScelti] = useState<string[] | "init">("init");
  const [preposto, setPreposto] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  const mesiEffettivi = (scelti === "init" ? (mesi[0] ? [mesi[0]] : []) : scelti).filter((m) =>
    mesi.includes(m),
  );
  const tuttiDeiMesi = useMemo(
    () => fogliPerBackup(rapportini, linee, mesiEffettivi, gruppi),
    [rapportini, linee, mesiEffettivi, gruppi],
  );
  const conteggiPreposto = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of tuttiDeiMesi) m.set(f.preposto, (m.get(f.preposto) ?? 0) + 1);
    return m;
  }, [tuttiDeiMesi]);
  const voci = useMemo(() => {
    const lista = gruppi.map((g) => ({ chiave: g.chiave, nome: g.nome, varianti: g.varianti }));
    if (conteggiPreposto.has(nomePreposto(SENZA_PREPOSTO, gruppi))) {
      lista.push({ chiave: SENZA_PREPOSTO, nome: nomePreposto(SENZA_PREPOSTO, gruppi), varianti: [] });
    }
    return lista;
  }, [gruppi, conteggiPreposto]);
  const prepostoValido = preposto && voci.some((v) => v.chiave === preposto) ? preposto : "";
  const conteggiMese = useMemo(() => {
    const m = new Map<string, number>();
    for (const mese of mesi) {
      m.set(mese, fogliPerBackup(rapportini, linee, [mese], gruppi, prepostoValido || null).length);
    }
    return m;
  }, [mesi, rapportini, linee, gruppi, prepostoValido]);
  const fogli = useMemo(
    () => fogliPerBackup(rapportini, linee, mesiEffettivi, gruppi, prepostoValido || null),
    [rapportini, linee, mesiEffettivi, gruppi, prepostoValido],
  );
  const anteprima = useMemo(() => anteprimaBackup(fogli), [fogli]);
  const lineeUniche = new Set(fogli.map((f) => f.item.lineaId)).size;
  const nomeScelto = prepostoValido ? nomePreposto(prepostoValido, gruppi) : "";

  function toggle(mese: string) {
    setScelti((cur) => {
      const base = cur === "init" ? (mesi[0] ? [mesi[0]] : []) : cur;
      return base.includes(mese) ? base.filter((m) => m !== mese) : [...base, mese];
    });
    setErrore(null);
  }

  async function scarica() {
    if (fogli.length === 0) {
      setErrore(
        nomeScelto
          ? `Nei mesi scelti non ci sono rapportini archiviati di ${nomeScelto}.`
          : "Seleziona almeno un mese con rapportini archiviati.",
      );
      return;
    }
    setBusy(true);
    setErrore(null);
    setProgresso("Preparazione fogli…");
    try {
      const esito = await scaricaBackupZip(fogli, prestazioni, {
        finoA: todayIso(),
        campate,
        soloPreposto: nomeScelto || undefined,
        onProgress: (fatto, totale, numero) => {
          setProgresso(`Foglio ${fatto} di ${totale} · ${numero}`);
        },
      });
      const extra =
        esito.ok < esito.totale ? ` (${esito.totale - esito.ok} non compilati)` : "";
      mostraEsito({
        titolo: "Backup scaricato",
        testo: `Zip pronto${nomeScelto ? ` per ${nomeScelto}` : ""}: ${esito.ok} fogli${extra}.`,
        dopo: "resta",
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Backup non riuscito.");
    } finally {
      setBusy(false);
      setProgresso("");
    }
  }

  return (
    <>
      <h2>Backup</h2>
      <section className="panel">
        <h2>Zip dei rapportini</h2>

        {mesi.length === 0 ? (
          <p className="muted">Non c’è ancora nessun rapportino archiviato da copiare.</p>
        ) : (
          <>
            <div className="backup-azioni">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setScelti(mesi)}
                disabled={busy}
              >
                Tutti i mesi
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setScelti([])}
                disabled={busy}
              >
                Nessuno
              </button>
            </div>
            <ul className="backup-mesi">
              {mesi.map((m) => {
                const n = conteggiMese.get(m) ?? 0;
                return (
                  <li key={m}>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={mesiEffettivi.includes(m)}
                        disabled={busy}
                        onChange={() => toggle(m)}
                      />
                      <span>
                        {etichettaMese(m)}
                        <small className="muted">
                          {" "}
                          · {n} {n === 1 ? "foglio" : "fogli"}
                        </small>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="backup-preposti">
              <p className="field-label">Preposto ditta (chi ha tagliato)</p>
              <ul className="backup-mesi">
                <li>
                  <label className="check-line">
                    <input
                      type="radio"
                      name="preposto"
                      checked={!prepostoValido}
                      disabled={busy}
                      onChange={() => setPreposto("")}
                    />
                    <span>
                      Tutti
                      <small className="muted"> · {tuttiDeiMesi.length} fogli, una cartella per preposto</small>
                    </span>
                  </label>
                </li>
                {voci.map((v) => {
                  const n = conteggiPreposto.get(v.nome) ?? 0;
                  return (
                    <li key={v.chiave}>
                      <label className="check-line">
                        <input
                          type="radio"
                          name="preposto"
                          checked={prepostoValido === v.chiave}
                          disabled={busy}
                          onChange={() => {
                            setPreposto(v.chiave);
                            setErrore(null);
                          }}
                        />
                        <span>
                          {v.nome}
                          <small className="muted">
                            {" "}
                            · {n} {n === 1 ? "foglio" : "fogli"}
                            {v.varianti.length > 1 ? ` · anche «${v.varianti.slice(1).join("», «")}»` : ""}
                          </small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="muted">
                Il preposto è il Sig. scritto sul foglio come rappresentante della ditta. Nomi scritti
                in modo diverso (es. «Pirozzi» e «Pirozzi Mario») vengono uniti.
              </p>
            </div>

            {anteprima.length > 0 ? (
              <p className="muted">
                {fogli.length} {fogli.length === 1 ? "rapportino" : "rapportini"}
                {nomeScelto ? ` di ${nomeScelto}` : ""} · {lineeUniche}{" "}
                {lineeUniche === 1 ? "linea" : "linee"} · fino al {formatDate(todayIso())}
              </p>
            ) : (
              <p className="muted">
                {mesiEffettivi.length === 0
                  ? "Seleziona i mesi da mettere nello zip."
                  : `Nessun rapportino${nomeScelto ? ` di ${nomeScelto}` : ""} nei mesi scelti.`}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || fogli.length === 0}
              onClick={() => void scarica()}
            >
              {busy ? "Preparazione zip…" : nomeScelto ? `Scarica zip di ${nomeScelto}` : "Scarica zip"}
            </button>
            {progresso ? <p className="muted">{progresso}</p> : null}
            {errore ? <p className="form-error">{errore}</p> : null}
          </>
        )}
      </section>
    </>
  );
}
