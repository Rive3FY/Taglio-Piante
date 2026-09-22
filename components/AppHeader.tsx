"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSync } from "@/lib/SyncContext";
import { useSession } from "@/lib/SessionContext";
import { homeArea, useArea, writeArea } from "@/lib/area";

function iniziali(nome: string) {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  const lettere = parole.length > 1 ? [parole[0][0], parole.at(-1)![0]] : [nome.trim().slice(0, 2)];
  return lettere.join("").toUpperCase();
}

export function AppHeader({
  title,
  backHref,
  nav,
}: {
  title: string;
  backHref?: string;
  /** Menu delle sezioni nella barra in alto: compare solo su schermo largo. */
  nav?: ReactNode;
}) {
  const { online, pending, lastError, lastSyncAt, syncing, syncNow } = useSync();
  const { session, offline, logout } = useSession();
  const router = useRouter();
  const area = useArea();
  const altraArea = area === "tecnico" ? "operatore" : "tecnico";
  const [menuUtente, setMenuUtente] = useState(false);
  const rifUtente = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuUtente) return;
    const fuori = (e: MouseEvent) => {
      if (rifUtente.current && !rifUtente.current.contains(e.target as Node)) setMenuUtente(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuUtente(false);
    };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [menuUtente]);

  const pillClass = [
    "sync-pill",
    online ? "is-online" : "is-offline",
    lastError ? "is-error" : pending > 0 ? "is-pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ultimoGiro = lastSyncAt
    ? ` Ultimo scambio col server: ${new Date(lastSyncAt).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}.`
    : " Nessuno scambio col server da quando l’app è aperta.";

  const pillTitle = (!online
    ? "Nessuna rete: le modifiche restano sul telefono."
    : lastError
      ? `${pending} modifiche da mandare al server. Ultimo errore: ${lastError}. Tocca per riprovare.`
      : pending > 0
        ? `${pending} modifiche salvate sul telefono, in invio automatico. Tocca per forzare l’invio.`
        : "Tutto allineato con il server. Tocca solo se vuoi sincronizzare di nuovo.") + ultimoGiro;

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
    <header className={`app-header${backHref ? " has-back" : ""}`}>
      {backHref ? (
        <Link href={backHref} replace className="back-link">
          ← Indietro
        </Link>
      ) : null}
      <div className="app-header-left">
        {backHref ? null : (
          <Link href="/" className="brand">
            Rapportini Taglio
          </Link>
        )}
        <h1>{title}</h1>
      </div>
      {nav ? <div className="app-header-nav">{nav}</div> : null}
      <div className="app-header-right">
        <button
          type="button"
          className={pillClass}
          onClick={() => void syncNow({ completo: true })}
          title={pillTitle}
        >
          <span className="dot" />
          <span className="sync-pill-text">
            {pillLabel}
            {online && lastError ? <small>{lastError}</small> : null}
          </span>
        </button>
        {session ? (
          <div ref={rifUtente} className={`user-chip${menuUtente ? " aperto" : ""}`}>
            <button
              type="button"
              className="user-avatar"
              aria-label={`Menu di ${session.nome}`}
              aria-expanded={menuUtente}
              onClick={() => setMenuUtente((v) => !v)}
            >
              {iniziali(session.nome)}
            </button>
            <div className="user-menu">
            <span className="user-nome">
              {session.nome}
              <small>
                {session.ruolo === "tecnico" ? "Tecnico" : "Operatore"}
                {session.ruolo === "tecnico" && area === "operatore" ? " · sul campo" : ""}
                {offline ? " · accesso offline" : ""}
              </small>
            </span>
            <div className="user-azioni">
            {session.ruolo === "tecnico" ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title={
                  altraArea === "operatore"
                    ? "Lavora come operatore: rapportini tuoi e campate sul campo."
                    : "Torna all’area tecnico: tutti i rapportini, campate e account."
                }
                onClick={() => {
                  writeArea(session.userId, altraArea);
                  router.replace(homeArea(altraArea));
                }}
              >
                {altraArea === "operatore" ? "Passa a operatore" : "Passa a tecnico"}
              </button>
            ) : null}
            {area === "operatore" ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => window.dispatchEvent(new Event("apri-squadra"))}
              >
                Squadra
              </button>
            ) : null}
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
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
