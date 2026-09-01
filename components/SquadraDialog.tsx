"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/SessionContext";
import { useSync } from "@/lib/SyncContext";
import { applicaSquadraAiRapportini, readSquadra, type PrefsSquadra } from "@/lib/squadra";

export function SquadraDialog() {
  const { session } = useSession();
  const { syncNow } = useSync();
  const [aperto, setAperto] = useState(false);
  const [forzato, setForzato] = useState(false);
  const [rappresentante, setRappresentante] = useState("");
  const [nOperatori, setNOperatori] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const obbligatorio = Boolean(session && session.ruolo === "operatore" && !readSquadra(session.userId));

  useEffect(() => {
    if (!session || session.ruolo !== "operatore") return;
    const attuale = readSquadra(session.userId);
    if (attuale) {
      setRappresentante(attuale.rappresentanteDitta);
      setNOperatori(String(attuale.nOperatori));
    }
    setAperto(!attuale);
  }, [session]);

  useEffect(() => {
    function apri() {
      if (!session || session.ruolo !== "operatore") return;
      const attuale = readSquadra(session.userId);
      if (attuale) {
        setRappresentante(attuale.rappresentanteDitta);
        setNOperatori(String(attuale.nOperatori));
      }
      setForzato(true);
    }
    window.addEventListener("apri-squadra", apri);
    return () => window.removeEventListener("apri-squadra", apri);
  }, [session]);

  if (!session || session.ruolo !== "operatore") return null;
  if (!aperto && !forzato) return null;
  const sessione = session;

  async function salva() {
    const nome = rappresentante.trim();
    const n = Number(nOperatori);
    if (!nome || !Number.isFinite(n) || n < 1) {
      setErrore("Indica il Sig. e un numero di operatori almeno pari a 1.");
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      const prefs: PrefsSquadra = { rappresentanteDitta: nome, nOperatori: Math.round(n) };
      await applicaSquadraAiRapportini(sessione, prefs);
      void syncNow();
      setAperto(false);
      setForzato(false);
    } finally {
      setBusy(false);
    }
  }

  const chiudibile = !obbligatorio;

  return (
    <div className="squadra-overlay" role="dialog" aria-modal="true" aria-labelledby="squadra-titolo">
      <form
        className="login-card squadra-card"
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
      >
        <h2 id="squadra-titolo">Squadra di oggi</h2>
        <p className="muted">
          Sig. e numero operatori vanno su tutti i rapportini che compilerai. Se confermi, gli stessi
          dati vengono riportati anche sui rapportini già salvati.
        </p>
        <label>
          Sig. — rappresentante della ditta
          <input
            value={rappresentante}
            onChange={(e) => setRappresentante(e.target.value)}
            placeholder="Nome e cognome"
            autoComplete="name"
          />
        </label>
        <label>
          N° operatori
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={nOperatori}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) setNOperatori(v);
            }}
            placeholder="Es. 3"
          />
        </label>
        {errore ? <p className="form-error">{errore}</p> : null}
        <div className="danger-actions">
          {chiudibile ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setForzato(false)}
            >
              Annulla
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Salvataggio…" : "Conferma e applica"}
          </button>
        </div>
      </form>
    </div>
  );
}
