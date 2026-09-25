"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/contabilita/aggrega";
import { totaleVoci } from "@/lib/contabilita/listino";
import { todayIso } from "@/lib/format";
import { SEZIONI, rapportiniDellaSezione, rapportinoVisibile } from "@/lib/sezioni";
import { useSession } from "@/lib/SessionContext";

export default function OperatoreHome() {
  const { session } = useSession();
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []) ?? [];

  const totaleOggi = useMemo(() => {
    const oggi = todayIso();
    const mieiOggi = rapportini.filter(
      (r) => r.dataLavoro === oggi && rapportinoVisibile(r, session, "operatore"),
    );
    if (mieiOggi.length === 0 || prestazioni.length === 0) {
      return { euro: 0, fogli: 0, senzaPrezzo: 0 };
    }
    const byId = new Map(prestazioni.map((p) => [p.id, p]));
    const voci: { quantita: number; codice: string; unitaMisura: string }[] = [];
    for (const r of mieiOggi) {
      for (const riga of r.righe ?? []) {
        if (!(riga.quantita > 0)) continue;
        const p = byId.get(riga.prestazioneId);
        if (!p) continue;
        voci.push({ quantita: riga.quantita, codice: p.codice, unitaMisura: p.unitaMisura });
      }
    }
    const { totale, senzaPrezzo } = totaleVoci(voci);
    return { euro: totale, fogli: mieiOggi.length, senzaPrezzo };
  }, [rapportini, prestazioni, session]);

  return (
    <>
      <div className="panel home-oggi" aria-live="polite">
        <div className="kicker">Oggi</div>
        <div className="home-oggi-riga">
          <strong className="home-oggi-euro">{formatEuro(totaleOggi.euro)}</strong>
          <span className="muted">
            {totaleOggi.fogli === 0
              ? "Nessun tuo rapportino con data di oggi"
              : totaleOggi.fogli === 1
                ? "1 tuo rapportino di oggi"
                : `${totaleOggi.fogli} tuoi rapportini di oggi`}
            {totaleOggi.senzaPrezzo > 0 ? " · alcune voci senza prezzo" : ""}
          </span>
        </div>
      </div>

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
          const items = rapportiniDellaSezione(rapportini, sezione, session, "operatore");
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
