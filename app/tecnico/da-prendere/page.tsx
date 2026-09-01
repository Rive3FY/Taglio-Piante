"use client";

import { RapportinoList } from "@/components/RapportinoList";

export default function DaPrenderePage() {
  return (
    <RapportinoList
      stato="da_prendere"
      title="Rapportini da prendere"
      empty="Nessun rapportino in coda da prendere."
    />
  );
}
