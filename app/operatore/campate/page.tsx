"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function OperatoreCampatePage() {
  return (
    <>
      <h2>Elenco campate</h2>
      <p className="muted">
        Quello che il tecnico ha pianificato e quello che è già tagliato. Da qui puoi aprire un
        rapportino precompilato sulla linea. Tocca una riga per nota, «da attenzionare», «da non
        tagliare» e «da riprendere».
      </p>
      <CampateElenco ruolo="operatore" />
    </>
  );
}
