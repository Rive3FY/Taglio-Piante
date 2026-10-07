"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { OcchioCifre, useCifreVisibili } from "@/components/OcchioCifre";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/contabilita/aggrega";
import { totaleVoci, vociDaRighe } from "@/lib/contabilita/listino";
import { todayIso } from "@/lib/format";
import { SEZIONI, rapportiniDellaSezione, rapportinoVisibile } from "@/lib/sezioni";
import { useSession } from "@/lib/SessionContext";

export default function OperatoreHome() {
  const { session } = useSession();
  const { visibili: cifreVisibili, alterna: alternaCifre } = useCifreVisibili();
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []);
  const prestazioni = useLiveQuery(() => db.prestazioni.toArray(), []);

  const totaleOggi = useMemo(() => {
    const oggi = todayIso();
    const mieiOggi = (rapportini ?? []).filter(
      (r) => r.dataLavoro === oggi && rapportinoVisibile(r, session, "operatore"),
    );
    const { totale, senzaPrezzo } = totaleVoci(
      vociDaRighe(
        mieiOggi.flatMap((r) => r.righe),
        prestazioni ?? [],
      ),
    );
    return { euro: totale, fogli: mieiOggi.length, senzaPrezzo };
  }, [rapportini, prestazioni, session]);

  return (
    <>
      <div className="panel home-oggi" aria-live="polite">
        <div className="home-oggi-testa">
          <div className="kicker">Oggi</div>
          <OcchioCifre visibili={cifreVisibili} onClick={alternaCifre} />
        </div>
        <div className="home-oggi-riga">
          {cifreVisibili ? (
            <>
              <strong className="home-oggi-euro">{formatEuro(totaleOggi.euro)}</strong>
              <span className="muted">
                {totaleOggi.fogli === 0
                  ? "Nessun tuo rapportino con data di oggi"
                  : totaleOggi.fogli === 1
                    ? "1 tuo rapportino di oggi"
                    : `${totaleOggi.fogli} tuoi rapportini di oggi`}
                {totaleOggi.senzaPrezzo > 0 ? " · alcune voci senza prezzo" : ""}
              </span>
            </>
          ) : (
            <strong className="home-oggi-euro cifre-nascoste" aria-label="Totale e importo nascosti">
              ••••
            </strong>
          )}
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
          const items = rapportiniDellaSezione(rapportini ?? [], sezione, session, "operatore");
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
