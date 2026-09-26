"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const CHIAVE = "cifre-visibili";

const useLayoutEffetto = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Stessa scelta su home e sul foglio: l’occhio nasconde conteggio e importo. */
export function useCifreVisibili() {
  const [visibili, setVisibili] = useState(true);

  useLayoutEffetto(() => {
    const leggi = () => setVisibili(localStorage.getItem(CHIAVE) !== "0");
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHIAVE) leggi();
    };
    leggi();
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHIAVE, leggi);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHIAVE, leggi);
    };
  }, []);

  function alterna() {
    const next = !visibili;
    localStorage.setItem(CHIAVE, next ? "1" : "0");
    setVisibili(next);
    window.dispatchEvent(new Event(CHIAVE));
  }

  return { visibili, alterna };
}

export function OcchioCifre({ visibili, onClick }: { visibili: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="occhio-cifre"
      aria-pressed={visibili}
      aria-label={visibili ? "Nascondi totale e importo" : "Mostra totale e importo"}
      onClick={onClick}
    >
      {visibili ? <IconaOcchioAperto /> : <IconaOcchioChiuso />}
    </button>
  );
}

function IconaOcchioAperto() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.8-6.2 10-6.2S22 12 22 12s-3.8 6.2-10 6.2S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconaOcchioChiuso() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.8 10.8 0 0 1 12 4.8c5.6 0 9.2 4.2 10.2 6.2a12 12 0 0 1-2.1 3.1M6.1 6.2C3.8 7.7 2.2 10 1.8 11c1 2 4.6 6.2 10.2 6.2 1.5 0 2.9-.3 4.1-.8"
      />
    </svg>
  );
}
