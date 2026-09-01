"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportinoCard } from "@/components/RapportinoCard";
import { useSession } from "@/lib/SessionContext";

export default function OperatoreHome() {
  const { session } = useSession();
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];

  const bozze = rapportini.filter(
    (r) =>
      (r.stato === "bozza" || r.stato === "da_prendere") &&
      (!r.presoDa || r.presoDa === session?.nome),
  );
  const inviati = rapportini.filter((r) => r.stato === "in_attesa" && r.presoDa === session?.nome);
  const archiviati = rapportini.filter((r) => r.stato === "archiviato" && r.presoDa === session?.nome);

  const linea = (id: string) => linee.find((l) => l.id === id);

  return (
    <>
      <div className="home-grid">
        <a href="/operatore/nuovo" className="home-card">
          <div className="kicker">Nuovo</div>
          <h2>Compila rapportino</h2>
          <p className="muted">Lavoro libero, salvataggio locale e firma S Pen.</p>
        </a>
        <div className="home-card">
          <div className="kicker">Locale</div>
          <h2>Bozze</h2>
          <span className="count">{bozze.length}</span>
        </div>
        <div className="home-card">
          <div className="kicker">Inviati</div>
          <h2>In attesa</h2>
          <span className="count">{inviati.length}</span>
        </div>
        <div className="home-card">
          <div className="kicker">Chiusi</div>
          <h2>Archiviati</h2>
          <span className="count">{archiviati.length}</span>
        </div>
      </div>

      <section className="panel">
        <h2>Bozze sul dispositivo</h2>
        {bozze.length === 0 ? (
          <p className="muted">Nessuna bozza locale.</p>
        ) : (
          bozze.map((item) => (
            <RapportinoCard
              key={item.id}
              item={item}
              linea={linea(item.lineaId)}
              href={`/operatore/${item.id}`}
            />
          ))
        )}
      </section>

      <section className="panel">
        <h2>Inviati in attesa</h2>
        {inviati.length === 0 ? (
          <p className="muted">Nessun rapportino in attesa. Aprine uno da qui per completarlo.</p>
        ) : (
          inviati.map((item) => (
            <RapportinoCard
              key={item.id}
              item={item}
              linea={linea(item.lineaId)}
              href={`/operatore/${item.id}`}
            />
          ))
        )}
      </section>
      <section className="panel">
        <h2>Archiviati</h2>
        {archiviati.length === 0 ? (
          <p className="muted">Nessun rapportino archiviato.</p>
        ) : (
          archiviati.map((item) => (
            <RapportinoCard
              key={item.id}
              item={item}
              linea={linea(item.lineaId)}
              href={`/operatore/${item.id}`}
            />
          ))
        )}
      </section>
    </>
  );
}
