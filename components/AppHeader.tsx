"use client";

import Link from "next/link";
import { useSync } from "@/lib/SyncContext";
import { useSession } from "@/lib/SessionContext";

export function AppHeader({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  const { online, pending, lastError, syncing, syncNow } = useSync();
  const { session, offline, logout } = useSession();

  const pillClass = [
    "sync-pill",
    online ? "is-online" : "is-offline",
    lastError ? "is-error" : pending > 0 ? "is-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pillTitle = !online
    ? "Nessuna rete: le modifiche restano sul telefono."
    : lastError
      ? `${pending} modifiche da mandare al server. Ultimo errore: ${lastError}. Tocca per riprovare.`
      : pending > 0
        ? `${pending} modifiche salvate sul telefono, ancora da mandare al server. Tocca per inviare.`
        : "Tutto allineato con il server. Tocca per sincronizzare di nuovo.";

  const pillLabel = !online
    ? "Offline"
    : syncing
      ? "Invio…"
      : lastError
        ? "Invio non riuscito"
        : pending > 0
          ? `${pending} da inviare`
          : "Sincronizzato";

  return (
    <header className="app-header">
      <div className="app-header-left">
        {backHref ? (
          <Link href={backHref} className="back-link">
            ← Indietro
          </Link>
        ) : (
          <Link href="/" className="brand">
            Rapportini Taglio
          </Link>
        )}
        <h1>{title}</h1>
      </div>
      <div className="app-header-right">
        <button
          type="button"
          className={pillClass}
          onClick={() => void syncNow()}
          title={pillTitle}
        >
          <span className="dot" />
          <span className="sync-pill-text">
            {pillLabel}
            {online && lastError ? <small>{lastError}</small> : null}
          </span>
        </button>
        {session ? (
          <div className="user-chip">
            <span>
              {session.nome}
              <small>
                {session.ruolo === "tecnico" ? "Tecnico" : "Operatore"}
                {offline ? " · accesso offline" : ""}
              </small>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void logout().finally(() => window.location.assign("/"));
              }}
            >
              Esci
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
