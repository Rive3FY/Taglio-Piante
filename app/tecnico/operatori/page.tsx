"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  addOperatore,
  removeOperatore,
  renameOperatore,
  resetPasswordOperatore,
  setFirmaOperatore,
} from "@/lib/operatori";
import { normalizzaFirma } from "@/lib/firma";
import { useSession } from "@/lib/SessionContext";
import { mostraEsito } from "@/lib/esitoSalvataggio";

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

  async function esegui(action: () => Promise<void>, esito: { titolo: string; testo: string }) {
    setBusy(true);
    setErrore(null);
    try {
      await action();
      mostraEsito({ ...esito, dopo: "resta" });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Operatori</h2>

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
            }, {
              titolo: "Account creato",
              testo: "L’operatore può accedere subito con email e password.",
            })
          }
        >
          {busy ? "Creazione…" : "Crea account"}
        </button>
        {errore ? <p className="form-error">{errore}</p> : null}
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
                    <div className="firma-profilo">
                      {op.firma ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={op.firma} alt={`Firma di ${op.nome}`} />
                      ) : (
                        <span className="muted">Nessuna firma caricata</span>
                      )}
                    </div>
                    <div className="operatori-actions">
                      <label className="btn btn-ghost btn-sm file-btn">
                        {op.firma ? "Cambia firma" : "Carica firma"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            void esegui(async () => {
                              const dataUrl = await normalizzaFirma(file);
                              await setFirmaOperatore(op.id, dataUrl);
                            }, {
                              titolo: "Firma salvata",
                              testo: `La firma di ${op.nome} è sul profilo.`,
                            });
                          }}
                        />
                      </label>
                      {op.firma ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() =>
                            void esegui(() => setFirmaOperatore(op.id, null), {
                              titolo: "Firma rimossa",
                              testo: `La firma di ${op.nome} non è più sul profilo.`,
                            })
                          }
                        >
                          Rimuovi firma
                        </button>
                      ) : null}
                    </div>
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
                          }, azione?.tipo === "password"
                            ? { titolo: "Password aggiornata", testo: `${op.nome} può entrare con la nuova password.` }
                            : { titolo: "Nome aggiornato", testo: "Il nome dell’operatore è stato cambiato." })
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
                            void esegui(() => removeOperatore(op.id), {
                              titolo: "Account eliminato",
                              testo: `${op.nome} non può più accedere. I rapportini già inviati restano.`,
                            });
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
