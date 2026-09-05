"use client";

import { useEffect, useState } from "react";
import { applicaTema, impostaTema, temaSalvato, type Tema } from "@/lib/tema";

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("chiaro");

  useEffect(() => {
    const attuale = temaSalvato();
    setTema(attuale);
    applicaTema(attuale);
  }, []);

  function alterna() {
    const next: Tema = tema === "scuro" ? "chiaro" : "scuro";
    setTema(next);
    impostaTema(next);
  }

  const versoGiorno = tema === "scuro";

  return (
    <button
      type="button"
      className="tema-btn"
      onClick={alterna}
      aria-pressed={tema === "scuro"}
      title={versoGiorno ? "Passa alla modalità giorno" : "Passa alla modalità notte"}
    >
      {versoGiorno ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path
            d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15.5 3.5a8.5 8.5 0 1 0 5 13.2 7 7 0 0 1-5-13.2z"
            fill="currentColor"
          />
        </svg>
      )}
      <span>{versoGiorno ? "Giorno" : "Notte"}</span>
    </button>
  );
}
