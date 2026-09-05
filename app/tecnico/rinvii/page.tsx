"use client";

import { CampateElenco } from "@/components/CampateElenco";

export default function TecnicoRinviiPage() {
  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Da riprendere e attenzionare</h2>
        </div>
      </div>
      <CampateElenco ruolo="tecnico" modo="rinvii" />
    </>
  );
}
