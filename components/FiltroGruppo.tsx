"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div className={`filtro-gruppo${aperto ? " is-open" : ""}`}>
      <button
        type="button"
        className={`chip filtro-gruppo-capo ${attivo || aperto ? "on" : ""}`}
        aria-expanded={aperto}
        onClick={() => setAperto((v) => !v)}
      >
        <span>{titolo}</span>
        <span className={`chevron ${aperto ? "giu" : ""}`} aria-hidden="true">
          ›
        </span>
      </button>
      <div className="filtro-gruppo-paniere">
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
