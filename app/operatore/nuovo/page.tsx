"use client";

import { RapportinoForm } from "@/components/RapportinoForm";

export default function NuovoRapportinoPage() {
  return (
    <>
      <h2>Nuovo rapportino</h2>
      <RapportinoForm mode="compile" />
    </>
  );
}
