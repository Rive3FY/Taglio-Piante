"use client";

import { Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { RapportiniElenco } from "@/components/RapportiniElenco";
import { lineaDescrizione, lineaKicker } from "@/lib/format";
type CartellaKey = "in_attesa" | "archiviato";

const CARTELLE: { key: CartellaKey; label: string; desc: string }[] = [
  { key: "in_attesa", label: "In attesa", desc: "Compilati dall’operatore, da verificare o completare con firma ditta." },
  { key: "archiviato", label: "Archiviati", desc: "Chiusi e conservati sulla linea." },
];

export default function LineaArchivioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="muted">Caricamento archivio…</p>}>
      <LineaArchivio params={params} />
    </Suspense>
  );
}

function LineaArchivio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const search = useSearchParams();
  const cartella = search.get("cartella") as CartellaKey | null;
  const linea = useLiveQuery(() => db.linee.get(id), [id]);
  const items = useLiveQuery(
    () => db.rapportini.where("lineaId").equals(id).toArray(),
    [id],
  );

  const grouped = useMemo(() => {
    const list = items ?? [];
    return {
      in_attesa: list.filter((r) => r.stato === "in_attesa"),
      archiviato: list.filter((r) => r.stato === "archiviato"),
    };
  }, [items]);

  if (!linea) return <p className="muted">Caricamento linea…</p>;

  const current = cartella && cartella in grouped ? grouped[cartella as keyof typeof grouped] : null;

  return (
    <>
      <div>
        <div className="kicker">{lineaKicker(linea)}</div>
        <h2>{lineaDescrizione(linea)}</h2>
      </div>

      <div className="folder-grid">
        {CARTELLE.map((c) => (
          <Link
            key={c.key}
            href={`/tecnico/linee/${id}?cartella=${c.key}`}
            className="folder-card"
          >
            <div className="kicker">Archivio linea</div>
            <h2>{c.label}</h2>
            <p className="muted">{c.desc}</p>
            <span className="count">{grouped[c.key].length}</span>
          </Link>
        ))}
      </div>

      {current ? (
        <section className="panel">
          <h2>{CARTELLE.find((c) => c.key === cartella)?.label}</h2>
          <RapportiniElenco
            items={current}
            linee={[linea]}
            hrefFor={(item) => `/tecnico/rapportini/${item.id}`}
            vuoto="Cartella vuota."
            passo={8}
            filtroData
          />
        </section>
      ) : (
        <p className="muted">Apri una cartella per vedere i rapportini di questa linea.</p>
      )}
    </>
  );
}
