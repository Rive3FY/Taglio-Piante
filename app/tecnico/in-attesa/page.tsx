"use client";

import { RapportinoList } from "@/components/RapportinoList";

export default function InAttesaPage() {
  return (
    <RapportinoList
      stato="in_attesa"
      title="Rapportini in attesa"
      empty="Nessun rapportino in attesa di verifica."
    />
  );
}
