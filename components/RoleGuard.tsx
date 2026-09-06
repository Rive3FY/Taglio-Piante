"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { homeArea } from "@/lib/area";
import type { Area, Session } from "@/lib/types";

/** Il tecnico entra anche in area operatore; l'operatore resta fuori da quella tecnica. */
function puoEntrare(session: Session | null, area: Area) {
  if (!session) return false;
  return area === "operatore" || session.ruolo === "tecnico";
}

export function RoleGuard({
  ruolo,
  children,
}: {
  ruolo: Area;
  children: React.ReactNode;
}) {
  const { session, ready } = useSession();
  const router = useRouter();
  const ammesso = puoEntrare(session, ruolo);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/");
      return;
    }
    if (!ammesso) router.replace(homeArea(session.ruolo));
  }, [ready, session, ammesso, router]);

  if (!ready) return <div className="page-loading">Caricamento…</div>;
  if (!ammesso) {
    return <div className="page-loading">Reindirizzamento…</div>;
  }

  return <>{children}</>;
}
