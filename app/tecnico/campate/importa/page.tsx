"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { parseFileCampate } from "@/lib/campate/file";
import { costruisciAnteprima, type AnteprimaImport } from "@/lib/campate/preview";
import { confermaImportCampate } from "@/lib/campate/apply";
import { useSession } from "@/lib/SessionContext";
import { CAMPATA_PRIORITA_LABEL } from "@/lib/types";
import { formatDistInt } from "@/lib/format";

export default function ImportaCampatePage() {
  const router = useRouter();
  const { session } = useSession();
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const esistenti = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [anteprima, setAnteprima] = useState<AnteprimaImport | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErrore(null);
    setAnteprima(null);
    setFileName(file.name);
    try {
      const parsed = await parseFileCampate(file);
      const preview = costruisciAnteprima(
        parsed.riconosciute,
        parsed.scartate,
        esistenti,
        new Set(linee.map((l) => l.codice.toUpperCase())),
      );
      if (preview.voci.length === 0 && preview.scartate.length > 0) {
        setErrore(preview.scartate[0]?.motivo ?? "Nessuna campata riconosciuta.");
      }
      setAnteprima(preview);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setBusy(false);
    }
  }

  async function conferma() {
    if (!anteprima || !session) return;
    setBusy(true);
    setErrore(null);
    try {
      await confermaImportCampate({ fileName, anteprima, session });
      router.push("/tecnico/campate");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Importazione non riuscita. I dati già presenti non sono stati cancellati.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Carica file campate</h2>

      <section className="panel">
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
          <h2>Anteprima</h2>
          <ul className="storico-list">
            <li>{anteprima.voci.length} interventi distinti (linea + campata + priorità)</li>
            <li>{anteprima.nuove} nuovi</li>
            <li>{anteprima.esistenti} già presenti</li>
            <li>{anteprima.doppiaPriorita} campate sia urgenti sia differibili: restano due voci</li>
            <li>{anteprima.duplicati} duplicati nel file (stessa linea, campata e priorità)</li>
            <li>{anteprima.giaLavorate} già lavorate: lo storico resta</li>
            <li>{anteprima.scartate.length} righe non riconosciute</li>
            {anteprima.lineeNuove.length > 0 ? (
              <li>Linee nuove da creare: {anteprima.lineeNuove.join(", ")}</li>
            ) : null}
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
                  <th>Azione</th>
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
                    <td>{v.azione.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {anteprima.voci.length > 80 ? (
            <p className="muted">Mostrate le prime 80. In importazione partono tutte.</p>
          ) : null}

          <div className="elenco-azioni">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || anteprima.voci.length === 0}
              onClick={() => void conferma()}
            >
              {busy ? "Importazione…" : "Conferma importazione"}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
