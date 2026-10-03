"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dialogSulloSchermo } from "./useDialogBack";

/**
 * Il tasto indietro del telefono fa la stessa cosa del tasto Indietro in alto.
 * Sulla schermata principale resta lì, senza tornare all’accesso.
 */
export function useIndietroComeSchermo(backHref?: string) {
  const router = useRouter();

  useEffect(() => {
    const stato = window.history.state;
    if (!stato?.rtIndietro) {
      window.history.pushState({ ...(stato ?? {}), rtIndietro: true }, "");
    }

    function onPop() {
      if (dialogSulloSchermo()) return;
      if (backHref) {
        window.setTimeout(() => router.replace(backHref), 0);
        return;
      }
      window.history.pushState({ ...(window.history.state ?? {}), rtIndietro: true }, "");
    }

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [backHref, router]);
}
