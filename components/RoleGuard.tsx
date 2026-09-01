"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import type { Ruolo } from "@/lib/types";

export function RoleGuard({
  ruolo,
  children,
}: {
  ruolo: Ruolo;
  children: React.ReactNode;
}) {
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/");
      return;
    }
    if (session.ruolo !== ruolo) {
      router.replace(session.ruolo === "tecnico" ? "/tecnico" : "/operatore");
    }
  }, [ready, session, ruolo, router]);

  if (!ready) return <div className="page-loading">Caricamento…</div>;
  if (!session || session.ruolo !== ruolo) {
    return <div className="page-loading">Reindirizzamento…</div>;
  }

  return <>{children}</>;
}
