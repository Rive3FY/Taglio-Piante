"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const CHIUDI_ALTRI = "filtro-gruppo-open";

export function FiltroGruppo({
  titolo,
  attivo = false,
  children,
}: {
  titolo: string;
  attivo?: boolean;
  children: ReactNode;
}) {
  const [aperto, setAperto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

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
