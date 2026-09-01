"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

export default function HomePage() {
  const { session, ready, configurato, login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !session) return;
    router.replace(session.ruolo === "tecnico" ? "/tecnico" : "/operatore");
  }, [ready, session, router]);

  async function entra() {
    setBusy(true);
    setErrore(null);
    try {
      const profilo = await login(email, password);
      router.replace(profilo.ruolo === "tecnico" ? "/tecnico" : "/operatore");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Accesso non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="page-loading">Preparazione archivio locale…</div>;

  return (
    <main className="page">
      <div className="hero">
        <div className="kicker">Area riservata</div>
        <h1>Rapportini Taglio</h1>
        <p className="muted">
          Accedi con le credenziali che ti ha dato il tecnico. Dopo il primo accesso l’app funziona
          anche senza segnale.
        </p>
      </div>

      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void entra();
        }}
      >
        <h2>Accedi</h2>
        {!configurato ? (
          <p className="form-error">
            Supabase non è configurato: senza connessione al database non è possibile accedere.
          </p>
        ) : null}
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrore(null);
            }}
            placeholder="nome@esempio.it"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrore(null);
            }}
          />
        </label>
        {errore ? <p className="form-error">{errore}</p> : null}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !configurato || !email.trim() || !password}
        >
          {busy ? "Accesso…" : "Entra"}
        </button>
        <p className="muted">
          Password dimenticata? Chiedi al tecnico di reimpostarla dalla sezione Operatori.
        </p>
      </form>
    </main>
  );
}
