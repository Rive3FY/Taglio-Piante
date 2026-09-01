"use client";

import Link from "next/link";
import { CampateElenco } from "@/components/CampateElenco";

export default function TecnicoCampatePage() {
  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Campate</h2>
          <p className="muted">Elenco operativo: pianificato dal file e aggiornato dai rapportini.</p>
        </div>
        <Link href="/tecnico/campate/importa" className="btn btn-primary">
          Carica file campate
        </Link>
      </div>
      <CampateElenco ruolo="tecnico" />
    </>
  );
}
