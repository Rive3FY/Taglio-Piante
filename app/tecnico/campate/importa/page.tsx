"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { parseFileCampate } from "@/lib/campate/file";
import { costruisciAnteprima, conteggioDistanzeDaFile, type AnteprimaImport } from "@/lib/campate/preview";
import { aggiornaDistanzeDaFile, confermaImportCampate } from "@/lib/campate/apply";
import { annoDi, anniPiani } from "@/lib/campate/anno";
import { useSession } from "@/lib/SessionContext";
import { CAMPATA_PRIORITA_LABEL } from "@/lib/types";
import { formatDistInt } from "@/lib/format";
import type { RigaImportBruta, RigaImportScartata } from "@/lib/campate/parse";

export default function ImportaCampatePage() {
  const router = useRouter();
  const { session } = useSession();
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const esistenti = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{
    riconosciute: RigaImportBruta[];
    scartate: RigaImportScartata[];
  } | null>(null);
  const [anno, setAnno] = useState(() => new Date().getFullYear());
  const [azzeraTesto, setAzzeraTesto] = useState("");

  const anteprima: AnteprimaImport | null = useMemo(() => {
    if (!parsed) return null;
    return costruisciAnteprima(
      parsed.riconosciute,
      parsed.scartate,
      Array.isArray(esistenti) ? esistenti : [],
      new Set((Array.isArray(linee) ? linee : []).map((l) => l.codice.toUpperCase())),
      anno,
    );
  }, [parsed, esistenti, linee, anno]);

  const haPianoAnno = esistenti.some((c) => annoDi(c) === anno);
  const anniPresenti = anniPiani(esistenti);
  const distanze = anteprima ? conteggioDistanzeDaFile(anteprima.voci, esistenti, anno) : null;
  const nCampate = esistenti.filter((c) => c.tipo !== "base").length;

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErrore(null);
    setParsed(null);
    setFileName(file.name);
    setAzzeraTesto("");
    try {
      const letto = await parseFileCampate(file);
      setParsed({ riconosciute: letto.riconosciute, scartate: letto.scartate });
      if (letto.riconosciute.length === 0 && letto.scartate.length > 0) {
        setErrore(letto.scartate[0]?.motivo ?? "Nessuna campata riconosciuta.");
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setBusy(false);
    }
  }

  async function aggiornaDistanze() {
    if (!anteprima || !session) return;
    setBusy(true);
    setErrore(null);
    try {
      const { aggiornate } = await aggiornaDistanzeDaFile({ anteprima, anno });
      if (aggiornate === 0) {
        setErrore("Nessuna distanza da attaccare: nel file non c’è Dist int oppure le campate non coincidono con questo anno.");
        return;
      }
      router.push("/tecnico/campate");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Aggiornamento distanze non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function importaPiano() {
    if (!anteprima || !session) return;
    const nAnno = esistenti.filter((c) => c.tipo !== "base" && annoDi(c) === anno).length;
    const ok = window.confirm(
      haPianoAnno
        ? `Sostituire il piano ${anno}? Verranno rimosse ${nAnno} campate di quell’anno (anche già tagliate) e rimesse le ${anteprima.voci.filter((v) => v.azione !== "duplicato").length} righe del file, tutte da tagliare. Rapportini e gli altri anni restano.`
        : `Importare il piano ${anno}? Si aggiungono ${anteprima.voci.filter((v) => v.azione !== "duplicato").length} campate da tagliare. Rapportini e gli anni già in elenco restano.`,
    );
    if (!ok) return;
    setBusy(true);
    setErrore(null);
    try {
      await confermaImportCampate({ fileName, anteprima, session, anno, azzera: false });
      router.push("/tecnico/campate");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Importazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function azzeraEImporta() {
    if (!anteprima || !session) return;
    if (azzeraTesto.trim().toUpperCase() !== "AZZERA") {
      setErrore("Per azzerare tutto scrivi AZZERA nel campo sotto, poi conferma.");
      return;
    }
    const ok = window.confirm(
      `Confermi l’azzeramento? Spariscono ${rapportini.length} rapportini, ${nCampate} campate` +
        (anniPresenti.length ? ` (anni ${anniPresenti.join(", ")})` : "") +
        ` e ${linee.length} linee, sul telefono e su Supabase. Poi si riparte solo con le ${anteprima.voci.filter((v) => v.azione !== "duplicato").length} righe di questo file come piano ${anno}. Serve solo per cancellare prove o ripartire da zero.`,
    );
    if (!ok) return;
    setBusy(true);
    setErrore(null);
    try {
      await confermaImportCampate({ fileName, anteprima, session, anno, azzera: true });
      router.push("/tecnico/campate");
    } catch (e) {
      setErrore(
        e instanceof Error
          ? e.message
          : "Importazione non riuscita. Se i dati sono spariti, ricarica il file e riprova.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Carica file campate</h2>

      <section className="panel">
        <p className="muted">
          Ogni file è un <strong>piano di un anno</strong>. Per il report nuovo usa{" "}
          <strong>Importa piano</strong>: i rapportini e i tagli degli anni scorsi restano.
          «Azzera tutto e riparti» serve solo a cancellare prove o ripartire da zero.
        </p>
        <label>
          Anno del piano
          <input
            type="number"
            min={2020}
            max={2100}
            value={anno}
            onChange={(e) => setAnno(Number(e.target.value) || new Date().getFullYear())}
          />
        </label>
        <label className="file-btn btn btn-primary">
          Scegli file PDF o CSV
          <input
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {fileName ? <p className="muted">File: {fileName}</p> : null}
        {busy ? <p className="muted">Analisi in corso…</p> : null}
        {errore ? <p className="form-error">{errore}</p> : null}
      </section>

      {anteprima ? (
        <section className="panel">
          <h2>Anteprima · piano {anno}</h2>
          {haPianoAnno ? (
            <div className="panel">
              <p>
                Esiste già un piano {anno}. <strong>Aggiorna solo le distanze</strong> lascia stati e
                rapportini, e attacca anche le coordinate Maps. <strong>Importa piano {anno}</strong>{" "}
                sostituisce le campate di quest’anno.
              </p>
              <p>
                Trovate <strong>{distanze?.nelFile ?? 0} misure</strong> nel file, di cui{" "}
                <strong>{distanze?.aggiornabili ?? 0}</strong> si possono attaccare alle campate {anno}.
              </p>
            </div>
          ) : (
            <div className="panel">
              <p>
                Si aggiungono <strong>{anteprima.voci.filter((v) => v.azione !== "duplicato").length} campate</strong>{" "}
                da tagliare per il {anno}. Rapportini e altri anni non vengono toccati.
              </p>
            </div>
          )}
          <ul className="storico-list">
            <li>{anteprima.voci.filter((v) => v.distInt != null).length} con distanza (Dist int)</li>
            <li>{anteprima.voci.filter((v) => v.azione !== "duplicato").length} interventi nel file</li>
            <li>{anteprima.duplicati} duplicati nel file (si importa una sola volta)</li>
            <li>{anteprima.doppiaPriorita} campate sia urgenti sia differibili</li>
            <li>{anteprima.giaTagliateAnniScorsi} già tagliate in anni precedenti (restano da fare quest’anno)</li>
            <li>{anteprima.scartate.length} righe non riconosciute</li>
          </ul>

          {anteprima.scartate.length > 0 ? (
            <p className="muted">
              Prime righe scartate: {anteprima.scartate.slice(0, 5).map((s) => s.motivo).join(" · ")}
            </p>
          ) : null}

          <div className="campate-table-wrap">
            <table className="campate-table">
              <thead>
                <tr>
                  <th>Linea</th>
                  <th>Nome</th>
                  <th>Originale</th>
                  <th>Normalizzata</th>
                  <th>Dist int</th>
                  <th>Priorità</th>
                  <th>Anni scorsi</th>
                </tr>
              </thead>
              <tbody>
                {anteprima.voci.slice(0, 80).map((v) => (
                  <tr key={v.chiave}>
                    <td className="linea-codice">{v.codiceLinea}</td>
                    <td>{v.nomeLinea}</td>
                    <td>{v.originale}</td>
                    <td>{v.normalizzata}</td>
                    <td>{v.distInt != null ? formatDistInt(v.distInt) : "—"}</td>
                    <td>{CAMPATA_PRIORITA_LABEL[v.priorita]}</td>
                    <td>
                      {v.anniTaglioPrecedenti?.length
                        ? v.anniTaglioPrecedenti.join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {anteprima.voci.length > 80 ? (
            <p className="muted">Mostrate le prime 80. L’operazione usa tutte le righe.</p>
          ) : null}

          <div className="elenco-azioni">
            {haPianoAnno ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || (distanze?.aggiornabili ?? 0) === 0}
                onClick={() => void aggiornaDistanze()}
              >
                {busy ? "Aggiornamento…" : "Aggiorna solo le distanze"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || anteprima.voci.length === 0}
              onClick={() => void importaPiano()}
            >
              {busy ? "Importazione…" : `Importa piano ${anno}`}
            </button>
          </div>

          <div className="panel" style={{ borderColor: "var(--danger, #c0392b)", marginTop: 24 }}>
            <p>
              <strong>Azzera tutto e riparti</strong> — solo per cancellare prove o ripartire da zero.
              Per il report del nuovo anno usa Importa piano. Elimina {rapportini.length} rapportini,{" "}
              {nCampate} campate e {linee.length} linee.
            </p>
            <label>
              Scrivi AZZERA per confermare
              <input
                value={azzeraTesto}
                onChange={(e) => {
                  setAzzeraTesto(e.target.value);
                  setErrore(null);
                }}
                placeholder="AZZERA"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || anteprima.voci.length === 0 || azzeraTesto.trim().toUpperCase() !== "AZZERA"}
              onClick={() => void azzeraEImporta()}
            >
              {busy ? "Azzeramento…" : "Azzera tutto e riparti"}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
