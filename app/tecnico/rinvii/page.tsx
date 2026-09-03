"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function TecnicoRinviiPage() {
  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Da riprendere</h2>
          <p className="muted">
            Le stesse campate dell’elenco, segnate per tornarci in un mese preciso. È solo un
            promemoria: lo stato nell’elenco campate e le torte non cambiano, quelle le muove solo il
            rapportino. Da qui puoi cambiare mese, togliere il promemoria o spuntare «Tagliata»
            quando ci sei tornato.
          </p>
        </div>
      </div>
      <CampateElenco ruolo="tecnico" modo="rinvii" />
    </>
  );
}
