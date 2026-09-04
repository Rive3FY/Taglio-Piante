"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function OperatoreRinviiPage() {
  return (
    <>
      <h2>Da riprendere e attenzionare</h2>
      <p className="muted">
        Le campate su cui bisogna tornare in un mese preciso e quelle da tenere d’occhio. È un
        promemoria: lo stato nell’elenco campate non cambia. Da qui si tolgono dall’elenco e si apre
        il rapportino sulla linea quando ci torni.
      </p>
      <CampateElenco ruolo="operatore" modo="rinvii" />
    </>
  );
}
