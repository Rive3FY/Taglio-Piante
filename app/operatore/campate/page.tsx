"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function OperatoreCampatePage() {
  return (
    <>
      <h2>Elenco campate</h2>
      <p className="muted">
        Quello che il tecnico ha pianificato e quello che è stato già tagliato o tralasciato. Da qui
        puoi aprire un rapportino precompilato sulla linea. Tocca una riga per la nota; la spunta
        gialla “da attenzionare” sta in tabella.
      </p>
      <CampateElenco ruolo="operatore" />
    </>
  );
}
