"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { isBaseLavoro } from "@/lib/campate/basi";
import { scaricaVistaCampate } from "@/lib/campate/export";
import { mostraEsito } from "@/lib/esitoSalvataggio";
import { LineaPicker } from "@/components/LineaPicker";
import { ANTEPRIMA_ELENCO, MostraAltro } from "@/components/MostraAltro";
import type { CampataLavoro } from "@/lib/types";

type Gruppo = {
  lineaId: string;
  codiceLinea: string;
  nomeLinea: string;
  basi: CampataLavoro[];
};

export default function TecnicoBasiPage() {
  const campate = useLiveQuery(() => db.campateLavoro.toArray(), []) ?? [];
  const [aperta, setAperta] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const [cercataId, setCercataId] = useState("");
  const [mostraAltreLinee, setMostraAltreLinee] = useState(false);
  const [mostraTutteBasi, setMostraTutteBasi] = useState(false);

  const gruppi = useMemo(() => {
    const map = new Map<string, Gruppo>();
    for (const c of campate) {
      if (!isBaseLavoro(c) || c.stato !== "tagliata") continue;
      const g = map.get(c.lineaId) ?? {
        lineaId: c.lineaId,
        codiceLinea: c.codiceLinea,
        nomeLinea: c.nomeLinea,
        basi: [],
      };
      g.basi.push(c);
      map.set(c.lineaId, g);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        basi: [...g.basi].sort((a, b) =>
          a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }),
        ),
      }))
      .sort((a, b) => a.codiceLinea.localeCompare(b.codiceLinea, "it"));
  }, [campate]);

  const elenco = useMemo(() => gruppi.flatMap((g) => g.basi), [gruppi]);
  const totale = elenco.length;
  const opzioniLinea = useMemo(
    () =>
      gruppi.map((g) => ({
        id: g.lineaId,
        codice: g.codiceLinea,
        nome: g.nomeLinea,
      })),
    [gruppi],
  );
  const gruppiFiltrati = useMemo(() => {
    if (cercataId) return gruppi.filter((g) => g.lineaId === cercataId);
    const term = cerca.trim().toLowerCase();
    if (!term) return gruppi;
    return gruppi.filter(
      (g) =>
        g.codiceLinea.toLowerCase().includes(term) ||
        g.nomeLinea.toLowerCase().includes(term),
    );
  }, [gruppi, cerca, cercataId]);
  const gruppiVisibili =
    mostraAltreLinee || cercataId ? gruppiFiltrati : gruppiFiltrati.slice(0, ANTEPRIMA_ELENCO);

  return (
    <>
      <div className="elenco-head">
        <div>
          <h2>Basi</h2>
          <p className="muted">
            Sostegni puliti quando i numeri nel box coincidono con 5.1–5.4. Sul foglio puoi
            aggiungere altre chiamate: restano in contabilità sulle basi. Tocca una linea per
            vedere i numeri.
          </p>
        </div>
        <div className="elenco-azioni">
          <strong>{totale}</strong>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={elenco.length === 0}
            onClick={() => {
              void (async () => {
                await scaricaVistaCampate(elenco, { prefisso: "basi" });
                mostraEsito({
                  titolo: "Excel scaricato",
                  testo: `Elenco con ${elenco.length} ${elenco.length === 1 ? "base" : "basi"}.`,
                  dopo: "resta",
                });
              })();
            }}
          >
            Scarica elenco
          </button>
        </div>
      </div>

      {gruppi.length === 0 ? (
        <p className="muted">
          Nessuna base tagliata. Compila un rapportino con 5.1–5.4 e lo stesso numero di sostegni
          nel box (es. 22 e quantità 1, non 10).
        </p>
      ) : (
        <>
          <div className="cerca-e-linee">
          <label className="contab-cerca-linea">
            Cerca linea
            <LineaPicker
              linee={opzioniLinea}
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
                setMostraTutteBasi(false);
                if (!id) setMostraAltreLinee(false);
              }}
            />
          </label>
          {gruppiFiltrati.length === 0 ? (
            <p className="muted">Nessuna linea trovata.</p>
          ) : (
            <div className="contab-linee">
              {gruppiVisibili.map((g) => {
                const open = aperta === g.lineaId;
                const basiVisibili = open && !mostraTutteBasi ? g.basi.slice(0, ANTEPRIMA_ELENCO) : g.basi;
                return (
                  <section key={g.lineaId} className="panel">
                    <button
                      type="button"
                      className="linee-gruppo-head"
                      aria-expanded={open}
                      onClick={() => {
                        setAperta(open ? null : g.lineaId);
                        setMostraTutteBasi(false);
                      }}
                    >
                      <span className={`chevron ${open ? "giu" : ""}`} aria-hidden="true">
                        ›
                      </span>
                      <strong>
                        {g.codiceLinea} · {g.nomeLinea}
                      </strong>
                      <span className="muted">
                        {g.basi.length} {g.basi.length === 1 ? "base" : "basi"}
                      </span>
                    </button>
                    {open ? (
                      <>
                        <div className="campate-table-wrap">
                          <table className="campate-table">
                            <thead>
                              <tr>
                                <th>Base</th>
                                <th>Data</th>
                                <th>Operatore</th>
                                <th>Rapportino</th>
                              </tr>
                            </thead>
                            <tbody>
                              {basiVisibili.map((b) => (
                                <tr key={b.id}>
                                  <td>
                                    <strong>{b.normalizzata}</strong>
                                  </td>
                                  <td>{b.dataTaglio ? formatDate(b.dataTaglio) : "—"}</td>
                                  <td>{b.operatore ?? "—"}</td>
                                  <td>
                                    {b.rapportinoId ? (
                                      <Link href={`/tecnico/rapportini/${b.rapportinoId}`}>Apri</Link>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <MostraAltro
                          aperto={mostraTutteBasi}
                          totale={g.basi.length}
                          onToggle={() => setMostraTutteBasi((v) => !v)}
                        />
                      </>
                    ) : null}
                  </section>
                );
              })}
              {!cercataId ? (
                <MostraAltro
                  aperto={mostraAltreLinee}
                  totale={gruppiFiltrati.length}
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
