"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RapportinoForm } from "@/components/RapportinoForm";

export default function NuovoRapportinoPage() {
  return (
    <Suspense fallback={<p className="muted">Caricamento…</p>}>
      <NuovoRapportino />
    </Suspense>
  );
}

function NuovoRapportino() {
  const search = useSearchParams();
  const linea = search.get("linea") ?? undefined;
  const campata = search.get("campata") ?? undefined;
  const daElenco = Boolean(linea || campata);
  return (
    <>
      <h2>{daElenco ? "Rapportino da elenco campate" : "Nuovo rapportino"}</h2>
      <RapportinoForm precompilatoLineaId={linea} precompilatoCampataId={campata} />
    </>
  );
}
