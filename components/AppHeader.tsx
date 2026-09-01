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
  const { online, pending, syncing, syncNow } = useSync();
  const { session, logout } = useSession();

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
          className={`sync-pill ${online ? "is-online" : "is-offline"}`}
          onClick={() => void syncNow()}
          title="Sincronizza ora"
        >
          <span className="dot" />
          {!online
            ? "Offline"
            : syncing
              ? "Sync…"
              : pending > 0
                ? `${pending} in coda`
                : "Sincronizzato"}
        </button>
        {session ? (
          <div className="user-chip">
            <span>
              {session.nome}
              <small>{session.ruolo === "tecnico" ? "Tecnico" : "Operatore"}</small>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                logout();
                window.location.assign("/");
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
