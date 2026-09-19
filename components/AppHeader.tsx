"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSync } from "@/lib/SyncContext";
import { useSession } from "@/lib/SessionContext";
import { homeArea, useArea, writeArea } from "@/lib/area";

export function AppHeader({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  const { stato, pending, bloccate, lastError, lastSyncAt, syncing, syncNow } = useSync();
  const { session, offline, logout } = useSession();
  const router = useRouter();
  const area = useArea();
  const altraArea = area === "tecnico" ? "operatore" : "tecnico";

  const inCoda = pending > 0 ? ` · ${pending} da inviare` : "";

  const pillClass = [
    "sync-pill",
    stato === "offline" ? "is-offline" : stato === "instabile" ? "is-debole" : "is-online",
    bloccate > 0 ? "is-error" : pending > 0 ? "is-pending" : "",
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
    : " Nessuno scambio col server, per ora.";

  // Niente allarmi quando è solo la linea a mancare: il lavoro è comunque al sicuro
  // sul telefono, e l'unica cosa che l'operatore deve sapere è quanto resta da mandare.
  const pillTitle =
    (stato === "offline"
      ? `Nessuna rete: il lavoro resta salvato sul telefono e parte da solo appena c’è segnale.${
          pending > 0 ? ` In attesa: ${pending}.` : ""
        }`
      : stato === "instabile"
        ? `Il server non risponde: linea troppo debole. Il lavoro è salvato sul telefono, l’invio riprende da solo.${
            pending > 0 ? ` In attesa: ${pending}.` : ""
          }`
        : bloccate > 0
          ? `${bloccate} modifiche non vengono accettate dal server: ${lastError ?? ""} Tocca per riprovare.`
          : pending > 0
            ? `${pending} modifiche salvate sul telefono, in invio automatico. Tocca per forzare l’invio.`
            : "Tutto allineato con il server. Tocca solo se vuoi sincronizzare di nuovo.") +
    ultimoGiro;

  const pillLabel =
    stato === "offline"
      ? `Senza rete${inCoda}`
      : stato === "instabile"
        ? `Rete debole${inCoda}`
        : syncing
          ? "Invio…"
          : bloccate > 0
            ? "Da sistemare"
            : pending > 0
              ? `${pending} da inviare`
              : "Sincronizzato";

  const esci = () => {
    if (
      pending > 0 &&
      !window.confirm(
        `Ci sono ${pending} modifiche non ancora inviate al server. Se esci restano sul telefono e ripartiranno solo rientrando con questo stesso account. Vuoi uscire lo stesso?`,
      )
    ) {
      return;
    }
    void logout().finally(() => window.location.assign("/"));
  };

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
      <div className="app-header-right">
        <button
          type="button"
          className={pillClass}
          onClick={() => void syncNow({ manuale: true })}
          title={pillTitle}
        >
          <span className="dot" />
          <span className="sync-pill-text">
            {pillLabel}
            {bloccate > 0 && lastError ? <small>{lastError}</small> : null}
          </span>
        </button>
        {session ? (
          <div className="user-chip">
            <span>
              {session.nome}
              <small>
                {session.ruolo === "tecnico" ? "Tecnico" : "Operatore"}
                {session.ruolo === "tecnico" && area === "operatore" ? " · sul campo" : ""}
                {offline ? " · accesso offline" : ""}
              </small>
            </span>
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
            <button type="button" className="btn btn-ghost btn-sm" onClick={esci}>
              Esci
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
