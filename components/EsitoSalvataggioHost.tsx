"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { homeArea, useArea } from "@/lib/area";
import { chiudiEsito, iscriviEsito } from "@/lib/esitoSalvataggio";
import { PopupEsitoSalvataggio, type EsitoSalvataggio } from "./PopupEsitoSalvataggio";

export function EsitoSalvataggioHost() {
  const router = useRouter();
  const area = useArea();
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
          router.replace(homeArea(area));
          return;
        }
        router.replace(dopo);
      }}
    />
  );
}
