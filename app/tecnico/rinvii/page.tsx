"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function TecnicoRinviiPage() {
  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Da riprendere e attenzionare</h2>
          <p className="muted">
            Promemoria a parte, col mese di ripresa o solo da tenere d’occhio: non entra nei grafici
            e non cambia lo stato nell’elenco campate. Il piano nuovo del file resta tutto da
            tagliare; questo elenco non lo sovrascrive. Una campata compare una sola volta: se la
            segni di nuovo si aggiorna, non si duplica.
          </p>
        </div>
      </div>
      <CampateElenco ruolo="tecnico" modo="rinvii" />
    </>
  );
}
