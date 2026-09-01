"use client";

import { RapportinoForm } from "@/components/RapportinoForm";

export default function NuovoDaPrenderePage() {
  return (
    <>
      <h2>Nuovo rapportino da prendere</h2>
      <p className="muted">Il tecnico prepara il lavoro sulla linea. L’operatore lo prende sul campo, anche offline.</p>
      <RapportinoForm mode="assign" />
    </>
  );
}
