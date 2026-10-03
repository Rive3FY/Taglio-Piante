"use client";

import { useEffect, useRef } from "react";

let dialogAperti = 0;

/** Vero mentre un popup sta usando il tasto indietro per chiudersi. */
export function dialogSulloSchermo() {
  return dialogAperti > 0;
}

export function trattieniIndietroDialog() {
  dialogAperti += 1;
  return () => {
    dialogAperti = Math.max(0, dialogAperti - 1);
  };
}

/** Il tasto indietro del telefono chiude il popup invece di lasciare la pagina. */
export function useDialogBack(aperto: boolean, onChiudi: () => void) {
  const onChiudiRef = useRef(onChiudi);
  onChiudiRef.current = onChiudi;

  useEffect(() => {
    if (!aperto) return;
    const rilascia = trattieniIndietroDialog();
    window.history.pushState({ ...(window.history.state ?? {}), dialog: true }, "");
    const onPop = () => onChiudiRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      rilascia();
    };
  }, [aperto]);
}
