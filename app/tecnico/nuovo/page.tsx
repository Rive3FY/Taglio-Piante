"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RapportinoForm } from "@/components/RapportinoForm";

export default function NuovoRapportinoTecnicoPage() {
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
  return (
    <>
      <h2>{linea || campata ? "Rapportino da elenco campate" : "Nuovo rapportino"}</h2>
      <RapportinoForm precompilatoLineaId={linea} precompilatoCampataId={campata} />
    </>
  );
}
