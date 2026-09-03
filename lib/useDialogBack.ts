"use client";

import { useEffect, useRef } from "react";

/** Il tasto indietro del telefono chiude il popup invece di lasciare la pagina. */
export function useDialogBack(aperto: boolean, onChiudi: () => void) {
  const onChiudiRef = useRef(onChiudi);
  onChiudiRef.current = onChiudi;

  useEffect(() => {
    if (!aperto) return;
    window.history.pushState({ dialog: true }, "");
    const onPop = () => onChiudiRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [aperto]);
}
