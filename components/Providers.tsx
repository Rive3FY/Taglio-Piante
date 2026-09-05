"use client";

import { useEffect } from "react";
import { SessionProvider, useSession } from "@/lib/SessionContext";
import { SyncProvider, useSync } from "@/lib/SyncContext";
import { PwaRegister } from "@/components/PwaRegister";
import { riportaBozzeRecentiSenzaFirma } from "@/lib/rapportinoFirma";

function RiportaBozzeSenzaFirma() {
  const { session, ready } = useSession();
  const { syncNow } = useSync();
  useEffect(() => {
    if (!ready || !session) return;
    let vivo = true;
    void riportaBozzeRecentiSenzaFirma(session).then((n) => {
      if (vivo && n > 0) void syncNow();
    });
    return () => {
      vivo = false;
    };
  }, [ready, session, syncNow]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>
        <PwaRegister />
        <RiportaBozzeSenzaFirma />
        {children}
      </SyncProvider>
    </SessionProvider>
  );
}
