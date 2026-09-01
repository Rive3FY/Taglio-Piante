"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSession } from "@/lib/SessionContext";
import type { Ruolo } from "@/lib/types";
import { checkTecnicoPassword, TECNICO_NOME } from "@/lib/auth";

export default function HomePage() {
  const { session, ready, setSession } = useSession();
  const router = useRouter();
  const operatori = useLiveQuery(() => db.operatori.orderBy("nome").toArray(), []) ?? [];
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [ruolo, setRuolo] = useState<Ruolo | null>(null);

  useEffect(() => {
    if (!ready || !session) return;
    router.replace(session.ruolo === "tecnico" ? "/tecnico" : "/operatore");
  }, [ready, session, router]);

  function scegliRuolo(next: Ruolo) {
    setRuolo(next);
    setErrore(null);
    setPassword("");
    setNome(next === "tecnico" ? TECNICO_NOME : "");
  }

  function enter() {
    if (!ruolo) return;
    if (ruolo === "tecnico") {
      if (!checkTecnicoPassword(password)) {
        setErrore("Password non corretta.");
        return;
      }
      setSession({ ruolo, nome: TECNICO_NOME });
      router.push("/tecnico");
      return;
    }
    if (!nome.trim()) return;
    setSession({ ruolo, nome: nome.trim() });
    router.push("/operatore");
  }

  if (!ready) return <div className="page-loading">Preparazione archivio locale…</div>;

  return (
    <main className="page">
      <div className="hero">
        <div className="kicker">Nuovo progetto</div>
        <h1>Rapportini Taglio</h1>
        <p className="muted">Funziona offline sul tablet. Le firme restano in locale e si sincronizzano quando torna la rete.</p>
      </div>

      <div className="role-grid">
        <button type="button" className="role-card" onClick={() => scegliRuolo("operatore")}>
          <div className="kicker">Campo</div>
          <h2>Operatore</h2>
          <p className="muted">Compila il rapportino, firma con S Pen, salva anche senza segnale.</p>
        </button>
        <button type="button" className="role-card" onClick={() => scegliRuolo("tecnico")}>
          <div className="kicker">Ufficio</div>
          <h2>Tecnico</h2>
          <p className="muted">Linee, in attesa, archivio, operatori e download PDF.</p>
        </button>
      </div>

      {ruolo === "operatore" ? (
        <div className="login-card">
          <h2>Entra come operatore</h2>
          <label>
            Nome operatore
            <select autoFocus value={nome} onChange={(e) => setNome(e.target.value)}>
              <option value="">Seleziona…</option>
              {operatori.map((op) => (
                <option key={op.id} value={op.nome}>
                  {op.nome}
                </option>
              ))}
            </select>
          </label>
          {operatori.length === 0 ? (
            <p className="muted">
              Nessun operatore in elenco: chiedi al tecnico di aggiungerti da Tecnico → Operatori.
            </p>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={enter} disabled={!nome.trim()}>
            Entra
          </button>
        </div>
      ) : null}

      {ruolo === "tecnico" ? (
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
        >
          <h2>Entra come tecnico</h2>
          <label>
            Tecnico
            <input readOnly value={TECNICO_NOME} />
          </label>
          <label>
            Password
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrore(null);
              }}
              placeholder="Password area tecnico"
            />
          </label>
          {errore ? <p className="form-error">{errore}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={!password}>
            Entra
          </button>
        </form>
      ) : null}
    </main>
  );
}
