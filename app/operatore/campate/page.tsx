"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function OperatoreCampatePage() {
  return (
    <>
      <h2>Elenco campate</h2>
      <p className="muted">
        Quello che il tecnico ha pianificato e quello che è già tagliato. Con <strong>Nuova campata</strong>{" "}
        ne aggiungi una a mano se non è nel file. Tocca una riga per nota, «da attenzionare», «da non
        tagliare» e «da riprendere». I due promemoria si tolgono poi dall’elenco «Da riprendere e
        attenzionare».
      </p>
      <CampateElenco ruolo="operatore" />
    </>
  );
}
