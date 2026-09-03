"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tecnicoBackHref } from "./nav";

/**
 * Il tasto indietro del telefono non deve uscire sull’accesso
 * (la home rimanda subito in area tecnico e fa un salto).
 * Dalle sezioni torna al piano Linee; dalle pagine interne al padre.
 */
export function useTecnicoHardwareBack(da?: string | null) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onPop() {
      if (window.location.pathname.startsWith("/tecnico")) return;
      const target = tecnicoBackHref(pathname, da) ?? "/tecnico";
      window.history.pushState(null, "", target);
      router.replace(target);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pathname, router, da]);
}
