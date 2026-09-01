"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  addOperatore,
  removeOperatore,
  renameOperatore,
  resetPasswordOperatore,
} from "@/lib/operatori";
import { useSession } from "@/lib/SessionContext";

type Azione = { tipo: "rinomina" | "password"; id: string } | null;

export default function OperatoriPage() {
  const { session } = useSession();
  const operatori = useLiveQuery(() => db.operatori.orderBy("nome").toArray(), []) ?? [];
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [azione, setAzione] = useState<Azione>(null);
  const [valore, setValore] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function esegui(action: () => Promise<void>, messaggio: string) {
    setBusy(true);
    setErrore(null);
    setInfo(null);
    try {
      await action();
      setInfo(messaggio);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Operatori</h2>
      <p className="muted">
        Ogni operatore ha un account con email e password. Senza account non si entra nell’app e non
        si vedono i rapportini.
      </p>

      <section className="panel">
        <h2>Nuovo operatore</h2>
        <label>
          Nome e cognome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Mario Rossi" />
        </label>
        <label>
          Email
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mario.rossi@esempio.it"
          />
        </label>
        <label>
          Password iniziale
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Almeno 8 caratteri"
          />
        </label>
        <p className="muted">
          Comunica la password all’operatore: potrai reimpostarla in qualsiasi momento da questa pagina.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !nome.trim() || !email.trim() || password.length < 8}
          onClick={() =>
            void esegui(async () => {
              await addOperatore({ nome, email, password });
              setNome("");
              setEmail("");
              setPassword("");
            }, "Account creato: l’operatore può accedere subito.")
          }
        >
          {busy ? "Creazione…" : "Crea account"}
        </button>
        {errore ? <p className="form-error">{errore}</p> : null}
        {info ? <p className="muted">{info}</p> : null}
      </section>

      <section className="panel">
        <h2>Elenco ({operatori.length})</h2>
        {operatori.length === 0 ? (
          <p className="muted">Nessun account ancora creato.</p>
        ) : (
          <ul className="operatori-list">
            {operatori.map((op) => {
              const isTecnico = op.ruolo === "tecnico";
              const inModifica = azione?.id === op.id;
              return (
                <li key={op.id}>
                  <div className="operatori-info">
                    <strong>{op.nome}</strong>
                    <span className="muted">{op.email}</span>
                    {isTecnico ? <span className="badge badge-archiviato">Tecnico</span> : null}
                  </div>

                  {inModifica ? (
                    <div className="operatori-actions">
                      <input
                        type={azione?.tipo === "password" ? "text" : "text"}
                        value={valore}
                        onChange={(e) => setValore(e.target.value)}
                        placeholder={azione?.tipo === "password" ? "Nuova password" : "Nuovo nome"}
                        aria-label={azione?.tipo === "password" ? "Nuova password" : "Nuovo nome"}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !valore.trim()}
                        onClick={() =>
                          void esegui(async () => {
                            if (azione?.tipo === "password") {
                              await resetPasswordOperatore(op.id, valore);
                            } else {
                              await renameOperatore(op.id, valore);
                            }
                            setAzione(null);
                            setValore("");
                          }, azione?.tipo === "password" ? "Password aggiornata." : "Nome aggiornato.")
                        }
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setAzione(null);
                          setValore("");
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <div className="operatori-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setAzione({ tipo: "rinomina", id: op.id });
                          setValore(op.nome);
                        }}
                      >
                        Rinomina
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setAzione({ tipo: "password", id: op.id });
                          setValore("");
                        }}
                      >
                        Nuova password
                      </button>
                      {isTecnico || op.id === session?.userId ? null : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => {
                            const ok = window.confirm(
                              `Eliminare l’account di ${op.nome}? Non potrà più accedere. I rapportini già inviati restano in archivio.`,
                            );
                            if (!ok) return;
                            void esegui(() => removeOperatore(op.id), "Account eliminato.");
                          }}
                        >
                          Elimina
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
