"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { SEZIONI, rapportiniDellaSezione } from "@/lib/sezioni";
import { useSession } from "@/lib/SessionContext";

export default function OperatoreHome() {
  const { session } = useSession();
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  return (
    <>
      <div className="home-grid">
        <Link href="/operatore/nuovo" className="home-card">
          <div className="kicker">Nuovo</div>
          <h2>Compila rapportino</h2>
          <p className="muted">Lavoro libero, salvataggio locale e firma S Pen.</p>
        </Link>
        <Link href="/operatore/campate" className="home-card">
          <div className="kicker">Elenco</div>
          <h2>Campate</h2>
          <p className="muted">Pianificate e tagliate. Da qui parti col rapportino precompilato.</p>
        </Link>
        <Link href="/operatore/rinvii" className="home-card">
          <div className="kicker">Promemoria</div>
          <h2>Da riprendere e attenzionare</h2>
          <p className="muted">
            Campate su cui tornare in un mese preciso e campate da tenere d’occhio.
          </p>
        </Link>

        {SEZIONI.map((sezione) => {
          const items = rapportiniDellaSezione(rapportini, sezione, session);
          return (
            <Link key={sezione.key} href={`/operatore/elenco/${sezione.key}`} className="home-card">
              <div className="kicker">{sezione.kicker}</div>
              <h2>{sezione.titolo}</h2>
              <p className="muted">{sezione.descrizione}</p>
              <span className="count">{items.length}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
