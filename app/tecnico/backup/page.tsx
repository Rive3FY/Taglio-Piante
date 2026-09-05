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
import { mostraEsito } from "@/lib/esitoSalvataggio";

export default function TecnicoBackupPage() {
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(() => db.prestazioni.orderBy("codice").toArray(), []) ?? [];
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const mesi = useMemo(() => mesiConRapportiniChiusi(rapportini), [rapportini]);
  const [scelti, setScelti] = useState<string[] | "init">("init");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  const mesiEffettivi = (scelti === "init" ? (mesi[0] ? [mesi[0]] : []) : scelti).filter((m) =>
    mesi.includes(m),
  );
  const conteggiMese = useMemo(() => {
    const m = new Map<string, number>();
    for (const mese of mesi) m.set(mese, fogliPerBackup(rapportini, linee, [mese]).length);
    return m;
  }, [mesi, rapportini, linee]);
  const fogli = useMemo(
    () => fogliPerBackup(rapportini, linee, mesiEffettivi),
    [rapportini, linee, mesiEffettivi],
  );
  const anteprima = useMemo(() => anteprimaBackup(fogli), [fogli]);
  const lineeUniche = new Set(fogli.map((f) => f.item.lineaId)).size;

  function toggle(mese: string) {
    setScelti((cur) => {
      const base = cur === "init" ? (mesi[0] ? [mesi[0]] : []) : cur;
      return base.includes(mese) ? base.filter((m) => m !== mese) : [...base, mese];
    });
    setErrore(null);
  }

  async function scarica() {
    if (fogli.length === 0) {
      setErrore("Seleziona almeno un mese con rapportini archiviati.");
      return;
    }
    setBusy(true);
    setErrore(null);
    setProgresso("Preparazione fogli…");
    try {
      const esito = await scaricaBackupZip(fogli, prestazioni, {
        finoA: todayIso(),
        campate,
        onProgress: (fatto, totale, numero) => {
          setProgresso(`Foglio ${fatto} di ${totale} · ${numero}`);
        },
      });
      const extra =
        esito.ok < esito.totale ? ` (${esito.totale - esito.ok} non compilati)` : "";
      mostraEsito({
        titolo: "Backup scaricato",
        testo: `Zip pronto: ${esito.ok} fogli${extra}.`,
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
        <p className="muted">
          Copia manuale dei fogli ufficiali già archiviati. Nello zip c’è una cartella per mese e,
          dentro, solo le linee che in quel mese hanno avuto del lavoro. I rapportini con pulizia
          basi ci sono come gli altri. In più, se nei mesi scelti ci sono sostegni puliti, lo zip
          contiene anche <strong>Basi.xlsx</strong>. Le bozze restano fuori.
        </p>

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

            {anteprima.length > 0 ? (
              <p className="muted">
                {fogli.length} {fogli.length === 1 ? "rapportino" : "rapportini"} · {lineeUniche}{" "}
                {lineeUniche === 1 ? "linea" : "linee"} · fino al {formatDate(todayIso())}
              </p>
            ) : (
              <p className="muted">Seleziona i mesi da mettere nello zip.</p>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || fogli.length === 0}
              onClick={() => void scarica()}
            >
              {busy ? "Preparazione zip…" : "Scarica zip"}
            </button>
            {progresso ? <p className="muted">{progresso}</p> : null}
            {errore ? <p className="form-error">{errore}</p> : null}
          </>
        )}
      </section>
    </>
  );
}
