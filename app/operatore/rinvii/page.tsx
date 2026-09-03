"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function OperatoreRinviiPage() {
  return (
    <>
      <h2>Da riprendere</h2>
      <p className="muted">
        Le campate su cui bisogna tornare in un mese preciso. È un promemoria: lo stato nell’elenco
        campate non cambia. Da qui puoi aprire il rapportino sulla linea quando ci torni.
      </p>
      <CampateElenco ruolo="operatore" modo="rinvii" />
    </>
  );
}
