"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addOperatore, removeOperatore, renameOperatore } from "@/lib/operatori";

export default function OperatoriPage() {
  const operatori = useLiveQuery(() => db.operatori.orderBy("nome").toArray(), []) ?? [];
  const [nuovo, setNuovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(action: () => Promise<boolean>, okMessage: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const synced = await action();
      setInfo(
        synced
          ? okMessage
          : `${okMessage} Sincronizzazione in sospeso: la modifica è per ora solo su questo dispositivo.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Operatori</h2>
      <p className="muted">
        Chi compare nell’elenco può accedere come operatore e firmare i rapportini come dipendente TERNA.
      </p>

      <section className="panel">
        <h2>Aggiungi operatore</h2>
        <div className="inline-form">
          <label>
            Nome e cognome
            <input
              value={nuovo}
              onChange={(e) => setNuovo(e.target.value)}
              placeholder="Es. Mario Rossi"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !nuovo.trim()}
            onClick={() =>
              void run(async () => {
                const synced = await addOperatore(nuovo);
                setNuovo("");
                return synced;
              }, "Operatore aggiunto.")
            }
          >
            {busy ? "Salvataggio…" : "Aggiungi"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {info ? <p className="muted">{info}</p> : null}
      </section>

      <section className="panel">
        <h2>Elenco ({operatori.length})</h2>
        {operatori.length === 0 ? (
          <p className="muted">Nessun operatore in elenco.</p>
        ) : (
          <ul className="operatori-list">
            {operatori.map((op) => (
              <li key={op.id}>
                {editId === op.id ? (
                  <>
                    <input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      aria-label="Nuovo nome"
                    />
                    <div className="operatori-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !editNome.trim()}
                        onClick={() =>
                          void run(async () => {
                            const synced = await renameOperatore(op.id, editNome);
                            setEditId(null);
                            return synced;
                          }, "Nome aggiornato.")
                        }
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditId(null)}
                      >
                        Annulla
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{op.nome}</strong>
                    <div className="operatori-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditId(op.id);
                          setEditNome(op.nome);
                        }}
                      >
                        Rinomina
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm(
                            `Rimuovere ${op.nome} dall’elenco operatori? I rapportini già compilati restano invariati.`,
                          );
                          if (!ok) return;
                          void run(() => removeOperatore(op.id), "Operatore rimosso.");
                        }}
                      >
                        Elimina
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
