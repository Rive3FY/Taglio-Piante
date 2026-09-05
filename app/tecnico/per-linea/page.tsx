"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { lineaDescrizione } from "@/lib/format";
import { rapportinoEChiuso, type Linea, type Rapportino } from "@/lib/types";
import { LineaPicker } from "@/components/LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "@/components/MostraAltro";
import { RapportinoCard } from "@/components/RapportinoCard";
import { confermaECancellaRapportini } from "@/components/DeleteRapportinoButton";

type Gruppo = {
  lineaId: string;
  linea?: Linea;
  items: Rapportino[];
};

export default function TecnicoPerLineaPage() {
  const lineaQ = useSearchParams().get("linea") ?? "";
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? [];
  const rapportini = useLiveQuery(() => db.rapportini.toArray(), []) ?? [];
  const [cerca, setCerca] = useState("");
  const [cercataId, setCercataId] = useState(lineaQ);
  const [aperta, setAperta] = useState<string | null>(lineaQ || null);
  const [mostraAltreLinee, setMostraAltreLinee] = useState(false);
  const [mostraTuttiFogli, setMostraTuttiFogli] = useState(false);
  const [scelti, setScelti] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!lineaQ) return;
    setCercataId(lineaQ);
    setAperta(lineaQ);
    setMostraTuttiFogli(false);
    setScelti([]);
  }, [lineaQ]);

  const gruppi = useMemo(() => {
    const byId = new Map(linee.map((l) => [l.id, l]));
    const map = new Map<string, Gruppo>();
    for (const r of rapportini) {
      const g = map.get(r.lineaId) ?? { lineaId: r.lineaId, linea: byId.get(r.lineaId), items: [] };
      g.linea = g.linea ?? byId.get(r.lineaId);
      g.items.push(r);
      map.set(r.lineaId, g);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        items: [...g.items].sort(
          (a, b) =>
            b.dataLavoro.localeCompare(a.dataLavoro) || b.updatedAt.localeCompare(a.updatedAt),
        ),
      }))
      .sort((a, b) => {
        const ac = a.linea?.codice ?? a.lineaId;
        const bc = b.linea?.codice ?? b.lineaId;
        return ac.localeCompare(bc, "it");
      });
  }, [linee, rapportini]);

  const opzioni = useMemo(
    () =>
      gruppi.map((g) => ({
        id: g.lineaId,
        codice: g.linea?.codice ?? g.lineaId,
        nome: g.linea?.nome ?? "Linea",
      })),
    [gruppi],
  );

  const filtrati = useMemo(() => {
    if (cercataId) return gruppi.filter((g) => g.lineaId === cercataId);
    const term = cerca.trim().toLowerCase();
    if (!term) return gruppi;
    return gruppi.filter((g) => {
      const codice = g.linea?.codice ?? "";
      const nome = g.linea?.nome ?? "";
      return codice.toLowerCase().includes(term) || nome.toLowerCase().includes(term);
    });
  }, [gruppi, cerca, cercataId]);

  const visibili = mostraAltreLinee || cercataId ? filtrati : filtrati.slice(0, ANTEPRIMA_ELENCO);

  function apri(lineaId: string) {
    setAperta((cur) => (cur === lineaId ? null : lineaId));
    setMostraTuttiFogli(false);
    setScelti([]);
  }

  function toggleScelto(id: string) {
    setScelti((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const gruppoAperto = gruppi.find((g) => g.lineaId === aperta);
  const tuttiIds = gruppoAperto?.items.map((r) => r.id) ?? [];
  const tuttiSelezionati = tuttiIds.length > 0 && tuttiIds.every((id) => scelti.includes(id));

  async function eliminaSelezionati() {
    if (!gruppoAperto || scelti.length === 0) return;
    const daCancellare = gruppoAperto.items.filter((r) => scelti.includes(r.id));
    setBusy(true);
    try {
      const fatto = await confermaECancellaRapportini(daCancellare);
      if (fatto) setScelti([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Rapportini per linea</h2>
        </div>
        <strong>{rapportini.length}</strong>
      </div>

      {gruppi.length === 0 ? (
        <p className="muted">Nessun rapportino. Quando ne chiudi o ne salvi uno, la linea compare qui.</p>
      ) : (
        <>
          <div className="cerca-e-linee">
          <label className="contab-cerca-linea">
            Cerca linea
            <LineaPicker
              linee={opzioni}
              value={cercataId}
              campo="completa"
              placeholder="Codice o nome linea"
              onQueryChange={(q) => {
                setCerca(q);
                setMostraAltreLinee(false);
              }}
              onChange={(id) => {
                setCercataId(id);
                setAperta(id || null);
                setMostraTuttiFogli(false);
                setScelti([]);
                if (!id) setMostraAltreLinee(false);
              }}
            />
          </label>
          {filtrati.length === 0 ? (
            <p className="muted">Nessuna linea trovata.</p>
          ) : (
            <div className="contab-linee">
              {visibili.map((g) => {
                const open = aperta === g.lineaId;
                const fogli = open && !mostraTuttiFogli ? g.items.slice(0, ANTEPRIMA_ELENCO) : g.items;
                const chiusi = g.items.filter((r) => rapportinoEChiuso(r.stato)).length;
                const bozze = g.items.length - chiusi;
                return (
                  <section key={g.lineaId} className="panel">
                    <button
                      type="button"
                      className="linee-gruppo-head"
                      aria-expanded={open}
                      onClick={() => apri(g.lineaId)}
                    >
                      <span className={`chevron ${open ? "giu" : ""}`} aria-hidden="true">
                        ›
                      </span>
                      <strong>
                        {g.linea ? lineaDescrizione(g.linea) : g.lineaId}
                      </strong>
                      <span className="muted">
                        {g.items.length} {g.items.length === 1 ? "rapportino" : "rapportini"}
                        {bozze > 0 ? ` · ${bozze} ${bozze === 1 ? "bozza" : "bozze"}` : ""}
                      </span>
                    </button>
                    {open ? (
                      <>
                        <div className="rap-sel-azioni">
                          <label className="check-line">
                            <input
                              type="checkbox"
                              checked={tuttiSelezionati}
                              onChange={() =>
                                setScelti(tuttiSelezionati ? [] : tuttiIds)
                              }
                            />
                            {tuttiSelezionati ? "Togli selezione" : "Seleziona tutti"}
                          </label>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={busy || scelti.length === 0}
                            onClick={() => void eliminaSelezionati()}
                          >
                            {busy
                              ? "Cancellazione…"
                              : scelti.length === 0
                                ? "Elimina selezionati"
                                : `Elimina selezionati (${scelti.length})`}
                          </button>
                        </div>
                        <div className="rap-sel-elenco">
                          {fogli.map((item) => (
                            <div key={item.id} className="rap-sel-riga">
                              <input
                                type="checkbox"
                                checked={scelti.includes(item.id)}
                                onChange={() => toggleScelto(item.id)}
                                aria-label={`Seleziona ${item.numero}`}
                              />
                              <RapportinoCard
                                item={item}
                                linea={g.linea}
                                href={`/tecnico/rapportini/${item.id}?da=per-linea`}
                              />
                            </div>
                          ))}
                        </div>
                        <MostraAltro
                          aperto={mostraTuttiFogli}
                          totale={g.items.length}
                          onToggle={() => setMostraTuttiFogli((v) => !v)}
                        />
                      </>
                    ) : null}
                  </section>
                );
              })}
              {!cercataId ? (
                <MostraAltro
                  aperto={mostraAltreLinee}
                  totale={filtrati.length}
                  onToggle={() => setMostraAltreLinee((v) => !v)}
                />
              ) : null}
            </div>
          )}
          </div>
        </>
      )}
    </>
  );
}
