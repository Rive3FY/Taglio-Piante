"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { chiudiEsito, iscriviEsito } from "@/lib/esitoSalvataggio";
import { PopupEsitoSalvataggio, type EsitoSalvataggio } from "./PopupEsitoSalvataggio";

export function EsitoSalvataggioHost() {
  const router = useRouter();
  const { session } = useSession();
  const [esito, setEsito] = useState<EsitoSalvataggio | null>(null);

  useEffect(() => iscriviEsito(setEsito), []);

  if (!esito) return null;

  return (
    <PopupEsitoSalvataggio
      esito={esito}
      onOk={() => {
        const dopo = esito.dopo;
        chiudiEsito();
        if (!dopo || dopo === "resta") return;
        if (dopo === "home") {
          router.replace(session?.ruolo === "tecnico" ? "/tecnico" : "/operatore");
          return;
        }
        router.replace(dopo);
      }}
    />
  );
}
