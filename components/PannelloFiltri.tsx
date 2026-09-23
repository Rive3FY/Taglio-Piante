"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useDialogBack } from "@/lib/useDialogBack";
import { useMediaQuery } from "@/lib/useMediaQuery";

export type FiltroAttivo = { id: string; label: string; togli: () => void };

const FiltriEspansi = createContext(false);

/** Dentro il pannello del telefono i gruppi di filtri si mostrano aperti, uno sotto l'altro. */
export function useFiltriEspansi() {
  return useContext(FiltriEspansi);
}

/**
 * Da PC i filtri restano in pagina come sono. Da telefono resta un solo pulsante «Filtri»
 * con i filtri attivi sotto, e tutti i gruppi si aprono in un pannello dal basso.
 */
export function PannelloFiltri({
  attivi,
  risultati,
  unita = ["campata", "campate"],
  onAzzera,
  children,
}: {
  attivi: FiltroAttivo[];
  risultati: number;
  unita?: [string, string];
  onAzzera: () => void;
  children: ReactNode;
}) {
  const compatto = useMediaQuery("(max-width: 720px)");
  const [aperto, setAperto] = useState(false);
  const mostraPannello = compatto && aperto;

  function chiudi() {
    if (window.history.state?.dialog) window.history.back();
    else setAperto(false);
  }

  useDialogBack(mostraPannello, () => setAperto(false));

  useEffect(() => {
    if (!mostraPannello) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prima;
    };
  }, [mostraPannello]);

  if (!compatto) return <>{children}</>;

  const n = attivi.length;
  return (
    <>
      <div className="filtri-barra">
        <button
          type="button"
          className={`chip filtri-apri${n > 0 ? " on" : ""}`}
          aria-haspopup="dialog"
          onClick={() => setAperto(true)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M3 5h18v2H3zm4 6h10v2H7zm3 6h4v2h-4z" />
          </svg>
          Filtri
          {n > 0 ? <span className="filtri-numero">{n}</span> : null}
        </button>
        {n > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm filtri-azzera" onClick={onAzzera}>
            Azzera
          </button>
        ) : null}
      </div>
      {n > 0 ? (
        <ul className="filtri-attivi" aria-label="Filtri attivi">
          {attivi.map((f) => (
            <li key={f.id}>
              <button type="button" className="filtro-attivo" onClick={f.togli} aria-label={`Togli ${f.label}`}>
                {f.label}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mostraPannello ? (
        <div className="filtri-foglio-overlay" role="dialog" aria-modal="true" aria-labelledby="filtri-foglio-titolo">
          <button type="button" className="filtri-foglio-fuori" aria-label="Chiudi i filtri" onClick={chiudi} />
          <div className="filtri-foglio">
            <header className="filtri-foglio-head">
              <h2 id="filtri-foglio-titolo">Filtri</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={chiudi} aria-label="Chiudi">
                ✕
              </button>
            </header>
            <div className="filtri-foglio-corpo">
              <FiltriEspansi.Provider value={true}>{children}</FiltriEspansi.Provider>
            </div>
            <footer className="filtri-foglio-piede">
              <button type="button" className="btn btn-secondary" disabled={n === 0} onClick={onAzzera}>
                Azzera
              </button>
              <button type="button" className="btn btn-primary" onClick={chiudi}>
                Mostra {risultati} {risultati === 1 ? unita[0] : unita[1]}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
