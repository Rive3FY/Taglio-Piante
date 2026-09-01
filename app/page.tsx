"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import type { Ruolo } from "@/lib/types";
import { OPERATORI } from "@/lib/operatori";

export default function HomePage() {
  const { session, ready, setSession } = useSession();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState<Ruolo | null>(null);

  useEffect(() => {
    if (!ready || !session) return;
    router.replace(session.ruolo === "tecnico" ? "/tecnico" : "/operatore");
  }, [ready, session, router]);

  function enter() {
    if (!ruolo || !nome.trim()) return;
    setSession({ ruolo, nome: nome.trim() });
    router.push(ruolo === "tecnico" ? "/tecnico" : "/operatore");
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
        <button type="button" className="role-card" onClick={() => setRuolo("operatore")}>
          <div className="kicker">Campo</div>
          <h2>Operatore</h2>
          <p className="muted">Compila il rapportino, firma con S Pen, salva anche senza segnale.</p>
        </button>
        <button type="button" className="role-card" onClick={() => setRuolo("tecnico")}>
          <div className="kicker">Ufficio</div>
          <h2>Tecnico</h2>
          <p className="muted">Linee, da prendere, in attesa, archivio e download PDF.</p>
        </button>
      </div>

      {ruolo ? (
        <div className="login-card">
          <h2>Entra come {ruolo === "tecnico" ? "tecnico" : "operatore"}</h2>
          <label>
            {ruolo === "operatore" ? "Nome operatore" : "Nome"}
            <select autoFocus value={nome} onChange={(e) => setNome(e.target.value)}>
              <option value="">Seleziona…</option>
              {OPERATORI.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={enter} disabled={!nome.trim()}>
            Entra
          </button>
        </div>
      ) : null}
    </main>
  );
}
