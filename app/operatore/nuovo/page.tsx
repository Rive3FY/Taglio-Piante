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
  return (
    <>
      <h2>{linea ? "Rapportino da elenco campate" : "Nuovo rapportino"}</h2>
      {linea ? (
        <p className="muted">Precompilato con le campate ancora da tagliare su questa linea.</p>
      ) : (
        <p className="muted">Rapportino in bianco: puoi indicare campate anche non previste nel file.</p>
      )}
      <RapportinoForm precompilatoLineaId={linea} />
    </>
  );
}
