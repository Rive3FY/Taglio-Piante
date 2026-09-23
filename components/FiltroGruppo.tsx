"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFiltriEspansi } from "./PannelloFiltri";

const CHIUDI_ALTRI = "filtro-gruppo-open";

export function FiltroGruppo({
  titolo,
  etichetta,
  attivo = false,
  children,
}: {
  titolo: string;
  /** Nome del gruppo, mostrato sopra le scelte quando i filtri sono aperti tutti insieme. */
  etichetta?: string;
  attivo?: boolean;
  children: ReactNode;
}) {
  const espanso = useFiltriEspansi();
  const [aperto, setAperto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (espanso) return;
    function chiudiSeFuori(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAperto(false);
    }
    function chiudiDaAltro() {
      setAperto(false);
    }
    document.addEventListener("pointerdown", chiudiSeFuori);
    window.addEventListener(CHIUDI_ALTRI, chiudiDaAltro);
    return () => {
      document.removeEventListener("pointerdown", chiudiSeFuori);
      window.removeEventListener(CHIUDI_ALTRI, chiudiDaAltro);
    };
  }, [espanso]);

  if (espanso) {
    return (
      <div className="filtro-sezione" role="group" aria-label={etichetta ?? titolo}>
        <span className="filtro-sezione-titolo">{etichetta ?? titolo}</span>
        <div className="filtro-sezione-scelte">{children}</div>
      </div>
    );
  }

  function toggle() {
    if (aperto) {
      setAperto(false);
      return;
    }
    window.dispatchEvent(new Event(CHIUDI_ALTRI));
    setAperto(true);
  }

  return (
    <div ref={rootRef} className={`filtro-gruppo${aperto ? " is-open" : ""}`}>
      <button
        type="button"
        className={`chip filtro-gruppo-capo ${attivo || aperto ? "on" : ""}`}
        aria-expanded={aperto}
        aria-haspopup="listbox"
        onClick={toggle}
      >
        <span>{titolo}</span>
        <span className={`chevron ${aperto ? "giu" : ""}`} aria-hidden="true">
          ›
        </span>
      </button>
      <div className="filtro-gruppo-paniere" role="listbox">
        <div
          className="filtro-gruppo-sub"
          inert={aperto ? undefined : true}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button.chip")) setAperto(false);
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
